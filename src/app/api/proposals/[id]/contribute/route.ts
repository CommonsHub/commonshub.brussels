import { NextResponse } from "next/server";
import { z } from "zod";
import { addContribution, getProposal, setRsvp } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { createEuroCheckout, stripeConfigured } from "@/modules/payments/euro";
import { collectingAddress, tokensConfigured } from "@/modules/payments/tokens";
import { sendFromDiscordUser, cardPaymentsConfigured } from "@/modules/payments/card";
import { maxTokenContribution } from "@/modules/payments/chain";
import { splitEuroContribution, splitTokenContribution } from "@/modules/proposals/funding";

const schema = z.object({
  currency: z.enum(["eur", "tokens"]),
  kind: z.enum(["ticket", "donation"]),
  amount: z.number().positive().max(100_000),
  seats: z.number().int().min(0).max(50).default(1),
});

function baseUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
}

/**
 * Start a contribution. Euros go through Stripe; tokens come back as a payment
 * request the contributor completes in Discord, which we then confirm on chain.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) {
    return NextResponse.json({ error: "Sign in so we can put your name on it." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That amount does not look right." }, { status: 400 });
  }

  const { id } = await context.params;
  const proposal = getProposal(id);
  if (!proposal) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });

  const { currency, kind, amount, seats } = parsed.data;

  if (currency === "tokens") {
    const cap = maxTokenContribution();
    if (cap !== null && amount > cap) {
      return NextResponse.json(
        { error: `Contributions are capped at ${cap} tokens on this deployment.` },
        { status: 400 },
      );
    }

    if (!caller.account.discordId) {
      // Their tokens live in the account derived from their Discord id — we
      // cannot move what we cannot locate.
      return NextResponse.json(
        { error: "Connect your Discord account first — that is where your tokens live.", needsDiscord: true },
        { status: 409 },
      );
    }

    if (!cardPaymentsConfigured() || !tokensConfigured()) {
      return NextResponse.json(
        { error: "Token payments are not switched on for this deployment yet." },
        { status: 503 },
      );
    }

    const to = await collectingAddress(proposal.id);
    if (!to) {
      return NextResponse.json(
        { error: "This proposal has nowhere to collect into yet." },
        { status: 503 },
      );
    }

    // Same mechanism as the bot's /send, without the round-trip through Discord.
    const transfer = await sendFromDiscordUser({
      discordId: caller.account.discordId,
      to,
      amount,
      description: `${kind === "ticket" ? "Ticket" : "Contribution"} — ${proposal.title} (#${proposal.number})`,
    });
    if (!transfer.ok) return NextResponse.json({ error: transfer.error }, { status: 502 });

    const split = splitTokenContribution(amount);
    const contribution = addContribution(proposal.id, {
      kind,
      currency: "tokens",
      grossAmount: split.charged,
      adminFee: 0,
      netAmount: split.net,
      contributorId: caller.account.id,
      contributorName: caller.account.displayName,
      seats: kind === "ticket" ? seats : 0,
      reference: transfer.txHash,
      fromAddress: transfer.from,
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

    return NextResponse.json({ contribution, explorerUrl: transfer.explorerUrl });
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Card payments are not switched on for this deployment yet." },
      { status: 503 },
    );
  }

  const origin = baseUrl(request);
  const result = await createEuroCheckout({
    proposalId: proposal.id,
    proposalTitle: proposal.title,
    amount,
    kind,
    seats,
    contributorId: caller.account.id,
    contributorEmail: caller.account.email,
    successUrl: `${origin}/api/proposals/${proposal.id}/contribute/return?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/proposals/${proposal.number}?payment=cancelled`,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({
    checkoutUrl: result.url,
    breakdown: splitEuroContribution(amount),
  });
}
