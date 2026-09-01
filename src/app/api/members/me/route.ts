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
import { memberIdForEmail, membershipEnabled, readMemberHistory } from "@/lib/membership";

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

  // Discord is asked for the `email` scope at sign-in, but a user can have no
  // verified address, and the provider is free to omit it.
  const memberId = memberIdForEmail(session.user.email);
  if (memberId === null) {
    return NextResponse.json(
      { error: "No email address on this account, so it cannot be matched to a membership." },
      { status: 404 }
    );
  }

  const history = readMemberHistory(memberId);
  if (history === null) {
    // Deliberately the same answer as "no such member": distinguishing them
    // would turn this endpoint into an oracle for whether an address is a
    // member's.
    return NextResponse.json({ error: "No membership found for this account." }, { status: 404 });
  }

  return NextResponse.json(history);
}
