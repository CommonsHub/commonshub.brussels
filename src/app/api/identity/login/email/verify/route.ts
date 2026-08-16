import { NextResponse } from "next/server";
import { z } from "zod";
import {
  completeEmailLogin,
  publicProfile,
  SESSION_COOKIE,
} from "@/modules/identity/service";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(12),
  sessionPubkey: z.string().regex(/^[0-9a-f]{64}$/),
});

/** The six-digit code, typed in the browser that asked for it. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 });
  }

  const result = completeEmailLogin(parsed.data);
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
