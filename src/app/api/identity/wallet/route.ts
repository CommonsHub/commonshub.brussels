import { NextResponse } from "next/server";
import { currentCaller } from "@/modules/identity/server";
import { userWallet } from "@/modules/payments/user-wallet";
import { balanceForDiscordUser } from "@/modules/payments/tokens";
import { explorerAddressUrl } from "@/modules/payments/treasury";

/** The signed-in person's wallets: the website one, and the Discord one. */
export async function GET() {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const [wallet, discord] = await Promise.all([
    userWallet(caller.account.id),
    caller.account.discordId
      ? balanceForDiscordUser(caller.account.discordId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    wallet,
    discordWallet:
      discord && discord.available && discord.address
        ? {
            address: discord.address,
            explorerUrl: explorerAddressUrl(discord.address),
            balance: discord.balance,
          }
        : null,
    hasDiscord: !!caller.account.discordId,
  });
}
