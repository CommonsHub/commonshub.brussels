import { NextResponse } from "next/server";
import { z } from "zod";
import { getProposal, recordRefunds } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { isSteward } from "@/modules/identity/service";
import { refundEverything } from "@/modules/payments/refunds";
import type { Refund } from "@/modules/proposals/types";

const schema = z.object({ note: z.string().max(500).optional() });

/**
 * Give everything back. Stewards can run this at any point; declining a
 * proposal does it automatically. Contributions already refunded are skipped,
 * so running it twice is safe.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isSteward(caller.account)) {
    return NextResponse.json({ error: "Only a steward can issue refunds." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const { id } = await context.params;
  const proposal = getProposal(id);
  if (!proposal) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });

  const alreadyRefunded = new Set(proposal.refunds.map((r) => r.contributionId));
  const results = await refundEverything(proposal.id, proposal.contributions, alreadyRefunded);

  const refunds: Refund[] = results
    .filter((r) => r.ok)
    .map((r) => ({
      id: `ref_${r.contributionId}`,
      contributionId: r.contributionId,
      contributorId: r.contributorId,
      contributorName: r.contributorName,
      currency: r.currency,
      amount: r.amount,
      reference: r.reference,
      explorerUrl: r.explorerUrl,
      createdAt: new Date().toISOString(),
    }));

  const note = parsed.success ? parsed.data.note : undefined;
  if (refunds.length) recordRefunds(proposal.id, refunds, note);

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    refunded: refunds.length,
    failed: failed.map((f) => ({ contributorName: f.contributorName, error: f.error })),
  });
}
