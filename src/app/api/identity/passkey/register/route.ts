import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCaller } from "@/modules/identity/server";
import {
  labelFromUserAgent,
  registrationOptions,
  verifyRegistration,
} from "@/modules/identity/passkeys";

const optionsSchema = z.object({
  sessionPubkey: z.string().regex(/^[0-9a-f]{64}$/),
});

const verifySchema = optionsSchema.extend({
  response: z.record(z.string(), z.unknown()),
  label: z.string().max(60).optional(),
});

/** Step one: what the browser needs to create a passkey for this account. */
export async function POST(request: Request) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = optionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "This session could not be identified." }, { status: 400 });
  }

  const options = await registrationOptions({
    account: caller.account,
    sessionPubkey: parsed.data.sessionPubkey,
    request,
  });
  return NextResponse.json({ options });
}

/** Step two: the passkey the device just made. */
export async function PUT(request: Request) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That passkey could not be read." }, { status: 400 });
  }

  const result = await verifyRegistration({
    account: caller.account,
    sessionPubkey: parsed.data.sessionPubkey,
    response: parsed.data.response as never,
    label: parsed.data.label || labelFromUserAgent(request.headers.get("user-agent")),
    request,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, label: result.label });
}
