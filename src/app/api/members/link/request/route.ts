/**
 * Step one of linking a paying address to a signed-in account.
 *
 * POST /api/members/link/request { email }
 *
 * Mails a verification code to the address, if — and only if — that address
 * belongs to a member. The response is deliberately the same either way: an
 * endpoint that said "no such member" would let anyone test whether an address
 * belongs to a member, which is precisely the fact the restricted tree exists
 * to protect.
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { auth } from "@/auth";
import {
  discordIdentifier,
  emailIdentifier,
  identifierBelongsToAMember,
  memberIdForEmail,
  membershipEnabled,
} from "@/lib/membership";
import { issueLinkCode, linkingEnabled } from "@/lib/member-link-code";
import { fromSite } from "@/lib/email-address";

/** The same answer whether or not the address matches a member. */
const NEUTRAL = {
  ok: true,
  message: "If that address matches a membership, a code is on its way to it.",
};

export async function POST(request: Request) {
  if (!membershipEnabled() || !linkingEnabled()) {
    return NextResponse.json(
      { error: "Membership linking is not configured on this host." },
      { status: 404 }
    );
  }

  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await request.json().catch(() => ({ email: "" }));
  const address = (email || "").trim();
  if (address === "" || !address.includes("@")) {
    return NextResponse.json({ error: "Enter the email address you subscribed with." }, { status: 400 });
  }

  const hash = memberIdForEmail(address);
  if (hash === null) return NextResponse.json(NEUTRAL);

  const account = discordIdentifier(session.user.discordId);
  const target = emailIdentifier(hash);

  // Only send to an address that actually belongs to a member: this endpoint
  // must not become a way to mail arbitrary people through our domain.
  if (identifierBelongsToAMember(target)) {
    const code = issueLinkCode(account, target);
    if (code !== null) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: fromSite(),
          to: [address],
          subject: `Your Commons Hub membership code: ${code}`,
          text: [
            `Someone signed in to commonshub.brussels as @${session.user.username} and asked to`,
            `link this address to their membership.`,
            ``,
            `Your code is ${code}. It is valid for about fifteen minutes.`,
            ``,
            `If that was not you, ignore this mail — nothing has been linked, and`,
            `nobody can see your membership without this code.`,
          ].join("\n"),
        });
      } catch (error) {
        console.error("[member-link] could not send the verification mail:", error);
      }
    }
  }

  return NextResponse.json(NEUTRAL);
}
