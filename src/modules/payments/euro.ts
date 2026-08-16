/**
 * Paying in euros, through Stripe.
 *
 * Every euro contribution carries the hub's 10% admin fee. Card fees are
 * Stripe's and are separate — the admin fee is the hub's own, for the work of
 * running the booking, the invoice and the books.
 */

import Stripe from "stripe";
import { adminFeeMode, splitEuroContribution, formatEur } from "@/modules/proposals/funding";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

export interface EuroCheckoutRequest {
  proposalId: string;
  proposalTitle: string;
  /** Headline amount: the ticket price, or the donation someone typed in. */
  amount: number;
  kind: "ticket" | "donation";
  seats: number;
  contributorId: string;
  contributorEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export type CheckoutResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; error: string };

/**
 * Build the checkout. The fee is always a line the payer can see: either added
 * on top, or named inside the price — never silent.
 */
export async function createEuroCheckout(request: EuroCheckoutRequest): Promise<CheckoutResult> {
  const client = stripe();
  if (!client) {
    return { ok: false, error: "Card payments are not switched on for this deployment yet." };
  }

  const split = splitEuroContribution(request.amount);
  const onTop = adminFeeMode() === "on_top";

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: Math.round((onTop ? request.amount : split.charged) * 100),
        product_data: {
          name:
            request.kind === "ticket"
              ? `Ticket — ${request.proposalTitle}`
              : `Contribution — ${request.proposalTitle}`,
          description: onTop
            ? undefined
            : `Includes ${formatEur(split.adminFee)} hub admin fee (10%)`,
        },
      },
    },
  ];

  if (onTop) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: Math.round(split.adminFee * 100),
        product_data: { name: "Hub admin fee (10%)" },
      },
    });
  }

  try {
    const session = await client.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: request.contributorEmail ?? undefined,
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      metadata: {
        proposalId: request.proposalId,
        contributorId: request.contributorId,
        kind: request.kind,
        seats: String(request.seats),
        gross: String(split.charged),
        adminFee: String(split.adminFee),
        net: String(split.net),
      },
    });

    if (!session.url) return { ok: false, error: "Stripe did not return a checkout link." };
    return { ok: true, url: session.url, sessionId: session.id };
  } catch (error) {
    console.error("[payments] Stripe checkout failed:", error);
    return { ok: false, error: "We could not start the payment. Try again in a moment." };
  }
}

export async function retrieveCheckout(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  const client = stripe();
  if (!client) return null;
  try {
    return await client.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error("[payments] could not read the checkout session:", error);
    return null;
  }
}
