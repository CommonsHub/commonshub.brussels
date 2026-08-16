import { NextResponse } from "next/server";
import { z } from "zod";
import { startEmailLogin } from "@/modules/identity/service";
import { sendEmail } from "@/lib/services/notifications";

const schema = z.object({
  email: z.string().email(),
  sessionPubkey: z.string().regex(/^[0-9a-f]{64}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "We need a valid email address." }, { status: 400 });
  }

  const { email, sessionPubkey } = parsed.data;
  const issued = startEmailLogin({ email, sessionPubkey });

  if (!issued.ok) {
    return NextResponse.json(
      {
        error: `We just sent one. You can ask for another in ${issued.retryInSeconds}s.`,
        retryInSeconds: issued.retryInSeconds,
      },
      { status: 429 },
    );
  }

  const { code, expiresInMinutes } = issued;

  if (!process.env.RESEND_API_KEY) {
    // Nowhere to send it: log it so a deployment without email is still usable.
    console.info(`[identity] sign-in code for ${email}: ${code}`);
    return NextResponse.json({ ok: true, expiresInMinutes });
  }

  const result = await sendEmail({
    to: email,
    subject: `${code} is your Commons Hub code`,
    html: `
      <p>Your sign-in code for the Commons Hub:</p>
      <p style="font-size:32px;font-weight:600;letter-spacing:6px;margin:16px 0">${code}</p>
      <p>Type it in the tab you asked from. It works there only, and expires in
      ${expiresInMinutes} minutes. If you did not ask for it, you can ignore this email.</p>
    `,
  });

  // If the mail was refused, say so — leaving someone waiting for an email that
  // was never accepted is worse than telling them it failed.
  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: "We could not send that email. Tell us at hello@commonshub.brussels." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, expiresInMinutes });
}
