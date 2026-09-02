/**
 * Verification codes for linking an address to a signed-in account.
 *
 * A member who pays with one address and signs in with another has to prove
 * they own the paying address before it is linked — otherwise anyone who
 * guesses a member's email inherits their payment history. The proof is the
 * ordinary one: a code is mailed to that address, and only someone who can
 * read that mailbox can return it.
 *
 * The codes are **stateless**. The website is a read-only view of the dataset
 * (see tests/no-server-writes.test.ts) and has nowhere to keep a table of
 * pending verifications, so a code is a truncated HMAC over the pair being
 * linked and a coarse time window. Nothing is stored, and a code is only valid
 * for the one account and address it was issued for.
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * How long a code stays valid. Codes are bucketed into windows of this length
 * and the previous window is also accepted, so a code lives between one and
 * two windows depending on when in the window it was issued — long enough to
 * find the mail, short enough that a guessed code is not worth grinding for.
 */
const WINDOW_MS = 15 * 60 * 1000;

/** Six digits: enough to be inconvenient to guess within two windows. */
const CODE_DIGITS = 6;

export function linkSecret(): string | null {
  const secret = (process.env.MEMBER_LINK_SECRET || "").trim();
  return secret === "" ? null : secret;
}

/** Whether this host can run the linking flow at all. */
export function linkingEnabled(): boolean {
  return linkSecret() !== null;
}

function codeForWindow(secret: string, accountIdentifier: string, emailIdentifier: string, window: number): string {
  const mac = createHmac("sha256", secret)
    .update(`${accountIdentifier}|${emailIdentifier}|${window}`)
    .digest();
  // Standard truncation: take 31 bits so the value is positive, then reduce.
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return (binary % 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, "0");
}

/**
 * Issues the current code for an (account, address) pair. Returns null when
 * the host has no secret configured.
 */
export function issueLinkCode(
  accountIdentifier: string,
  emailIdentifier: string,
  now: number = Date.now()
): string | null {
  const secret = linkSecret();
  if (secret === null) return null;
  return codeForWindow(secret, accountIdentifier, emailIdentifier, Math.floor(now / WINDOW_MS));
}

/**
 * Verifies a submitted code against the current and previous window, so a code
 * issued moments before a window boundary still works.
 *
 * The comparison is constant-time. The window is small and the code is short,
 * so leaking "how much of it was right" through timing is worth avoiding even
 * though the practical risk is slight.
 */
export function verifyLinkCode(
  accountIdentifier: string,
  emailIdentifier: string,
  submitted: string,
  now: number = Date.now()
): boolean {
  const secret = linkSecret();
  if (secret === null) return false;

  const candidate = (submitted || "").trim();
  if (!/^\d{6}$/.test(candidate)) return false;

  const current = Math.floor(now / WINDOW_MS);
  for (const window of [current, current - 1]) {
    const expected = codeForWindow(secret, accountIdentifier, emailIdentifier, window);
    const a = Buffer.from(expected);
    const b = Buffer.from(candidate);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}
