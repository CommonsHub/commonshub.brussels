"use client";

/**
 * Browser half of the identity module.
 *
 * When a session starts, this generates a key here, in this tab, and keeps it
 * in sessionStorage. It is used only to sign requests, so the server can tell
 * that a request really comes from the browser that signed in. It is never
 * uploaded, and closing the session leaves nothing behind to steal.
 */

import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";

const STORAGE_KEY = "chb.session.key";

function loadOrCreateSecret(): Uint8Array {
  if (typeof window === "undefined") throw new Error("Sessions only exist in the browser.");
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (stored && /^[0-9a-f]{64}$/.test(stored)) return hexToBytes(stored);
  const secret = generateSecretKey();
  window.sessionStorage.setItem(STORAGE_KEY, bytesToHex(secret));
  return secret;
}

export function sessionPubkey(): string {
  return getPublicKey(loadOrCreateSecret());
}

/** Start a fresh session key — used when signing out. */
export function resetSessionKey(): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(STORAGE_KEY);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Sign a small event that commits to the request body. */
export async function signEnvelope(payload: unknown) {
  const secret = loadOrCreateSecret();
  const hash = await sha256Hex(JSON.stringify(payload ?? null));
  return finalizeEvent(
    {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["payload", hash]],
      content: "",
    },
    secret,
  );
}

/** POST with proof that this browser holds the session key. */
export async function postSigned<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const envelope = await signEnvelope(body);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, envelope }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "That did not work. Try again.");
  return data as T;
}

export interface Me {
  id: string;
  displayName: string;
  email: string | null;
  discordId: string | null;
  roles: string[];
  isMember: boolean;
  isSteward: boolean;
  hasEmail: boolean;
  hasDiscord: boolean;
  hasPasskey: boolean;
}

// ── passkeys ───────────────────────────────────────────────────────────────

/** Does this browser do passkeys at all? */
export function passkeysSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

/** Set one up for the account that is signed in. */
export async function registerPasskey(): Promise<string> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const pubkey = sessionPubkey();

  const optionsResponse = await fetch("/api/identity/passkey/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionPubkey: pubkey }),
  });
  const optionsData = await optionsResponse.json();
  if (!optionsResponse.ok) throw new Error(optionsData?.error || "We could not start that.");

  const response = await startRegistration({ optionsJSON: optionsData.options });

  const verifyResponse = await fetch("/api/identity/passkey/register", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionPubkey: pubkey, response }),
  });
  const verified = await verifyResponse.json();
  if (!verifyResponse.ok) throw new Error(verified?.error || "That passkey did not save.");
  return verified.label as string;
}

/** Sign in with whatever passkey this browser holds for the hub. */
export async function signInWithPasskey(): Promise<Me> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const pubkey = sessionPubkey();

  const optionsResponse = await fetch("/api/identity/passkey/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionPubkey: pubkey }),
  });
  const optionsData = await optionsResponse.json();
  if (!optionsResponse.ok) throw new Error(optionsData?.error || "We could not start that.");

  const response = await startAuthentication({ optionsJSON: optionsData.options });

  const verifyResponse = await fetch("/api/identity/passkey/login", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionPubkey: pubkey, response }),
  });
  const verified = await verifyResponse.json();
  if (!verifyResponse.ok) throw new Error(verified?.error || "That passkey did not work.");
  return verified.account as Me;
}

// ── linking ────────────────────────────────────────────────────────────────

/** Add an email address to an account that came in through Discord. */
export async function linkEmail(email: string, code: string): Promise<Me> {
  const response = await fetch("/api/identity/link/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, sessionPubkey: sessionPubkey() }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "We could not link that address.");
  return data.account as Me;
}

export async function fetchMe(): Promise<Me | null> {
  const response = await fetch("/api/identity/me", { cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json();
  return data.account ?? null;
}

/** Ask for a sign-in code. The session key registered here is what it unlocks. */
export async function requestEmailCode(email: string): Promise<void> {
  const response = await fetch("/api/identity/login/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, sessionPubkey: sessionPubkey() }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "We could not send that code.");
}

/** Hand back the code that was emailed. Only valid in this browser. */
export async function submitEmailCode(email: string, code: string): Promise<Me> {
  const response = await fetch("/api/identity/login/email/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, sessionPubkey: sessionPubkey() }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "That code did not work.");
  return data.account as Me;
}

/**
 * After signing in with Discord, hand this browser's session key to the server.
 * Throws with the server's reason so the page can say what went wrong rather
 * than spinning.
 */
export async function linkDiscordSession(): Promise<Me> {
  const response = await fetch("/api/identity/login/discord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionPubkey: sessionPubkey() }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.account) {
    throw new Error(data?.error || "We could not finish signing you in with Discord.");
  }
  return data.account as Me;
}

export async function signOut(): Promise<void> {
  await fetch("/api/identity/logout", { method: "POST" });
  resetSessionKey();
}
