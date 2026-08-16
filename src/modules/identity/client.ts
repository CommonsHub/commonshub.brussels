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
}

export async function fetchMe(): Promise<Me | null> {
  const response = await fetch("/api/identity/me", { cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json();
  return data.account ?? null;
}

/** Ask for a sign-in link. The session key registered here is what it unlocks. */
export async function requestEmailLink(email: string, next?: string): Promise<void> {
  const response = await fetch("/api/identity/login/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, sessionPubkey: sessionPubkey(), next }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "We could not send that link.");
}

/** After signing in with Discord, hand this browser's session key to the server. */
export async function linkDiscordSession(): Promise<Me | null> {
  const response = await fetch("/api/identity/login/discord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionPubkey: sessionPubkey() }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.account ?? null;
}

export async function signOut(): Promise<void> {
  await fetch("/api/identity/logout", { method: "POST" });
  resetSessionKey();
}
