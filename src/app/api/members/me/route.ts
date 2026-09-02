/**
 * The signed-in member's own membership history.
 *
 * GET /api/members/me → their history, or 404
 *
 * The membership id is always derived from the session's email address here.
 * It is never accepted from the caller: an id supplied by the client would let
 * anyone read anyone's history, since the id is the only thing guarding the
 * file.
 *
 * Requires EMAIL_HASH_SALT. Without it this host cannot identify anybody and
 * serves nothing — see @/lib/membership.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  discordIdentifier,
  emailIdentifier,
  memberIdForEmail,
  membershipEnabled,
  readMemberHistory,
  resolveMemberId,
} from "@/lib/membership";

export async function GET() {
  if (!membershipEnabled()) {
    return NextResponse.json(
      { error: "Membership is not configured on this host." },
      { status: 404 }
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hand the resolver every identifier this session carries and take the
  // match. The account id is tried first — it is the durable one, and it is
  // what a linked member is found by — with the session's own email address as
  // the fallback for the majority who subscribed under it and need no link.
  //
  // Nothing here privileges Discord: when Nostr auth lands it contributes
  // `nostr:pubkey:…` to this list and the rest is unchanged.
  const emailHash = memberIdForEmail(session.user.email);
  const memberId = resolveMemberId([
    session.user.discordId ? discordIdentifier(session.user.discordId) : null,
    emailHash ? emailIdentifier(emailHash) : null,
  ]);
  if (memberId === null) {
    return NextResponse.json(
      {
        error: "No membership is connected to this account yet.",
        canLink: true,
      },
      { status: 404 }
    );
  }

  const history = readMemberHistory(memberId);
  if (history === null) {
    // Deliberately the same answer as "no such member": distinguishing them
    // would turn this endpoint into an oracle for whether an address is a
    // member's. `canLink` invites the visitor to prove ownership of the
    // address they subscribed with, which is the way out of both cases.
    return NextResponse.json(
      { error: "No membership is connected to this account yet.", canLink: true },
      { status: 404 }
    );
  }

  return NextResponse.json(history);
}
