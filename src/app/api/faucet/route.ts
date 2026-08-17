import { NextResponse } from "next/server";
import { z } from "zod";
import { createWalletClient, parseAbi, parseUnits } from "viem";
import {
  chain,
  EXPLORER_URL,
  transport,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  tokenNetwork,
  publicClient,
} from "@/modules/payments/chain";
import { predictSafeAddress, safesConfigured, signerAccount } from "@/modules/payments/safe";
import { currentCaller } from "@/modules/identity/server";
import { findAccountByEmail } from "@/modules/identity/store";

const schema = z.object({
  /** An 0x address, a username, or empty for your own website wallet. */
  to: z.string().trim().max(120).optional(),
  amount: z.number().positive().max(10_000).default(10),
});

const abi = parseAbi(["function mint(address to, uint256 amount)"]);

/** Test money on tap. Exists only where the money is worth nothing. */
export async function POST(request: Request) {
  if (tokenNetwork() !== "testnet") {
    return NextResponse.json({ error: "The faucet only runs on the test network." }, { status: 404 });
  }
  if (!safesConfigured()) {
    return NextResponse.json({ error: "No signer configured here." }, { status: 503 });
  }

  const caller = await currentCaller();
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "That does not look right." }, { status: 400 });
  }

  const { to, amount } = parsed.data;
  let target: string | null = null;
  let label = to ?? "";

  if (to && /^0x[a-fA-F0-9]{40}$/.test(to)) {
    target = to;
  } else if (to) {
    // A name: their website wallet, resolved through the identity store.
    const { listAccountByName } = await import("@/modules/identity/resolve");
    const account = listAccountByName(to) ?? (to.includes("@") ? findAccountByEmail(to) : null);
    if (!account) {
      return NextResponse.json(
        { error: `We do not know “${to}”. Use an 0x address, or their exact username.` },
        { status: 404 },
      );
    }
    target = await predictSafeAddress("user", account.id);
    label = account.displayName;
  } else {
    if (!caller) {
      return NextResponse.json(
        { error: "Sign in, or say which address or username to mint to." },
        { status: 401 },
      );
    }
    target = await predictSafeAddress("user", caller.account.id);
    label = caller.account.displayName;
  }

  try {
    const wallet = createWalletClient({ account: signerAccount(), chain, transport });
    const hash = await wallet.writeContract({
      address: TOKEN_ADDRESS,
      abi,
      functionName: "mint",
      args: [target as `0x${string}`, parseUnits(amount.toFixed(TOKEN_DECIMALS), TOKEN_DECIMALS)],
    });
    await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });

    return NextResponse.json({
      minted: amount,
      symbol: TOKEN_SYMBOL,
      to: target,
      label,
      explorerUrl: `${EXPLORER_URL}/tx/${hash}`,
    });
  } catch (error) {
    console.error("[faucet] mint failed:", error);
    return NextResponse.json(
      { error: "The mint did not go through. Try again in a moment." },
      { status: 502 },
    );
  }
}
