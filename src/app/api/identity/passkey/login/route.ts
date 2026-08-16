import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticationOptions,
  verifyAuthentication,
} from "@/modules/identity/passkeys";
import { publicProfile, SESSION_COOKIE } from "@/modules/identity/service";

const optionsSchema = z.object({
  sessionPubkey: z.string().regex(/^[0-9a-f]{64}$/),
});

const verifySchema = optionsSchema.extend({
  response: z.record(z.string(), z.unknown()),
});

/** Step one: a challenge for whatever passkey this browser holds for us. */
export async function POST(request: Request) {
  const parsed = optionsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "This session could not be identified." }, { status: 400 });
  }

  const options = await authenticationOptions({
    sessionPubkey: parsed.data.sessionPubkey,
    request,
  });
  return NextResponse.json({ options });
}

/** Step two: the signed challenge. Opens the session. */
export async function PUT(request: Request) {
  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That passkey could not be read." }, { status: 400 });
  }

  const result = await verifyAuthentication({
    sessionPubkey: parsed.data.sessionPubkey,
    response: parsed.data.response as never,
    request,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  const response = NextResponse.json({ account: publicProfile(result.account) });
  response.cookies.set(SESSION_COOKIE, result.session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    expires: new Date(result.session.expiresAt),
  });
  return response;
}
