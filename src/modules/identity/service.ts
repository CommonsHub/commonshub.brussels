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
  codeMatches,
  hashBody,
  hashCode,
  newAccountKey,
  randomCode,
  randomToken,
  signWithAccountKey,
  verifySessionEnvelope,
} from "./crypto";
import {
  countFailedAttempt,
  deletePendingLogin,
  deleteSession,
  findAccount,
  findAccountByDiscordId,
  findAccountByEmail,
  findPendingLogin,
  findSession,
  findSessionByPubkey,
  savePendingLogin,
  saveAccount,
  saveSession,
  touchAccount,
  type Account,
  type Role,
  type Session,
} from "./store";

export const SESSION_COOKIE = "chb_session";
const SESSION_TTL_DAYS = 30;
const CODE_TTL_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;

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
 * Step one: issue a six-digit code for this browser and hand it back to be
 * emailed. The account itself is only created once the code is entered, so an
 * address someone typed by mistake never becomes an account.
 */
export function startEmailLogin(request: EmailLoginRequest): {
  code: string;
  expiresInMinutes: number;
} {
  const code = randomCode();
  const now = Date.now();
  savePendingLogin({
    id: `pen_${randomToken().slice(0, 16)}`,
    email: request.email.trim().toLowerCase(),
    codeHash: hashCode(code, request.sessionPubkey),
    sessionPubkey: request.sessionPubkey,
    attempts: 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CODE_TTL_MINUTES * 60_000).toISOString(),
  });
  return { code, expiresInMinutes: CODE_TTL_MINUTES };
}

export type EmailCodeResult =
  | { ok: true; account: Account; session: Session }
  | { ok: false; error: string };

/**
 * Step two: the code was typed in. It only works in the browser that asked for
 * it, for ten minutes, and five wrong guesses burn it — six digits are easy to
 * type and easy to guess, so the attempts are what make them safe.
 */
export function completeEmailLogin(request: {
  email: string;
  code: string;
  sessionPubkey: string;
}): EmailCodeResult {
  const email = request.email.trim().toLowerCase();
  const code = request.code.replace(/\D/g, "");
  const pending = findPendingLogin(email, request.sessionPubkey);

  if (!pending) {
    return { ok: false, error: "That code has expired. Ask for a new one." };
  }

  if (!codeMatches(code, request.sessionPubkey, pending.codeHash)) {
    const attempts = countFailedAttempt(pending.id);
    if (attempts >= MAX_CODE_ATTEMPTS) {
      deletePendingLogin(pending.id);
      return { ok: false, error: "Too many tries. Ask for a new code." };
    }
    const left = MAX_CODE_ATTEMPTS - attempts;
    return {
      ok: false,
      error: `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`,
    };
  }

  deletePendingLogin(pending.id);
  const account = findAccountByEmail(email) ?? saveAccount(newAccount({ email }));
  const session = openSession(account, request.sessionPubkey);
  return { ok: true, account, session };
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
