/**
 * The identity service: sign in with an email or a Discord account, then act
 * without ever holding a key you could lose.
 *
 * Sign-in binds two things together — the account (whose key lives on the
 * server) and the session (whose key was generated in your browser and stays
 * there). From then on, every action your browser asks for is signed by your
 * browser's session key; the server checks that signature, then signs the
 * actual content with your account key.
 */

import type { EventTemplate, Event } from "nostr-tools/pure";
import {
  hashBody,
  newAccountKey,
  randomToken,
  signWithAccountKey,
  verifySessionEnvelope,
} from "./crypto";
import {
  deleteSession,
  findAccount,
  findAccountByDiscordId,
  findAccountByEmail,
  findSession,
  findSessionByPubkey,
  savePendingLogin,
  saveAccount,
  saveSession,
  takePendingLogin,
  touchAccount,
  type Account,
  type Role,
  type Session,
} from "./store";

export const SESSION_COOKIE = "chb_session";
const SESSION_TTL_DAYS = 30;
const EMAIL_LINK_TTL_MINUTES = 30;

function accountId(): string {
  return `acc_${randomToken().slice(0, 16)}`;
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "someone";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 40);
}

function newAccount(input: {
  email?: string | null;
  discordId?: string | null;
  displayName?: string;
  roles?: Role[];
}): Account {
  const { secret, pubkey } = newAccountKey();
  const now = new Date().toISOString();
  const email = input.email ? input.email.trim().toLowerCase() : null;
  return {
    id: accountId(),
    email,
    discordId: input.discordId ?? null,
    displayName: input.displayName || (email ? nameFromEmail(email) : "Someone"),
    encryptedKey: secret,
    pubkey,
    roles: input.roles ?? ["guest"],
    createdAt: now,
    lastSeenAt: now,
  };
}

// ── sign in with an email ──────────────────────────────────────────────────

export interface EmailLoginRequest {
  email: string;
  /** Public half of the key this browser just generated. */
  sessionPubkey: string;
}

/**
 * Step one: remember which browser asked, and hand back a token to email.
 * The account itself is only created once the link is clicked, so an address
 * someone typed by mistake never becomes an account.
 */
export function startEmailLogin(request: EmailLoginRequest): { token: string } {
  const token = randomToken();
  const now = Date.now();
  savePendingLogin({
    token,
    email: request.email.trim().toLowerCase(),
    sessionPubkey: request.sessionPubkey,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + EMAIL_LINK_TTL_MINUTES * 60_000).toISOString(),
  });
  return { token };
}

/** Step two: the link was clicked. Create the account if new, open the session. */
export function completeEmailLogin(token: string): { account: Account; session: Session } | null {
  const pending = takePendingLogin(token);
  if (!pending) return null;

  const account = findAccountByEmail(pending.email) ?? saveAccount(newAccount({ email: pending.email }));
  const session = openSession(account, pending.sessionPubkey);
  return { account, session };
}

// ── sign in with Discord ───────────────────────────────────────────────────

export interface DiscordProfile {
  discordId: string;
  username: string;
  email?: string | null;
  roleNames?: string[];
}

/** Discord roles decide what someone can do here; stewards can confirm events. */
export function rolesFromDiscord(roleNames: string[] = []): Role[] {
  const lower = roleNames.map((r) => r.toLowerCase());
  const roles: Role[] = ["member"];
  if (lower.some((r) => r.includes("steward"))) roles.push("steward");
  return roles;
}

export function upsertDiscordAccount(profile: DiscordProfile): Account {
  const existing =
    findAccountByDiscordId(profile.discordId) ??
    (profile.email ? findAccountByEmail(profile.email) : null);

  const roles = rolesFromDiscord(profile.roleNames);

  if (existing) {
    return saveAccount({
      ...existing,
      discordId: profile.discordId,
      email: existing.email ?? (profile.email?.toLowerCase() ?? null),
      displayName: profile.username || existing.displayName,
      roles,
      lastSeenAt: new Date().toISOString(),
    });
  }

  return saveAccount(
    newAccount({
      discordId: profile.discordId,
      email: profile.email ?? null,
      displayName: profile.username,
      roles,
    }),
  );
}

// ── sessions ───────────────────────────────────────────────────────────────

export function openSession(account: Account, sessionPubkey: string, userAgent?: string): Session {
  const now = Date.now();
  return saveSession({
    id: `ses_${randomToken().slice(0, 20)}`,
    accountId: account.id,
    sessionPubkey,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_DAYS * 86_400_000).toISOString(),
    userAgent,
  });
}

export function closeSession(sessionId: string): void {
  deleteSession(sessionId);
}

export interface Caller {
  account: Account;
  session: Session;
}

export function callerFromSessionId(sessionId: string | undefined | null): Caller | null {
  if (!sessionId) return null;
  const session = findSession(sessionId);
  if (!session) return null;
  const account = findAccount(session.accountId);
  if (!account) return null;
  touchAccount(account.id);
  return { account, session };
}

// ── acting on someone's behalf ─────────────────────────────────────────────

export interface SignRequest {
  /** What the browser wants signed. */
  template: EventTemplate;
  /** An event signed by the session key, committing to `template`. */
  envelope: Event;
}

export type SignResult =
  | { ok: true; event: Event; account: Account }
  | { ok: false; error: string };

/**
 * Sign on an account's behalf, but only for a browser that proves it holds the
 * session key registered at sign-in. This is the whole point of the module: the
 * account key can sign, and it lives somewhere no browser can reach it.
 */
export function signOnBehalf(request: SignRequest): SignResult {
  const session = findSessionByPubkey(request.envelope.pubkey);
  if (!session) {
    return { ok: false, error: "This session is not signed in, or it has expired." };
  }

  const check = verifySessionEnvelope(request.envelope, {
    sessionPubkey: session.sessionPubkey,
    bodyHash: hashBody(request.template),
  });
  if (!check.ok) return { ok: false, error: check.reason };

  const account = findAccount(session.accountId);
  if (!account) return { ok: false, error: "This account no longer exists." };

  const event = signWithAccountKey(account.encryptedKey, request.template);
  touchAccount(account.id);
  return { ok: true, event, account };
}

/** A signer bound to one account, for server-side work like seeding a task list. */
export function signerFor(account: Account) {
  return async (template: EventTemplate): Promise<Event> =>
    signWithAccountKey(account.encryptedKey, template);
}

export function isSteward(account: Account | null | undefined): boolean {
  return !!account?.roles.includes("steward");
}

export function isMember(account: Account | null | undefined): boolean {
  return !!account && (account.roles.includes("member") || account.roles.includes("steward"));
}

/** What the browser is allowed to know about the signed-in person. */
export function publicProfile(account: Account) {
  return {
    id: account.id,
    displayName: account.displayName,
    email: account.email,
    discordId: account.discordId,
    roles: account.roles,
    isMember: isMember(account),
    isSteward: isSteward(account),
  };
}

export type { Account, Role, Session };
