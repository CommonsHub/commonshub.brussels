import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callerFromSessionId, publicProfile, SESSION_COOKIE } from "@/modules/identity/service";

export async function GET() {
  const store = await cookies();
  const caller = callerFromSessionId(store.get(SESSION_COOKIE)?.value);
  if (!caller) return NextResponse.json({ account: null });
  return NextResponse.json({ account: publicProfile(caller.account) });
}
