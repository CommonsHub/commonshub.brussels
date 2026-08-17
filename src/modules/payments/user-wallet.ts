/**
 * A wallet per person, on the website — the same mechanism as a proposal's
 * treasury. Each account gets a Safe derived from its id, owned by the server
 * signer, deployed only when money first moves out of it.
 *
 * Topping it up is ordinary: send tokens to its address from anywhere — the
 * Discord bot's /send, another wallet, an exchange. Paying on the site is then
 * a transfer out of your wallet into the proposal's, executed by the server,
 * gas paid by the one signer EOA.
 */

import { encodeFunctionData, parseAbi, parseUnits, type Address } from "viem";
import { TOKEN_ADDRESS, TOKEN_DECIMALS, TOKEN_SYMBOL } from "./chain";
import { balanceOf } from "./tokens";
import { execFromSafe, isDeployed, predictSafeAddress, safesConfigured } from "./safe";
import { explorerAddressUrl } from "./treasury";

const erc20 = parseAbi(["function transfer(address to, uint256 value) returns (bool)"]);

export interface UserWallet {
  address: Address;
  explorerUrl: string;
  balance: number;
  deployed: boolean;
  symbol: string;
}

/** The website wallet for an account, with what it currently holds. */
export async function userWallet(accountId: string): Promise<UserWallet | null> {
  if (!safesConfigured()) return null;
  try {
    const address = await predictSafeAddress("user", accountId);
    const [balance, deployed] = await Promise.all([balanceOf(address), isDeployed(address)]);
    return {
      address,
      explorerUrl: explorerAddressUrl(address),
      balance,
      deployed,
      symbol: TOKEN_SYMBOL,
    };
  } catch (error) {
    console.error("[user-wallet] could not read the wallet:", error);
    return null;
  }
}

export type WalletTransfer =
  | { ok: true; txHash: string; from: Address }
  | { ok: false; error: string };

/** Move tokens out of someone's website wallet. Balance is checked first. */
export async function sendFromUserWallet(input: {
  accountId: string;
  to: Address;
  amount: number;
}): Promise<WalletTransfer> {
  if (!safesConfigured()) {
    return { ok: false, error: "Wallets are not switched on for this deployment yet." };
  }

  try {
    const from = await predictSafeAddress("user", input.accountId);
    const held = await balanceOf(from);
    if (held < input.amount) {
      return {
        ok: false,
        error: `Your wallet holds ${held} ${TOKEN_SYMBOL} — not enough for ${input.amount}. Top it up first.`,
      };
    }

    const txHash = await execFromSafe({
      kind: "user",
      id: input.accountId,
      to: TOKEN_ADDRESS,
      data: encodeFunctionData({
        abi: erc20,
        functionName: "transfer",
        args: [input.to, parseUnits(input.amount.toFixed(TOKEN_DECIMALS), TOKEN_DECIMALS)],
      }),
    });

    return { ok: true, txHash, from };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The transfer failed.";
    const outOfGas = /insufficient funds|gas required/i.test(message);
    console.error("[user-wallet] transfer failed:", error);
    return {
      ok: false,
      error: outOfGas
        ? "The signer that pays gas has run out of CELO — tell the stewards."
        : "The transfer did not go through. Nothing was taken — try again in a moment.",
    };
  }
}
