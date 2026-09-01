/**
 * Membership identity.
 *
 * A member's id is a salted hash of their email address, minted by chb:
 *
 *     sha256(lowercase(trim(email)) + EMAIL_HASH_SALT)
 *
 * chb writes that id into every monthly members.json and uses it to name each
 * member's history file. This module reproduces the same hash so a signed-in
 * visitor can be recognised as the member they are, without the site ever
 * holding a list of member email addresses.
 *
 * The salt is the identity. It has to be byte-identical to the one chb syncs
 * with, and it must never be rotated: a new salt re-identifies the entire
 * membership, and nothing links the old ids to the new ones. It is deliberately
 * excluded from chb's mirror sync, so it is copied between hosts by hand.
 *
 * When EMAIL_HASH_SALT is absent this host cannot identify anybody, and the
 * whole membership surface stays off rather than degrading to something
 * half-working. See `membershipEnabled`.
 *
 * Member data is read only from chb's `restricted/` tree. Its `private/` tree
 * is never served under any condition — see `memberHistoryPath`.
 */

import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import type { MemberHistory } from "@/types/members";

/** A membership id is a bare sha256 digest — 64 lowercase hex characters. */
const MEMBER_ID_PATTERN = /^[0-9a-f]{64}$/;

/**
 * chb writes two kinds of non-public output, and they are not the same
 * promise:
 *
 *   - `private/`    — served to nobody, ever. Operator-only material.
 *   - `restricted/` — served, but only to the person it describes, and only
 *                     once they have proved who they are.
 *
 * Member histories live in `restricted/`. `private/` is never read by this
 * application; `assertNotPrivate` below makes that a property of the code
 * rather than a habit.
 */
const RESTRICTED_MEMBERS_DIR = ["latest", "generated", "restricted", "members"];

/**
 * The configured salt, or null when this host has none. Read on every call
 * rather than cached at module load, so a restart is all it takes to change
 * the deployment's mind.
 */
export function membershipSalt(): string | null {
  const salt = (process.env.EMAIL_HASH_SALT || "").trim();
  return salt === "" ? null : salt;
}

/**
 * Whether this host can do membership at all. Without the salt every id it
 * computed would be wrong, so no member data is served — the roster included.
 */
export function membershipEnabled(): boolean {
  return membershipSalt() !== null;
}

/**
 * The membership id for an email address, or null when the host has no salt or
 * the address is empty. Must stay in lockstep with chb's `hashEmail`.
 */
export function memberIdForEmail(email: string | null | undefined): string | null {
  const salt = membershipSalt();
  if (salt === null) return null;

  const normalized = (email || "").trim().toLowerCase();
  if (normalized === "") return null;

  return createHash("sha256").update(normalized + salt).digest("hex");
}

/**
 * Absolute path of a member's history file, or null when the id is not a
 * well-formed digest. The id reaches this function from a hash we computed
 * ourselves, but it is validated regardless: it becomes a filename, and a
 * value that is never trusted cannot be used to walk out of the directory.
 *
 * The result is additionally refused if it lands anywhere under `private/`.
 */
export function memberHistoryPath(memberId: string): string | null {
  const id = (memberId || "").trim().toLowerCase();
  if (!MEMBER_ID_PATTERN.test(id)) return null;

  const file = path.join(DATA_DIR, ...RESTRICTED_MEMBERS_DIR, `${id}.json`);
  return assertNotPrivate(file);
}

/**
 * Returns the path unless it lies under a `private/` segment, in which case
 * null. Nothing this application serves may come from private/, so the rule is
 * enforced at the only point that turns an id into a file to read — a
 * mistyped constant or a future caller cannot quietly opt out of it.
 */
function assertNotPrivate(file: string): string | null {
  const segments = path.resolve(file).split(path.sep);
  return segments.includes("private") ? null : file;
}

/**
 * A member's history, or null when this host has no salt, the id is malformed,
 * or no such member exists. The three are deliberately indistinguishable to a
 * caller: an endpoint that answered differently for "no such member" would let
 * anyone test whether a given email belongs to a member.
 */
export function readMemberHistory(memberId: string): MemberHistory | null {
  if (!membershipEnabled()) return null;

  const file = memberHistoryPath(memberId);
  if (file === null) return null;

  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as MemberHistory;
  } catch {
    return null;
  }
}
