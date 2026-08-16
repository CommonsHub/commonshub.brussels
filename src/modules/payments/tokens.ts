/**
 * Paying with community tokens.
 *
 * Nobody connects a wallet here. People already hold their tokens through the
 * hub's Discord bot, so the site works the same way they do: link the Discord
 * account, show the balance the bot would show, and pay with the same transfer
 * the bot performs. The site only ever reads the chain — no key, no signing,
 * no custody added by this module.
 */

import { createPublicClient, http, parseAbi, formatUnits, parseUnits, type Address } from "viem";
import { celo } from "viem/chains";
import settings from "@/settings/settings.json";
import { proposalAddressOrNull, walletsConfigured } from "./proposal-wallet";

const token = settings.contributionToken as {
  chain: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
};

export const TOKEN_DECIMALS = token.decimals;
export const TOKEN_ADDRESS = token.address as Address;
export const EXPLORER_URL = token.explorerUrl;

/** Where token contributions are received. Set HUB_TOKEN_ACCOUNT to enable. */
export function hubTokenAccount(): Address | null {
  const address = process.env.HUB_TOKEN_ACCOUNT;
  return address && /^0x[a-fA-F0-9]{40}$/.test(address) ? (address as Address) : null;
}

export function tokensConfigured(): boolean {
  return hubTokenAccount() !== null || walletsConfigured();
}

const client = createPublicClient({
  chain: celo,
  transport: http(token.rpcUrl),
});

const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export async function balanceOf(address: Address): Promise<number> {
  const raw = await client.readContract({
    address: TOKEN_ADDRESS,
    abi: erc20,
    functionName: "balanceOf",
    args: [address],
  });
  return Number(formatUnits(raw, TOKEN_DECIMALS));
}

// ── the bot ────────────────────────────────────────────────────────────────

/**
 * The Discord bot holds everyone's account, so it is the only thing that can
 * answer "what is this person's balance" from a Discord id alone. If it exposes
 * an endpoint we use it; otherwise the site falls back to asking the person to
 * run the command themselves.
 */
function botUrl(): string | null {
  return process.env.TOKEN_BOT_URL || null;
}

export interface BotBalance {
  available: true;
  balance: number;
  address: Address | null;
}

export type BalanceLookup = BotBalance | { available: false; reason: string };

export async function balanceForDiscordUser(discordId: string): Promise<BalanceLookup> {
  // The account a Discord user holds tokens in is derived from their user id,
  // the same way the bot derives it, so we can read the balance straight off
  // the chain without asking the bot anything.
  try {
    const { getAccountAddressFromDiscordUserId } = await import("@/lib/citizenwallet");
    const address = await getAccountAddressFromDiscordUserId(discordId);
    if (address) {
      return {
        available: true,
        balance: await balanceOf(address as Address),
        address: address as Address,
      };
    }
  } catch (error) {
    console.error("[tokens] could not resolve the account for this Discord user:", error);
  }

  const base = botUrl();
  if (!base) {
    return {
      available: false,
      reason: "Run /balance in Discord to see what you hold.",
    };
  }

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/balance/${discordId}`, {
      headers: process.env.TOKEN_BOT_SECRET
        ? { Authorization: `Bearer ${process.env.TOKEN_BOT_SECRET}` }
        : {},
      cache: "no-store",
    });
    if (!response.ok) {
      return { available: false, reason: "Run /balance in Discord to see what you hold." };
    }
    const data = (await response.json()) as { balance?: number; address?: string };
    return {
      available: true,
      balance: Number(data.balance ?? 0),
      address: (data.address as Address) ?? null,
    };
  } catch (error) {
    console.error("[tokens] balance lookup failed:", error);
    return { available: false, reason: "Run /balance in Discord to see what you hold." };
  }
}

// ── asking for a payment ───────────────────────────────────────────────────

/**
 * Two people can owe the same round number at the same moment, so each request
 * gets a few unique digits at the end of the amount. That is what lets us match
 * an incoming transfer to a contribution without asking anyone for a reference.
 */
export function requestAmount(base: number): number {
  const salt = Math.floor(Math.random() * 900 + 100) / 1_000_000; // 0.000100–0.000999
  return Number((base + salt).toFixed(TOKEN_DECIMALS));
}

export interface TokenPaymentRequest {
  amount: number;
  account: Address | null;
  /** What to type in Discord. */
  command: string;
  symbol: string;
}

/**
 * Where a proposal collects: its own wallet, so what it holds is verifiable on
 * chain and a refund is simply sending it back out again.
 */
export function collectingAddress(proposalId: string): Address | null {
  return proposalAddressOrNull(proposalId) ?? hubTokenAccount();
}

export function buildPaymentRequest(base: number, proposalId: string): TokenPaymentRequest {
  const amount = requestAmount(base);
  const account = collectingAddress(proposalId);
  return {
    amount,
    account,
    command: account ? `/send ${amount} to ${account}` : `/send ${amount} to @CommonsHub`,
    symbol: token.symbol,
  };
}

// ── confirming it arrived ──────────────────────────────────────────────────

export interface TransferMatch {
  found: boolean;
  txHash?: string;
  from?: string;
  explorerUrl?: string;
}

/**
 * Look for an incoming transfer of exactly this amount in the recent past.
 * Called when someone says they have sent it.
 */
export async function findIncomingTransfer(
  amount: number,
  options?: { withinBlocks?: bigint; proposalId?: string },
): Promise<TransferMatch> {
  const account = options?.proposalId
    ? collectingAddress(options.proposalId)
    : hubTokenAccount();
  if (!account) return { found: false };

  const target = parseUnits(amount.toFixed(TOKEN_DECIMALS), TOKEN_DECIMALS);
  const latest = await client.getBlockNumber();
  // Celo makes a block a second, so an hour of history is a generous window.
  const window = options?.withinBlocks ?? BigInt(3_600);
  const zero = BigInt(0);
  const fromBlock = latest - window;

  const logs = await client.getLogs({
    address: TOKEN_ADDRESS,
    event: erc20[1],
    args: { to: account },
    fromBlock: fromBlock > zero ? fromBlock : zero,
    toBlock: latest,
  });

  const match = logs.find((log) => log.args.value === target);
  if (!match) return { found: false };

  return {
    found: true,
    txHash: match.transactionHash,
    from: match.args.from,
    explorerUrl: `${EXPLORER_URL}/tx/${match.transactionHash}`,
  };
}

export const TOKEN_SYMBOL = token.symbol;
