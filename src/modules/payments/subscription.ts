/**
 * The membership subscription, as Stripe knows it. Looked up by the account's
 * email — the same address people subscribed with — and cached briefly.
 */

import Stripe from "stripe";

export interface SubscriptionStatus {
  active: boolean;
  /** "€10 / month" or "€100 / year", when active. */
  plan?: string;
  amount?: number;
  interval?: string;
  renewsAt?: string;
}

const cache = new Map<string, { at: number; value: SubscriptionStatus }>();
const CACHE_TTL_MS = 300_000;

export async function subscriptionForEmail(email: string | null): Promise<SubscriptionStatus> {
  if (!email || !process.env.STRIPE_SECRET_KEY) return { active: false };

  const key = email.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  let value: SubscriptionStatus = { active: false };
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const customers = await stripe.customers.list({ email: key, limit: 5 });
    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 3,
      });
      const subscription = subscriptions.data[0];
      if (!subscription) continue;
      const item = subscription.items.data[0];
      const price = item?.price;
      const amount = (price?.unit_amount ?? 0) / 100;
      const interval = price?.recurring?.interval ?? "month";
      value = {
        active: true,
        amount,
        interval,
        plan: `€${amount} / ${interval}`,
        renewsAt: item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : undefined,
      };
      break;
    }
  } catch (error) {
    console.error("[subscription] Stripe lookup failed:", error);
  }

  cache.set(key, { at: Date.now(), value });
  return value;
}
