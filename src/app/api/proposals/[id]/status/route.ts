import { NextResponse } from "next/server";
import { z } from "zod";
import { getProposal, progressFor, setStatus } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { isSteward } from "@/modules/identity/service";

const schema = z.object({
  status: z.enum(["open", "confirmed", "declined", "cancelled", "happened"]),
  note: z.string().max(1000).optional(),
  confirmedSlotId: z.string().nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That is not a status we know." }, { status: 400 });
  }

  const { id } = await context.params;
  const proposal = getProposal(id);
  if (!proposal) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });

  const { status, note, confirmedSlotId } = parsed.data;
  const isProposer = proposal.proposerId === caller.account.id;

  // Confirming holds a room, so only stewards do it. Proposers can cancel.
  if (status === "confirmed" || status === "declined") {
    if (!isSteward(caller.account)) {
      return NextResponse.json(
        { error: "Only a steward can confirm or decline an event." },
        { status: 403 },
      );
    }
    const funding = progressFor(proposal);
    if (status === "confirmed" && !funding.funded) {
      return NextResponse.json(
        { error: "This one is not funded yet — it cannot be confirmed." },
        { status: 409 },
      );
    }
    const slot = confirmedSlotId ?? proposal.confirmedSlotId;
    if (status === "confirmed" && !slot) {
      return NextResponse.json({ error: "Pick which date it is happening on first." }, { status: 409 });
    }
    if (status === "confirmed" && !proposal.roomSlug) {
      return NextResponse.json({ error: "Pick a room before confirming." }, { status: 409 });
    }
  } else if (!isProposer && !isSteward(caller.account)) {
    return NextResponse.json({ error: "Only the proposer or a steward can do that." }, { status: 403 });
  }

  const updated = setStatus(
    id,
    status,
    { id: caller.account.id, name: caller.account.displayName },
    { note, confirmedSlotId },
  );

  return NextResponse.json({ proposal: updated });
}
