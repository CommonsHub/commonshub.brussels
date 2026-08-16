import { NextResponse } from "next/server";
import { z } from "zod";
import { addContribution, getProposal, setRsvp } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { findIncomingTransfer } from "@/modules/payments/tokens";
import { maxTokenContribution } from "@/modules/payments/chain";
import { splitTokenContribution } from "@/modules/proposals/funding";

const schema = z.object({
  amount: z.number().positive(),
  kind: z.enum(["ticket", "donation"]),
  seats: z.number().int().min(0).max(50).default(1),
});

/**
 * "I've sent it." Look for the transfer on chain — the amount carries a few
 * unique digits, so a match is unambiguous — and record the contribution.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That amount does not look right." }, { status: 400 });
  }

  const { id } = await context.params;
  const proposal = getProposal(id);
  if (!proposal) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });

  const { amount, kind, seats } = parsed.data;

  const cap = maxTokenContribution();
  if (cap !== null && amount > cap) {
    return NextResponse.json(
      { error: `Contributions are capped at ${cap} tokens on this deployment.` },
      { status: 400 },
    );
  }

  let match;
  try {
    match = await findIncomingTransfer(amount, { proposalId: proposal.id });
  } catch (error) {
    console.error("[contribute] could not read the chain:", error);
    return NextResponse.json(
      { error: "We could not reach the chain to check. Try again in a minute." },
      { status: 502 },
    );
  }

  if (!match.found) {
    return NextResponse.json(
      {
        error:
          "We cannot see that transfer yet. It can take a few seconds — try again, and check the amount matches exactly.",
      },
      { status: 404 },
    );
  }

  if (proposal.contributions.some((c) => c.reference === match.txHash)) {
    return NextResponse.json({ error: "That payment is already recorded." }, { status: 409 });
  }

  const split = splitTokenContribution(amount);
  const contribution = addContribution(proposal.id, {
    kind,
    currency: "tokens",
    grossAmount: split.charged,
    adminFee: 0,
    netAmount: split.net,
    contributorId: caller.account.id,
    contributorName: caller.account.displayName,
    seats,
    reference: match.txHash,
    // Kept so a refund can go back to exactly where it came from.
    fromAddress: match.from,
  });

  if (kind === "ticket" && seats > 0) {
    setRsvp(proposal.id, {
      contributorId: caller.account.id,
      name: caller.account.displayName,
      state: "going",
      seats,
      contributionId: contribution?.id,
    });
  }

  return NextResponse.json({ contribution, explorerUrl: match.explorerUrl });
}
