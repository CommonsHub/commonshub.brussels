import { NextResponse } from "next/server";
import { z } from "zod";
import { startEmailLogin } from "@/modules/identity/service";
import { sendEmail } from "@/lib/services/notifications";

const schema = z.object({
  email: z.string().email(),
  sessionPubkey: z.string().regex(/^[0-9a-f]{64}$/),
  next: z.string().optional(),
});

function baseUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "We need a valid email address." }, { status: 400 });
  }

  const { email, sessionPubkey, next } = parsed.data;
  const { token } = startEmailLogin({ email, sessionPubkey });

  const url = new URL("/api/identity/verify", baseUrl(request));
  url.searchParams.set("token", token);
  if (next) url.searchParams.set("next", next);

  await sendEmail({
    to: email,
    subject: "Your sign-in link for Commons Hub",
    html: `
      <p>Here is your sign-in link for the Commons Hub:</p>
      <p><a href="${url.toString()}">Sign in</a></p>
      <p>It works once, in the browser you asked from, and expires in 30 minutes.
      If you did not ask for it, you can ignore this email.</p>
    `,
  });

  return NextResponse.json({ ok: true });
}
