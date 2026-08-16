/**
 * Which chain the token lives on.
 *
 * Everything on-chain — balances, transfers, the proposal Safes — goes through
 * this one config, so pointing a deployment at another network (a testnet, a
 * fork for testing) is a matter of environment variables, not code. Defaults
 * come from settings.json, which today means CHT on Celo mainnet.
 */

import { createPublicClient, defineChain, http, type Address, type Chain } from "viem";
import settings from "@/settings/settings.json";

const configured = settings.contributionToken as {
  chain: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export const CHAIN_ID = Number(env("TOKEN_CHAIN_ID") ?? configured.chainId);
export const RPC_URL = env("TOKEN_RPC_URL") ?? env("CELO_RPC_URL") ?? configured.rpcUrl;
export const EXPLORER_URL = env("TOKEN_EXPLORER_URL") ?? configured.explorerUrl;
export const TOKEN_ADDRESS = (env("TOKEN_ADDRESS") ?? configured.address) as Address;
export const TOKEN_DECIMALS = Number(env("TOKEN_DECIMALS") ?? configured.decimals);
export const TOKEN_SYMBOL = env("TOKEN_SYMBOL") ?? configured.symbol;

/**
 * Built from the config rather than imported from viem/chains, so an override
 * is complete in itself — no table of known networks to keep in sync.
 */
export const chain: Chain = defineChain({
  id: CHAIN_ID,
  name: env("TOKEN_CHAIN_NAME") ?? configured.chain,
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "explorer", url: EXPLORER_URL } },
});

export const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

/**
 * The most tokens one contribution may move on this deployment. Staging sets
 * this low so a bug in a loop costs pocket change; unset means no cap.
 */
export function maxTokenContribution(): number | null {
  const raw = env("MAX_TOKEN_CONTRIBUTION");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}
