import { NextResponse } from "next/server";
import { z } from "zod";
import { addComment } from "@/modules/proposals/store";
import { currentCaller } from "@/modules/identity/server";

const schema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = await currentCaller();
  if (!caller) {
    return NextResponse.json({ error: "Sign in to join the conversation." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Write something first." }, { status: 400 });
  }

  const { id } = await context.params;
  const comment = addComment(id, parsed.data.body, {
    id: caller.account.id,
    name: caller.account.displayName,
  });

  if (!comment) return NextResponse.json({ error: "That proposal is gone." }, { status: 404 });
  return NextResponse.json({ comment });
}
