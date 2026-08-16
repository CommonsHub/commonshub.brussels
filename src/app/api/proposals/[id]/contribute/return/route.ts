import { NextResponse } from "next/server";
import { addContribution, getProposal, setRsvp } from "@/modules/proposals/store";
import { retrieveCheckout } from "@/modules/payments/euro";
import { splitEuroContribution } from "@/modules/proposals/funding";
import { findAccount } from "@/modules/identity/store";

/** Stripe sends the payer back here. Record the contribution, then show them the thread. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const { id } = await context.params;
  const proposal = getProposal(id);

  if (!proposal) return NextResponse.redirect(new URL("/events/proposals", url.origin));
  const proposalUrl = new URL(`/events/proposals/${proposal.slug}`, url.origin);

  if (!sessionId) {
    proposalUrl.searchParams.set("payment", "unknown");
    return NextResponse.redirect(proposalUrl);
  }

  const session = await retrieveCheckout(sessionId);
  if (!session || session.payment_status !== "paid") {
    proposalUrl.searchParams.set("payment", "pending");
    return NextResponse.redirect(proposalUrl);
  }

  // Stripe replays the success URL on refresh; only record the first arrival.
  const already = proposal.contributions.some((c) => c.reference === session.id);
  if (already) {
    proposalUrl.searchParams.set("payment", "recorded");
    return NextResponse.redirect(proposalUrl);
  }

  const metadata = session.metadata ?? {};
  const contributorId = metadata.contributorId ?? "anonymous";
  const account = findAccount(contributorId);
  const gross = Number(metadata.gross ?? (session.amount_total ?? 0) / 100);
  const split = splitEuroContribution(
    Number(metadata.net ?? gross) + Number(metadata.adminFee ?? 0),
  );
  const seats = Number(metadata.seats ?? 1);
  const kind = metadata.kind === "donation" ? "donation" : "ticket";

  addContribution(proposal.id, {
    kind,
    currency: "eur",
    grossAmount: gross,
    adminFee: Number(metadata.adminFee ?? split.adminFee),
    netAmount: Number(metadata.net ?? split.net),
    contributorId,
    contributorName: account?.displayName ?? "Someone",
    seats,
    reference: session.id,
  });

  if (kind === "ticket" && seats > 0) {
    setRsvp(proposal.id, {
      contributorId,
      name: account?.displayName ?? "Someone",
      state: "going",
      seats,
    });
  }

  proposalUrl.searchParams.set("payment", "thanks");
  return NextResponse.redirect(proposalUrl);
}
