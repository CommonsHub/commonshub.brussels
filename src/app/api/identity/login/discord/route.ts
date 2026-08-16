import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  linkDiscordToAccount,
  openSession,
  publicProfile,
  SESSION_COOKIE,
  upsertDiscordAccount,
} from "@/modules/identity/service";
import { currentCaller } from "@/modules/identity/server";

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
  // The Discord details hang off session.user — see the session callback in auth.ts.
  const user = session?.user as
    | {
        discordId?: string;
        username?: string;
        name?: string | null;
        email?: string | null;
        roleDetails?: Array<{ id: string; name: string }>;
      }
    | undefined;

  if (!user?.discordId) {
    console.warn("[identity] Discord link attempted without a Discord session");
    return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "This session could not be identified." }, { status: 400 });
  }

  const profile = {
    discordId: user.discordId,
    username: user.username || user.name || "Someone",
    email: user.email ?? null,
    roleNames: (user.roleDetails ?? []).map((role) => role.name),
  };

  // Already signed in — say by email — so connect Discord to that account
  // rather than starting a second one for the same person.
  const caller = await currentCaller();
  let account;
  if (caller) {
    const linked = linkDiscordToAccount(caller.account.id, profile);
    if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 409 });
    account = linked.account;
  } else {
    account = upsertDiscordAccount(profile);
  }

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
