import { NextResponse } from "next/server";
import { z } from "zod";
import { getProposal, progressFor, reviseProposal } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { isSteward } from "@/modules/identity/service";
import type { Proposal, Slot } from "@/modules/proposals/types";

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().min(0.5).max(24),
});

const schema = z.object({
  title: z.string().min(3).max(140).optional(),
  description: z.string().max(8000).optional(),
  link: z
    .string()
    .trim()
    .url("That link does not look like a URL — include the https://.")
    .max(500)
    .nullable()
    .or(z.literal("").transform(() => null))
    .optional(),
  slots: z.array(slotSchema).min(1).max(6).optional(),
  roomSlug: z.string().nullable().optional(),
  expectedPeople: z.number().int().min(1).max(500).optional(),
  audience: z.enum(["public", "members", "invite"]).optional(),
  tickets: z
    .object({
      eur: z.number().min(0).nullable(),
      tokens: z.number().min(0).nullable(),
      freeForMembers: z.boolean(),
    })
    .optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const proposal = getProposal(id);
  if (!proposal) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });
  return NextResponse.json({ proposal: { ...proposal, funding: progressFor(proposal) } });
}

/** Edit the proposal — its author's right, and a steward's. Every change lands
 *  in the thread as a version with a diff, so nothing is edited quietly. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await context.params;
  const proposal = getProposal(id);
  if (!proposal) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });

  const isAuthor = proposal.proposerId === caller.account.id;
  if (!isAuthor && !isSteward(caller.account)) {
    return NextResponse.json(
      { error: "Only the proposer or a steward can edit this." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Some fields need fixing." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.tickets && input.tickets.eur && !input.tickets.tokens) {
    return NextResponse.json(
      { error: "A price in euros needs a price in tokens too." },
      { status: 400 },
    );
  }

  const patch: Partial<Proposal> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.link !== undefined) patch.link = input.link;
  if (input.roomSlug !== undefined) patch.roomSlug = input.roomSlug;
  if (input.expectedPeople !== undefined) patch.expectedPeople = input.expectedPeople;
  if (input.audience !== undefined) patch.audience = input.audience;
  if (input.tickets !== undefined) patch.tickets = input.tickets;
  if (input.slots !== undefined) {
    const slots: Slot[] = input.slots.map((s, i) => ({ ...s, id: `s${i + 1}` }));
    patch.slots = slots;
    // One option means the date is settled; several put it back on the table.
    patch.confirmedSlotId = slots.length === 1 ? slots[0].id : null;
  }

  const updated = reviseProposal(proposal.id, patch, {
    id: caller.account.id,
    name: caller.account.displayName,
  });

  return NextResponse.json({
    proposal: updated ? { ...updated, funding: progressFor(updated) } : null,
  });
}
