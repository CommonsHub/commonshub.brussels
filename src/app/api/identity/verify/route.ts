import { NextResponse } from "next/server";
import { completeEmailLogin, SESSION_COOKIE } from "@/modules/identity/service";

/** The magic link lands here: open the session, then carry on where they left off. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next") || "/events/proposals";

  if (!token) {
    return NextResponse.redirect(new URL("/signin?error=missing-link", url.origin));
  }

  const result = completeEmailLogin(token);
  if (!result) {
    return NextResponse.redirect(new URL("/signin?error=expired", url.origin));
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.set(SESSION_COOKIE, result.session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    expires: new Date(result.session.expiresAt),
  });
  return response;
}
