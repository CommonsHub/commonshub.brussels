import { NextResponse } from "next/server";
import { currentCaller } from "@/modules/identity/server";
import { subscriptionForEmail } from "@/modules/payments/subscription";
import { alreadyClaimed } from "@/modules/payments/claims";

export async function GET() {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const subscription = await subscriptionForEmail(caller.account.email);
  return NextResponse.json({
    subscription,
    claimedThisMonth: alreadyClaimed(caller.account.id),
  });
}
