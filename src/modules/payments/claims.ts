/**
 * One token a month, for members. An active subscription is what makes you a
 * member here; the claim is the small monthly thank-you, straight into your
 * website wallet.
 *
 * On the testnet the token is minted; on mainnet it comes out of the claims
 * pool — a Safe the hub tops up, at an address anyone can check.
 */

import * as fs from "fs";
import * as path from "path";
import { createWalletClient, encodeFunctionData, parseAbi, parseUnits, type Address } from "viem";
import { identityDir } from "@/modules/identity/crypto";
import {
  chain,
  EXPLORER_URL,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  tokenNetwork,
  transport,
  publicClient,
} from "./chain";
import { execFromSafe, predictSafeAddress, safesConfigured, signerAccount } from "./safe";
import { subscriptionForEmail } from "./subscription";
import type { Account } from "@/modules/identity/store";

export const CLAIM_AMOUNT = 1;

/** Where mainnet claims are paid from. The hub keeps it topped up. */
export function claimsPoolAddress(): Promise<Address> {
  return predictSafeAddress("user", "claims-pool");
}

function claimsFile(): string {
  return path.join(identityDir(), "claims.json");
}

function readClaims(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(claimsFile(), "utf-8"));
  } catch {
    return {};
  }
}

function monthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function alreadyClaimed(accountId: string): boolean {
  return readClaims()[accountId] === monthKey();
}

export type ClaimResult =
  | { ok: true; amount: number; symbol: string; explorerUrl: string }
  | { ok: false; error: string; needsSubscription?: boolean };

export async function claimMonthlyToken(account: Account): Promise<ClaimResult> {
  if (!safesConfigured()) return { ok: false, error: "Claims are not switched on here." };

  if (alreadyClaimed(account.id)) {
    return { ok: false, error: "You already claimed this month's token. Next month it renews." };
  }

  const subscription = await subscriptionForEmail(account.email);
  if (!subscription.active) {
    return {
      ok: false,
      needsSubscription: true,
      error: "The monthly token comes with an active membership subscription.",
    };
  }

  const to = await predictSafeAddress("user", account.id);
  const amount = parseUnits(CLAIM_AMOUNT.toFixed(TOKEN_DECIMALS), TOKEN_DECIMALS);

  try {
    let hash: `0x${string}`;
    if (tokenNetwork() === "testnet") {
      // Test money mints; no pool to manage.
      const wallet = createWalletClient({ account: signerAccount(), chain, transport });
      hash = await wallet.writeContract({
        address: TOKEN_ADDRESS,
        abi: parseAbi(["function mint(address to, uint256 amount)"]),
        functionName: "mint",
        args: [to, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    } else {
      hash = await execFromSafe({
        kind: "user",
        id: "claims-pool",
        to: TOKEN_ADDRESS,
        data: encodeFunctionData({
          abi: parseAbi(["function transfer(address to, uint256 value) returns (bool)"]),
          functionName: "transfer",
          args: [to, amount],
        }),
      });
    }

    // Recorded only after the token actually moved.
    const claims = readClaims();
    claims[account.id] = monthKey();
    fs.mkdirSync(identityDir(), { recursive: true });
    fs.writeFileSync(claimsFile(), JSON.stringify(claims, null, 2));

    return {
      ok: true,
      amount: CLAIM_AMOUNT,
      symbol: TOKEN_SYMBOL,
      explorerUrl: `${EXPLORER_URL}/tx/${hash}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The claim did not go through.";
    console.error("[claims] failed:", error);
    return {
      ok: false,
      error: /balance|transfer/i.test(message)
        ? "The claims pool is empty — tell the stewards."
        : "The claim did not go through. Try again in a moment.",
    };
  }
}
