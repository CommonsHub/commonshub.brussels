import { NextResponse } from "next/server";
import { z } from "zod";
import { createProposal, listProposals, progressFor, linkTaskList } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { signerFor } from "@/modules/identity/service";
import { createTaskList } from "@/modules/tasks/tasklist";

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().min(0.5).max(24),
});

const schema = z.object({
  title: z.string().min(3).max(140),
  pitch: z.string().max(140).default(""),
  description: z.string().max(8000).default(""),
  slots: z.array(slotSchema).min(1).max(6),
  roomSlug: z.string().nullable(),
  expectedPeople: z.number().int().min(1).max(500),
  audience: z.enum(["public", "members", "invite"]),
  tickets: z.object({
    eur: z.number().min(0).nullable(),
    tokens: z.number().min(0).nullable(),
    freeForMembers: z.boolean(),
  }),
  needs: z.array(z.string().max(80)).max(30).default([]),
});

export async function GET() {
  const proposals = listProposals().map((proposal) => ({
    ...proposal,
    funding: progressFor(proposal),
  }));
  return NextResponse.json({ proposals });
}

export async function POST(request: Request) {
  const caller = await currentCaller();
  if (!caller) {
    return NextResponse.json({ error: "Sign in first, so people know who is proposing." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Some fields need fixing." },
      { status: 400 },
    );
  }

  const draft = parsed.data;
  if (draft.tickets.eur && !draft.tickets.tokens) {
    return NextResponse.json(
      { error: "A price in euros needs a price in tokens too, so members can pay in tokens." },
      { status: 400 },
    );
  }

  const proposal = createProposal(draft, {
    id: caller.account.id,
    name: caller.account.displayName,
  });

  // The needs become a shared task list anyone can pick items off.
  try {
    const listId = await createTaskList(
      {
        name: proposal.title.slice(0, 48),
        needs: draft.needs,
        authorName: caller.account.displayName,
      },
      signerFor(caller.account),
    );
    linkTaskList(proposal.id, listId);
  } catch (error) {
    console.error("[proposals] could not create the task list:", error);
  }

  return NextResponse.json({ proposal: { ...proposal, funding: progressFor(proposal) } });
}
