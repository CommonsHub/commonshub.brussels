import { NextResponse } from "next/server";
import { currentCaller } from "@/modules/identity/server";
import { claimMonthlyToken } from "@/modules/payments/claims";

/** One token a month, for members with an active subscription. */
export async function POST() {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const result = await claimMonthlyToken(caller.account);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, needsSubscription: result.needsSubscription ?? false },
      { status: result.needsSubscription ? 402 : 409 },
    );
  }
  return NextResponse.json(result);
}
