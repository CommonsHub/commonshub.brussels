import { NextResponse } from "next/server";
import { z } from "zod";
import { signOnBehalf } from "@/modules/identity/service";
import type { Event, EventTemplate } from "nostr-tools/pure";

const envelopeSchema = z.object({
  id: z.string(),
  pubkey: z.string().regex(/^[0-9a-f]{64}$/),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string(),
});

const schema = z.object({
  template: z.object({
    kind: z.number(),
    created_at: z.number(),
    tags: z.array(z.array(z.string())),
    content: z.string(),
  }),
  envelope: envelopeSchema,
});

/**
 * Sign something on behalf of the signed-in account.
 *
 * The browser proves it holds the session key it registered at sign-in; the
 * server then signs the content with the account key, which never leaves here.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "This request was not well formed." }, { status: 400 });
  }

  const result = signOnBehalf({
    template: parsed.data.template as EventTemplate,
    envelope: parsed.data.envelope as Event,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
  return NextResponse.json({ event: result.event, author: result.account.displayName });
}
