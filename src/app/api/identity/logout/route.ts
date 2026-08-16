import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { closeSession, SESSION_COOKIE } from "@/modules/identity/service";

export async function POST() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (sessionId) closeSession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return response;
}
