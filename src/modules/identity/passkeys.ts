/**
 * Passkeys — the fast way back in.
 *
 * A passkey is a key pair the device creates and keeps; the phone or laptop
 * unlocks it with a fingerprint or a face, and the server only ever sees the
 * public half. That is the same shape as everything else in this module: the
 * private half never leaves the machine that made it.
 *
 * Signing in with a passkey still opens an ordinary session, bound to the
 * session key the browser generated, so nothing downstream needs to care how
 * someone got in.
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  addPasskey,
  findAccount,
  findAccountByPasskey,
  saveChallenge,
  takeChallenge,
  touchPasskey,
  type Account,
} from "./store";
import { openSession } from "./service";
import type { Session } from "./store";

const CHALLENGE_TTL_MINUTES = 5;

export const RP_NAME = "Commons Hub Brussels";

/**
 * The relying party is the site the passkey belongs to. It has to match the
 * page's own hostname, so we take it from the request rather than a constant —
 * this app answers on more than one domain.
 */
export function relyingParty(request: Request): { rpID: string; origin: string } {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const url = new URL(configured || request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || url.host;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

function expiry(): string {
  return new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000).toISOString();
}

// ── registering one ────────────────────────────────────────────────────────

export async function registrationOptions(input: {
  account: Account;
  sessionPubkey: string;
  request: Request;
}) {
  const { rpID } = relyingParty(input.request);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: input.account.email || input.account.displayName,
    userDisplayName: input.account.displayName,
    attestationType: "none",
    // Don't offer to make a second passkey for a device that already has one.
    excludeCredentials: (input.account.passkeys ?? []).map((p) => ({
      id: p.id,
      transports: p.transports as never,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  saveChallenge({
    sessionPubkey: input.sessionPubkey,
    challenge: options.challenge,
    purpose: "register",
    expiresAt: expiry(),
  });

  return options;
}

export async function verifyRegistration(input: {
  account: Account;
  sessionPubkey: string;
  response: RegistrationResponseJSON;
  label: string;
  request: Request;
}): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  const expectedChallenge = takeChallenge(input.sessionPubkey, "register");
  if (!expectedChallenge) {
    return { ok: false, error: "That took too long. Try setting up the passkey again." };
  }

  const { rpID, origin } = relyingParty(input.request);

  try {
    const verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { ok: false, error: "That passkey could not be verified." };
    }

    const { credential } = verification.registrationInfo;
    addPasskey(input.account.id, {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: input.response.response.transports,
      label: input.label,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    });

    return { ok: true, label: input.label };
  } catch (error) {
    console.error("[identity] passkey registration failed:", error);
    return { ok: false, error: "That passkey could not be verified." };
  }
}

// ── signing in with one ────────────────────────────────────────────────────

export async function authenticationOptions(input: {
  sessionPubkey: string;
  request: Request;
}) {
  const { rpID } = relyingParty(input.request);

  // No allowCredentials: the browser offers whatever passkey it holds for this
  // site, so nobody has to type an email address first.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  saveChallenge({
    sessionPubkey: input.sessionPubkey,
    challenge: options.challenge,
    purpose: "login",
    expiresAt: expiry(),
  });

  return options;
}

export async function verifyAuthentication(input: {
  sessionPubkey: string;
  response: AuthenticationResponseJSON;
  request: Request;
}): Promise<{ ok: true; account: Account; session: Session } | { ok: false; error: string }> {
  const expectedChallenge = takeChallenge(input.sessionPubkey, "login");
  if (!expectedChallenge) {
    return { ok: false, error: "That took too long. Try again." };
  }

  const account = findAccountByPasskey(input.response.id);
  const passkey = account?.passkeys?.find((p) => p.id === input.response.id);
  if (!account || !passkey) {
    return { ok: false, error: "We do not know that passkey. Sign in with your email instead." };
  }

  const { rpID, origin } = relyingParty(input.request);

  try {
    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
        counter: passkey.counter,
        transports: passkey.transports as never,
      },
    });

    if (!verification.verified) {
      return { ok: false, error: "That passkey did not check out." };
    }

    touchPasskey(account.id, passkey.id, verification.authenticationInfo.newCounter);
    const live = findAccount(account.id) ?? account;
    return { ok: true, account: live, session: openSession(live, input.sessionPubkey) };
  } catch (error) {
    console.error("[identity] passkey sign-in failed:", error);
    return { ok: false, error: "That passkey did not check out." };
  }
}

/** A name someone will recognise in a list of their devices. */
export function labelFromUserAgent(userAgent: string | null): string {
  if (!userAgent) return "This device";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Android/i.test(userAgent)) return "Android phone";
  if (/Macintosh/i.test(userAgent)) return "Mac";
  if (/Windows/i.test(userAgent)) return "Windows PC";
  if (/Linux/i.test(userAgent)) return "Linux computer";
  return "This device";
}
