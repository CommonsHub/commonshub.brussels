import { NextResponse } from "next/server";
import { z } from "zod";
import { addComment } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";

const schema = z
  .object({
    body: z.string().max(4000).default(""),
    attachments: z
      .array(
        z.object({
          url: z.string().url(),
          mime: z.string().max(100),
          name: z.string().max(200),
        }),
      )
      .max(12)
      .optional(),
  })
  // A comment can be a photo with nothing written under it.
  .refine((v) => v.body.trim().length > 0 || (v.attachments?.length ?? 0) > 0, {
    message: "Write something, or add a photo.",
  });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) {
    return NextResponse.json({ error: "Sign in to join the conversation." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Write something first." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const comment = addComment(
    id,
    parsed.data.body,
    { id: caller.account.id, name: caller.account.displayName },
    parsed.data.attachments,
  );

  if (!comment) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });
  return NextResponse.json({ comment });
}
