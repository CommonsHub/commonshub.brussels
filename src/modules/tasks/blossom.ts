/**
 * Photo storage, the way tasklist.sh does it: Blossom.
 *
 * A file is addressed by the hash of its bytes and uploaded with a signed
 * authorisation event (kind 24242). We sign it server-side with the account
 * key, which keeps the same custody story as everything else — the browser
 * hands us a file, not a key.
 */

import * as crypto from "crypto";
import type { Event, EventTemplate } from "nostr-tools/pure";

export const BLOSSOM_URL = (process.env.BLOSSOM_URL || "https://blossom.primal.net").replace(
  /\/$/,
  "",
);

export const KIND_BLOSSOM_AUTH = 24242;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface UploadedFile {
  url: string;
  mime: string;
  name: string;
}

export type Signer = (template: EventTemplate) => Promise<Event> | Event;

function base64(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64");
}

/**
 * Upload one file and return where it landed. The hash is the address, so the
 * same photo uploaded twice is the same URL.
 */
export async function uploadToBlossom(
  file: { bytes: Uint8Array; mime: string; name: string },
  sign: Signer,
): Promise<UploadedFile> {
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("That file is too big — 10 MB is the limit.");
  }

  const hash = crypto.createHash("sha256").update(file.bytes).digest("hex");
  const now = Math.floor(Date.now() / 1000);

  const auth = await sign({
    kind: KIND_BLOSSOM_AUTH,
    created_at: now,
    tags: [
      ["t", "upload"],
      ["x", hash],
      ["expiration", String(now + 600)],
    ],
    content: `Upload ${file.name || "file"}`,
  });

  const response = await fetch(`${BLOSSOM_URL}/upload`, {
    method: "PUT",
    headers: {
      Authorization: `Nostr ${base64(JSON.stringify(auth))}`,
      "Content-Type": file.mime || "application/octet-stream",
    },
    body: Buffer.from(file.bytes),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`The photo could not be stored (${response.status}). ${detail}`.trim());
  }

  let url: string | null = null;
  try {
    url = ((await response.json()) as { url?: string }).url ?? null;
  } catch {
    url = null;
  }

  return {
    url: url || `${BLOSSOM_URL}/${hash}`,
    mime: file.mime || "application/octet-stream",
    name: file.name || "file",
  };
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}
