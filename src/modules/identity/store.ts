/**
 * Accounts, sessions and pending email links, stored as JSON next to the
 * proposals. Small enough that a file is the right database, and easy to move
 * behind a real one later — everything goes through the functions below.
 */

import * as fs from "fs";
import * as path from "path";
import { identityDir } from "./crypto";

export type Role = "guest" | "member" | "steward";

/** A passkey registered on one of someone's devices. */
export interface Passkey {
  /** Base64url credential id. */
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  /** What the person will recognise it by, e.g. "iPhone". */
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface Account {
  id: string;
  /** Lowercased. Present for email sign-ins and for Discord accounts that share one. */
  email: string | null;
  discordId: string | null;
  displayName: string;
  /** Encrypted with the server key; never leaves the server. */
  encryptedKey: string;
  /** The public half — this is what shows up as the author of what you sign. */
  pubkey: string;
  roles: Role[];
  passkeys: Passkey[];
  /** Set when this account was folded into another; reads follow the pointer. */
  mergedInto?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface Session {
  id: string;
  accountId: string;
  /** Public half of the key the browser generated for this session. */
  sessionPubkey: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
}

export interface PendingEmailLogin {
  id: string;
  email: string;
  /** The code is kept hashed, salted with the session it was issued to. */
  codeHash: string;
  sessionPubkey: string;
  attempts: number;
  createdAt: string;
  expiresAt: string;
}

/** A WebAuthn challenge, held for the browser that asked for it. */
export interface PendingChallenge {
  sessionPubkey: string;
  challenge: string;
  purpose: "register" | "login";
  expiresAt: string;
}

interface Db {
  accounts: Account[];
  sessions: Session[];
  pending: PendingEmailLogin[];
  challenges: PendingChallenge[];
}

const EMPTY: Db = { accounts: [], sessions: [], pending: [], challenges: [] };

function dbPath(): string {
  return path.join(identityDir(), "identity.json");
}

function read(): Db {
  const file = dbPath();
  if (!fs.existsSync(file)) return { ...EMPTY };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<Db>;
    return {
      // Accounts written before passkeys existed have no list; give them one.
      accounts: (parsed.accounts ?? []).map((a) => ({ ...a, passkeys: a.passkeys ?? [] })),
      sessions: parsed.sessions ?? [],
      pending: parsed.pending ?? [],
      challenges: parsed.challenges ?? [],
    };
  } catch (error) {
    console.error("[identity] could not read the store:", error);
    return { ...EMPTY };
  }
}

function write(db: Db): void {
  const dir = identityDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = dbPath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function mutate<T>(fn: (db: Db) => T): T {
  const db = read();
  const result = fn(db);
  write(db);
  return result;
}

// ── accounts ───────────────────────────────────────────────────────────────

/** Follow the merge pointer, so an old id keeps resolving to the live account. */
function resolve(db: Db, account: Account | undefined): Account | null {
  let current = account;
  const seen = new Set<string>();
  while (current?.mergedInto && !seen.has(current.id)) {
    seen.add(current.id);
    current = db.accounts.find((a) => a.id === current!.mergedInto);
  }
  return current ?? null;
}

export function findAccountByEmail(email: string): Account | null {
  const db = read();
  const needle = email.trim().toLowerCase();
  return resolve(db, db.accounts.find((a) => a.email === needle && !a.mergedInto));
}

export function findAccountByDiscordId(discordId: string): Account | null {
  const db = read();
  return resolve(db, db.accounts.find((a) => a.discordId === discordId && !a.mergedInto));
}

export function findAccount(id: string): Account | null {
  const db = read();
  return resolve(db, db.accounts.find((a) => a.id === id));
}

export function findAccountByPasskey(credentialId: string): Account | null {
  const db = read();
  return resolve(db, db.accounts.find((a) => a.passkeys?.some((p) => p.id === credentialId)));
}

/**
 * Fold one account into another — what happens when someone signs in with an
 * email and then connects a Discord account that already had one here. The
 * primary keeps everything; the secondary becomes a pointer, so anything that
 * referenced it (a proposal, a comment, an open session) still resolves.
 */
export function mergeAccounts(primaryId: string, secondaryId: string): Account | null {
  return mutate((db) => {
    const primary = db.accounts.find((a) => a.id === primaryId);
    const secondary = db.accounts.find((a) => a.id === secondaryId);
    if (!primary || !secondary || primary.id === secondary.id) return primary ?? null;

    primary.email = primary.email ?? secondary.email;
    primary.discordId = primary.discordId ?? secondary.discordId;
    primary.roles = Array.from(new Set([...primary.roles, ...secondary.roles]));
    primary.passkeys = [...(primary.passkeys ?? []), ...(secondary.passkeys ?? [])];

    secondary.mergedInto = primary.id;
    secondary.email = null;
    secondary.discordId = null;
    secondary.passkeys = [];

    // Sessions opened against the secondary keep working, on the primary.
    for (const session of db.sessions) {
      if (session.accountId === secondary.id) session.accountId = primary.id;
    }

    return primary;
  });
}

export function saveAccount(account: Account): Account {
  return mutate((db) => {
    const index = db.accounts.findIndex((a) => a.id === account.id);
    if (index >= 0) db.accounts[index] = account;
    else db.accounts.push(account);
    return account;
  });
}

export function touchAccount(id: string): void {
  mutate((db) => {
    const account = db.accounts.find((a) => a.id === id);
    if (account) account.lastSeenAt = new Date().toISOString();
  });
}

// ── sessions ───────────────────────────────────────────────────────────────

export function saveSession(session: Session): Session {
  return mutate((db) => {
    db.sessions = db.sessions.filter(
      (s) => s.id !== session.id && s.sessionPubkey !== session.sessionPubkey,
    );
    db.sessions.push(session);
    // Drop anything long expired so the file does not grow forever.
    const now = Date.now();
    db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > now - 86_400_000);
    return session;
  });
}

export function findSession(id: string): Session | null {
  const session = read().sessions.find((s) => s.id === id);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return session;
}

export function findSessionByPubkey(sessionPubkey: string): Session | null {
  const session = read().sessions.find((s) => s.sessionPubkey === sessionPubkey);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return session;
}

export function deleteSession(id: string): void {
  mutate((db) => {
    db.sessions = db.sessions.filter((s) => s.id !== id);
  });
}

// ── pending email links ────────────────────────────────────────────────────

export function savePendingLogin(pending: PendingEmailLogin): void {
  mutate((db) => {
    const now = Date.now();
    db.pending = db.pending.filter(
      (p) =>
        new Date(p.expiresAt).getTime() > now &&
        // One code at a time per browser: asking again replaces the old one.
        !(p.sessionPubkey === pending.sessionPubkey && p.email === pending.email),
    );
    db.pending.push(pending);
  });
}

/** The code someone is being asked for right now, in this browser. */
export function findPendingLogin(
  email: string,
  sessionPubkey: string,
): PendingEmailLogin | null {
  const needle = email.trim().toLowerCase();
  const pending = read().pending.find(
    (p) => p.email === needle && p.sessionPubkey === sessionPubkey,
  );
  if (!pending) return null;
  if (new Date(pending.expiresAt).getTime() < Date.now()) return null;
  return pending;
}

export function countFailedAttempt(id: string): number {
  return mutate((db) => {
    const pending = db.pending.find((p) => p.id === id);
    if (!pending) return 0;
    pending.attempts += 1;
    return pending.attempts;
  });
}

export function deletePendingLogin(id: string): void {
  mutate((db) => {
    db.pending = db.pending.filter((p) => p.id !== id);
  });
}

// ── passkey challenges ─────────────────────────────────────────────────────

export function saveChallenge(challenge: PendingChallenge): void {
  mutate((db) => {
    const now = Date.now();
    db.challenges = db.challenges.filter(
      (c) =>
        new Date(c.expiresAt).getTime() > now &&
        !(c.sessionPubkey === challenge.sessionPubkey && c.purpose === challenge.purpose),
    );
    db.challenges.push(challenge);
  });
}

/** Challenges are single use: reading one consumes it. */
export function takeChallenge(
  sessionPubkey: string,
  purpose: PendingChallenge["purpose"],
): string | null {
  return mutate((db) => {
    const index = db.challenges.findIndex(
      (c) => c.sessionPubkey === sessionPubkey && c.purpose === purpose,
    );
    if (index < 0) return null;
    const [challenge] = db.challenges.splice(index, 1);
    if (new Date(challenge.expiresAt).getTime() < Date.now()) return null;
    return challenge.challenge;
  });
}

export function addPasskey(accountId: string, passkey: Passkey): void {
  mutate((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return;
    account.passkeys = [...(account.passkeys ?? []).filter((p) => p.id !== passkey.id), passkey];
  });
}

export function touchPasskey(accountId: string, credentialId: string, counter: number): void {
  mutate((db) => {
    const account = db.accounts.find((a) => a.id === accountId);
    const passkey = account?.passkeys?.find((p) => p.id === credentialId);
    if (!passkey) return;
    passkey.counter = counter;
    passkey.lastUsedAt = new Date().toISOString();
  });
}
