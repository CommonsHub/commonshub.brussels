import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCaller } from "@/modules/identity/server";
import { linkEmailToAccount, publicProfile } from "@/modules/identity/service";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(12),
  sessionPubkey: z.string().regex(/^[0-9a-f]{64}$/),
});

/** Add an email address to the signed-in account, proven by the emailed code. */
export async function POST(request: Request) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 });
  }

  const result = linkEmailToAccount(caller.account.id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ account: publicProfile(result.account) });
}
