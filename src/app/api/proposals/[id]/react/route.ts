import { NextResponse } from "next/server";
import { z } from "zod";
import { getProposal, reactionsFor, toggleReaction } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";
import { signerFor } from "@/modules/identity/service";

const schema = z.object({
  // "proposal", or the id of one of its comments.
  targetId: z.string().min(1).max(40),
  // One emoji — a grapheme can be several code points, so cap bytes not chars.
  emoji: z.string().min(1).max(16),
});

/**
 * Toggle an emoji on the proposal or one of its comments. NIP-25 semantics:
 * the same reaction again takes it back. Best effort, a matching kind-7 event
 * goes to the hub relay, tagged with the proposal's web address (NIP-73 style,
 * since proposals are not nostr events themselves).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in to react." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That is not a reaction we can take." }, { status: 400 });
  }

  const { id } = await context.params;
  const proposal = getProposal(id);
  if (!proposal) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });

  const { targetId, emoji } = parsed.data;
  if (targetId !== "proposal" && !proposal.comments.some((c) => c.id === targetId)) {
    return NextResponse.json({ error: "That comment is gone." }, { status: 404 });
  }

  const updated = toggleReaction(proposal.id, targetId, emoji, {
    id: caller.account.id,
    name: caller.account.displayName,
  });

  // Mirror to the hub relay as a standard reaction event; never block on it.
  publishReaction(proposal.number, targetId, emoji, caller.account).catch((error) =>
    console.error("[react] relay publish failed:", error),
  );

  return NextResponse.json({
    reactions: reactionsFor(updated ?? proposal, targetId, caller.account.id),
  });
}

async function publishReaction(
  proposalNumber: number,
  targetId: string,
  emoji: string,
  account: Parameters<typeof signerFor>[0],
) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://commonshub.brussels";
  const uri = `${site}/proposals/${proposalNumber}${targetId === "proposal" ? "" : `#${targetId}`}`;

  const event = await signerFor(account)({
    kind: 7, // NIP-25 reaction
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["i", uri], // NIP-73: reacting to external content, addressed by URL
      ["k", "web"],
    ],
    content: emoji,
  });

  const { SimplePool } = await import("nostr-tools/pool");
  const relays = (process.env.NOSTR_RELAYS || "wss://relay.commonshub.brussels")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const pool = new SimplePool();
  try {
    await Promise.race([
      Promise.allSettled(pool.publish(relays, event)),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } finally {
    pool.close(relays);
  }
}
