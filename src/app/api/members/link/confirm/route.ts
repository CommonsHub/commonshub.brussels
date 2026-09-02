/**
 * Step two: the member returns the code from their mailbox, which proves they
 * own the address.
 *
 * POST /api/members/link/confirm { email, code }
 *
 * The website cannot record the link itself — it is a read-only view of the
 * dataset (tests/no-server-writes.test.ts) — so a verified link is mailed to
 * the stewards as a ready-to-apply entry for chb's settings/member-links.json,
 * and the member is told it is pending. Automating that last hop is issue #35.
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
import { linkingEnabled, verifyLinkCode } from "@/lib/member-link-code";
import { fromSite } from "@/lib/email-address";

const STEWARDS = process.env.MEMBERSHIP_STEWARD_EMAIL || "hello@commonshub.brussels";

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

  const { email, code } = await request.json().catch(() => ({}));
  const address = (email || "").trim();
  const hash = memberIdForEmail(address);
  if (hash === null) {
    return NextResponse.json({ error: "That code did not match." }, { status: 400 });
  }

  const account = discordIdentifier(session.user.discordId);
  const target = emailIdentifier(hash);

  // Both must hold. The code proves the mailbox; the membership check stops a
  // verified non-member from being written into the links file.
  if (!verifyLinkCode(account, target, code) || !identifierBelongsToAMember(target)) {
    // One message for both failures: which of the two failed is itself a fact
    // about whether the address is a member's.
    return NextResponse.json({ error: "That code did not match, or it has expired." }, { status: 400 });
  }

  const entry = {
    identifiers: [account, target],
    note: `Verified by @${session.user.username} on ${new Date().toISOString().slice(0, 10)} via the website`,
  };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: fromSite(),
      to: [STEWARDS],
      subject: `Membership link verified: @${session.user.username}`,
      text: [
        `@${session.user.username} proved they can read the mailbox of the address`,
        `they subscribed with, so these two identifiers belong to one member.`,
        ``,
        `Add to settings/member-links.json in chb, then run:`,
        `  chb generate --history --force`,
        ``,
        JSON.stringify(entry, null, 2),
        ``,
        `The address itself is deliberately not in this mail — the hash is the`,
        `identifier chb uses, and it is all that is needed.`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("[member-link] could not mail the verified link:", error);
    return NextResponse.json(
      { error: "Your address is verified, but we could not notify the stewards. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    pending: true,
    identifiers: entry.identifiers,
    message:
      "Address verified. A steward will connect it to your account shortly — your membership will appear here once they have.",
  });
}
