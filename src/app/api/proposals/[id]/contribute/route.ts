import { NextResponse } from "next/server";
import { z } from "zod";
import { getProposal } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { createEuroCheckout, stripeConfigured } from "@/modules/payments/euro";
import { buildPaymentRequest, tokensConfigured } from "@/modules/payments/tokens";
import { splitEuroContribution } from "@/modules/proposals/funding";

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
    if (!tokensConfigured()) {
      return NextResponse.json(
        { error: "Token payments are not switched on for this deployment yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ tokenRequest: await buildPaymentRequest(amount, proposal.id) });
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
