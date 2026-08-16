/**
 * Giving the money back.
 *
 * A proposal that never gathers what it needs does not happen, and everyone
 * gets their contribution back in the currency they gave it. Euros go back
 * through Stripe; tokens are sent from the proposal's own wallet to the address
 * they came from.
 *
 * Every attempt is reported, including the ones that fail, because a refund
 * that quietly did not happen is the worst outcome here.
 */

import Stripe from "stripe";
import { encodeFunctionData, parseAbi, parseUnits } from "viem";
import type { Contribution } from "@/modules/proposals/types";
import { execFromSafe, predictSafeAddress, safesConfigured } from "./safe";
import { EXPLORER_URL, TOKEN_ADDRESS, TOKEN_DECIMALS, publicClient } from "./chain";

export interface RefundResult {
  contributionId: string;
  contributorId: string;
  contributorName: string;
  currency: "eur" | "tokens";
  amount: number;
  ok: boolean;
  reference?: string;
  explorerUrl?: string;
  error?: string;
}

const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
]);

// ── euros ──────────────────────────────────────────────────────────────────

async function refundEuro(contribution: Contribution): Promise<RefundResult> {
  const base: RefundResult = {
    contributionId: contribution.id,
    contributorId: contribution.contributorId,
    contributorName: contribution.contributorName,
    currency: "eur",
    amount: contribution.grossAmount,
    ok: false,
  };

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ...base, error: "Card payments are not configured here." };
  if (!contribution.reference) return { ...base, error: "No payment reference to refund against." };

  try {
    const stripe = new Stripe(key);
    // The reference is the checkout session; the refund needs its payment intent.
    const session = await stripe.checkout.sessions.retrieve(contribution.reference);
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntent) return { ...base, error: "That payment has no intent to refund." };

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntent,
      // The full amount the payer handed over, admin fee included: they are
      // not the ones who should carry the cost of an event that did not run.
      reason: "requested_by_customer",
    });

    return { ...base, ok: true, reference: refund.id };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : "Stripe refused the refund." };
  }
}

// ── tokens ─────────────────────────────────────────────────────────────────

async function refundTokens(
  proposalId: string,
  contribution: Contribution,
): Promise<RefundResult> {
  const base: RefundResult = {
    contributionId: contribution.id,
    contributorId: contribution.contributorId,
    contributorName: contribution.contributorName,
    currency: "tokens",
    amount: contribution.grossAmount,
    ok: false,
  };

  if (!safesConfigured()) {
    return { ...base, error: "Proposal Safes are not configured here." };
  }
  if (!contribution.fromAddress) {
    return { ...base, error: "We do not know which address that came from." };
  }

  try {
    const safe = await predictSafeAddress(proposalId);
    const amount = parseUnits(contribution.grossAmount.toFixed(TOKEN_DECIMALS), TOKEN_DECIMALS);

    const held = await publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: erc20,
      functionName: "balanceOf",
      args: [safe],
    });
    if (held < amount) {
      return { ...base, error: "This proposal no longer holds that much." };
    }

    // Deploys the Safe if this is the first time money leaves it.
    const hash = await execFromSafe({
      proposalId,
      to: TOKEN_ADDRESS,
      data: encodeFunctionData({
        abi: erc20,
        functionName: "transfer",
        args: [contribution.fromAddress as `0x${string}`, amount],
      }),
    });

    return {
      ...base,
      ok: true,
      reference: hash,
      explorerUrl: `${EXPLORER_URL}/tx/${hash}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The transfer failed.";
    // Running out of gas is the likely cause and has an obvious fix, so say it.
    const outOfGas = /insufficient funds|gas required/i.test(message);
    return {
      ...base,
      error: outOfGas
        ? "The signer that pays gas has run out of CELO. Top it up and try again."
        : message,
    };
  }
}

// ── both ───────────────────────────────────────────────────────────────────

/**
 * Refund everything a proposal is holding. Already-refunded contributions are
 * skipped, so running this twice is safe.
 */
export async function refundEverything(
  proposalId: string,
  contributions: Contribution[],
  alreadyRefunded: Set<string>,
): Promise<RefundResult[]> {
  const results: RefundResult[] = [];

  for (const contribution of contributions) {
    if (alreadyRefunded.has(contribution.id)) continue;
    if (contribution.grossAmount <= 0) continue;

    results.push(
      contribution.currency === "eur"
        ? await refundEuro(contribution)
        : await refundTokens(proposalId, contribution),
    );
  }

  return results;
}
