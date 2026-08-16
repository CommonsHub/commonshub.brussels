/**
 * Accounts, sessions and pending email links, stored as JSON next to the
 * proposals. Small enough that a file is the right database, and easy to move
 * behind a real one later — everything goes through the functions below.
 */

import * as fs from "fs";
import * as path from "path";
import { identityDir } from "./crypto";

export type Role = "guest" | "member" | "steward";

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
  token: string;
  email: string;
  sessionPubkey: string;
  createdAt: string;
  expiresAt: string;
}

interface Db {
  accounts: Account[];
  sessions: Session[];
  pending: PendingEmailLogin[];
}

const EMPTY: Db = { accounts: [], sessions: [], pending: [] };

function dbPath(): string {
  return path.join(identityDir(), "identity.json");
}

function read(): Db {
  const file = dbPath();
  if (!fs.existsSync(file)) return { ...EMPTY };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<Db>;
    return {
      accounts: parsed.accounts ?? [],
      sessions: parsed.sessions ?? [],
      pending: parsed.pending ?? [],
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

export function findAccountByEmail(email: string): Account | null {
  const needle = email.trim().toLowerCase();
  return read().accounts.find((a) => a.email === needle) ?? null;
}

export function findAccountByDiscordId(discordId: string): Account | null {
  return read().accounts.find((a) => a.discordId === discordId) ?? null;
}

export function findAccount(id: string): Account | null {
  return read().accounts.find((a) => a.id === id) ?? null;
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
    db.pending = db.pending.filter((p) => new Date(p.expiresAt).getTime() > now);
    db.pending.push(pending);
  });
}

export function takePendingLogin(token: string): PendingEmailLogin | null {
  return mutate((db) => {
    const index = db.pending.findIndex((p) => p.token === token);
    if (index < 0) return null;
    const [pending] = db.pending.splice(index, 1);
    if (new Date(pending.expiresAt).getTime() < Date.now()) return null;
    return pending;
  });
}
