import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  openSession,
  publicProfile,
  SESSION_COOKIE,
  upsertDiscordAccount,
} from "@/modules/identity/service";

const schema = z.object({
  sessionPubkey: z.string().regex(/^[0-9a-f]{64}$/),
});

/**
 * Called right after a Discord sign-in: bind the browser's session key to the
 * hub account, creating it the first time. Discord roles come along, which is
 * how stewards get their badge and their confirm button.
 */
export async function POST(request: Request) {
  const session = await auth();
  const discordId = (session as { discordId?: string } | null)?.discordId;
  if (!session || !discordId) {
    return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "This session could not be identified." }, { status: 400 });
  }

  const profile = session as {
    discordId?: string;
    username?: string;
    roleNames?: string[];
    user?: { name?: string | null; email?: string | null };
  };

  const account = upsertDiscordAccount({
    discordId,
    username: profile.username || profile.user?.name || "Someone",
    email: profile.user?.email ?? null,
    roleNames: profile.roleNames ?? [],
  });

  const opened = openSession(
    account,
    parsed.data.sessionPubkey,
    request.headers.get("user-agent") ?? undefined,
  );

  const response = NextResponse.json({ account: publicProfile(account) });
  response.cookies.set(SESSION_COOKIE, opened.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    expires: new Date(opened.expiresAt),
  });
  return response;
}
