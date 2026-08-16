/**
 * Key handling for the identity module.
 *
 * Two kinds of secret exist, and neither ever crosses the wire:
 *
 *   • The account key — created on the server the first time someone signs in,
 *     encrypted at rest, used to sign on their behalf. It never leaves the
 *     server, so there is no key for a phishing page or a stolen laptop to take.
 *   • The session key — generated in the browser each time a session starts,
 *     kept in that tab, never sent anywhere. It proves that a request comes
 *     from the device the session was opened on.
 *
 * So each private key stays on the machine that generated it, and the server
 * only signs for a browser that can prove it holds the session key it
 * registered.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  verifyEvent,
  type Event,
  type EventTemplate,
} from "nostr-tools/pure";

const ALGORITHM = "aes-256-gcm";

/**
 * The key that encrypts account keys at rest. Set IDENTITY_ENCRYPTION_KEY (64
 * hex chars) in production. Without it we generate one next to the data and
 * keep it 0600, so a fresh deployment works but the operator is told.
 */
function encryptionKey(): Buffer {
  const fromEnv = process.env.IDENTITY_ENCRYPTION_KEY;
  if (fromEnv && /^[0-9a-f]{64}$/i.test(fromEnv)) {
    return Buffer.from(fromEnv, "hex");
  }

  const keyFile = path.join(identityDir(), "encryption.key");
  if (fs.existsSync(keyFile)) {
    return Buffer.from(fs.readFileSync(keyFile, "utf-8").trim(), "hex");
  }

  console.warn(
    "[identity] IDENTITY_ENCRYPTION_KEY is not set — generating one at %s. " +
      "Set it in the environment before this deployment holds anything you care about.",
    keyFile,
  );
  const key = crypto.randomBytes(32);
  fs.mkdirSync(identityDir(), { recursive: true });
  fs.writeFileSync(keyFile, key.toString("hex"), { mode: 0o600 });
  return key;
}

export function identityDir(): string {
  return process.env.IDENTITY_DIR || path.join(process.cwd(), ".data", "identity");
}

export function encryptSecret(secret: Uint8Array): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(secret)), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(stored: string): Uint8Array {
  const [ivHex, tagHex, dataHex] = stored.split(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return new Uint8Array(decrypted);
}

export function newAccountKey(): { secret: string; pubkey: string } {
  const secret = generateSecretKey();
  return { secret: encryptSecret(secret), pubkey: getPublicKey(secret) };
}

/** Sign an event with an account's key. The key is decrypted, used, discarded. */
export function signWithAccountKey(storedSecret: string, template: EventTemplate): Event {
  const secret = decryptSecret(storedSecret);
  try {
    return finalizeEvent(template, secret);
  } finally {
    secret.fill(0);
  }
}

/**
 * Verify the envelope a browser signs with its session key before we sign
 * anything on its behalf. The envelope commits to the request body, so a
 * captured envelope cannot be replayed against different content.
 */
export function verifySessionEnvelope(
  envelope: Event,
  expected: { sessionPubkey: string; bodyHash: string; maxAgeSeconds?: number },
): { ok: true } | { ok: false; reason: string } {
  if (envelope.pubkey !== expected.sessionPubkey) {
    return { ok: false, reason: "This request was signed by a different session." };
  }
  if (!verifyEvent(envelope)) {
    return { ok: false, reason: "The signature on this request is not valid." };
  }
  const hashTag = envelope.tags.find((t) => t[0] === "payload");
  if (!hashTag || hashTag[1] !== expected.bodyHash) {
    return { ok: false, reason: "This request does not match what was signed." };
  }
  const age = Math.floor(Date.now() / 1000) - envelope.created_at;
  const maxAge = expected.maxAgeSeconds ?? 300;
  if (age > maxAge || age < -60) {
    return { ok: false, reason: "This request has expired. Try again." };
  }
  return { ok: true };
}

export function hashBody(body: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

export function randomToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** A six-digit code, uniformly drawn — no Math.random, no modulo bias. */
export function randomCode(): string {
  const limit = 1_000_000;
  const max = Math.floor(0xffffffff / limit) * limit;
  let value: number;
  do {
    value = crypto.randomBytes(4).readUInt32BE(0);
  } while (value >= max);
  return String(value % limit).padStart(6, "0");
}

/**
 * Codes are stored hashed and salted with the session they were issued to, so
 * the file never holds a code anyone could use, and a code only means anything
 * to the browser that asked for it.
 */
export function hashCode(code: string, sessionPubkey: string): string {
  return crypto.createHash("sha256").update(`${sessionPubkey}:${code}`).digest("hex");
}

export function codeMatches(code: string, sessionPubkey: string, expected: string): boolean {
  const actual = Buffer.from(hashCode(code, sessionPubkey), "hex");
  const wanted = Buffer.from(expected, "hex");
  if (actual.length !== wanted.length) return false;
  return crypto.timingSafeEqual(actual, wanted);
}

export { getPublicKey };
