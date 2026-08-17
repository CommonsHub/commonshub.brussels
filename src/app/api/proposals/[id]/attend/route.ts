import { NextResponse } from "next/server";
import { getProposal, addContribution, setRsvp } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { collectingAddress } from "@/modules/payments/tokens";
import { sendFromUserWallet, userWallet } from "@/modules/payments/user-wallet";
import { TOKEN_SYMBOL } from "@/modules/payments/chain";

export const RSVP_PRICE = 1;

/**
 * "I'm coming" costs one token, held by the proposal and refunded if the
 * event is cancelled or never happens — a promise with a small weight on it.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await context.params;
  const proposal = getProposal(id);
  if (!proposal) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });

  if (!proposal.confirmedSlotId) {
    return NextResponse.json(
      { error: "RSVPs open once the date is set." },
      { status: 409 },
    );
  }
  if (proposal.status === "declined" || proposal.status === "cancelled") {
    return NextResponse.json({ error: "This event is not going ahead." }, { status: 409 });
  }

  const going = proposal.rsvps.filter((r) => r.state === "going");
  if (going.some((r) => r.contributorId === caller.account.id)) {
    return NextResponse.json({ error: "You are already in." }, { status: 409 });
  }
  const seatsTaken = going.reduce((sum, r) => sum + r.seats, 0);
  if (proposal.maxAttendees !== null && seatsTaken >= proposal.maxAttendees) {
    return NextResponse.json({ error: "This one is full." }, { status: 409 });
  }

  const to = await collectingAddress(proposal.id);
  if (!to) {
    return NextResponse.json({ error: "RSVPs are not switched on here yet." }, { status: 503 });
  }

  // One token from your wallet to the proposal's. If the wallet is short, the
  // client gets everything it needs to point at the top-up page.
  const transfer = await sendFromUserWallet({
    accountId: caller.account.id,
    to: to as `0x${string}`,
    amount: RSVP_PRICE,
  });
  if (!transfer.ok) {
    const wallet = await userWallet(caller.account.id).catch(() => null);
    const short = wallet !== null && wallet.balance < RSVP_PRICE;
    return NextResponse.json(
      { error: transfer.error, needsTopUp: short, symbol: TOKEN_SYMBOL },
      { status: short ? 402 : 502 },
    );
  }

  const contribution = addContribution(proposal.id, {
    kind: "ticket",
    currency: "tokens",
    grossAmount: RSVP_PRICE,
    adminFee: 0,
    netAmount: RSVP_PRICE,
    contributorId: caller.account.id,
    contributorName: caller.account.displayName,
    seats: 1,
    reference: transfer.txHash,
    fromAddress: transfer.from,
  });

  const rsvp = setRsvp(proposal.id, {
    contributorId: caller.account.id,
    name: caller.account.displayName,
    state: "going",
    seats: 1,
    contributionId: contribution?.id,
  });

  return NextResponse.json({ rsvp, paid: RSVP_PRICE, symbol: TOKEN_SYMBOL });
}
