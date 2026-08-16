import { NextResponse } from "next/server";
import { z } from "zod";
import { getProposal, setRsvp } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { isMember } from "@/modules/identity/service";

const schema = z.object({
  state: z.enum(["going", "maybe", "not_going"]),
  seats: z.number().int().min(0).max(20).default(1),
});

/** Free RSVP. Paid tickets come through the contribute routes instead. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in to say you are coming." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That is not a valid RSVP." }, { status: 400 });

  const { id } = await context.params;
  const proposal = getProposal(id);
  if (!proposal) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });

  const paid = proposal.tickets.eur || proposal.tickets.tokens;
  const freeForThisPerson = !paid || (proposal.tickets.freeForMembers && isMember(caller.account));

  if (parsed.data.state === "going" && !freeForThisPerson) {
    return NextResponse.json(
      { error: "This event has a ticket — pick how you want to pay for it." },
      { status: 402 },
    );
  }

  const rsvp = setRsvp(proposal.id, {
    contributorId: caller.account.id,
    name: caller.account.displayName,
    state: parsed.data.state,
    seats: parsed.data.seats,
  });

  return NextResponse.json({ rsvp });
}
