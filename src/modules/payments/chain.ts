/**
 * Which chain the token lives on.
 *
 * Everything on-chain — balances, transfers, the proposal Safes — goes through
 * this one config, so pointing a deployment at another network (a testnet, a
 * fork for testing) is a matter of environment variables, not code. Defaults
 * come from settings.json, which today means CHT on Celo mainnet.
 */

import { createPublicClient, defineChain, fallback, http, type Address, type Chain } from "viem";
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

/**
 * One switch: TOKEN_NETWORK=testnet points everything at Celo Sepolia and the
 * tCHT test token; mainnet (the default) is CHT on Celo from settings.json.
 * The individual TOKEN_* variables still win over either preset, for the odd
 * case where one value has to differ.
 */
interface NetworkPreset {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  address: string;
  symbol: string;
  decimals: number;
}

const PRESETS: Record<"mainnet" | "testnet", NetworkPreset> = {
  mainnet: {
    chainId: configured.chainId,
    chainName: configured.chain,
    rpcUrl: configured.rpcUrl,
    explorerUrl: configured.explorerUrl,
    address: configured.address,
    symbol: configured.symbol,
    decimals: configured.decimals,
  },
  testnet: {
    chainId: 11142220,
    chainName: "Celo Sepolia",
    rpcUrl: "https://celo-sepolia.drpc.org",
    explorerUrl: "https://celo-sepolia.blockscout.com",
    // tCHT, deployed 2026-08-17 by scripts/deploy-test-token.mjs. Open mint.
    address: "0xb9c79781d281f0117d8eb296fe0a6997d66fda95",
    symbol: "tCHT",
    decimals: 6,
  },
};

export type TokenNetwork = keyof typeof PRESETS;

export function tokenNetwork(): TokenNetwork {
  const raw = (env("TOKEN_NETWORK") ?? "mainnet").toLowerCase();
  if (["testnet", "celo-sepolia", "sepolia", "test"].includes(raw)) return "testnet";
  return "mainnet";
}

const preset = PRESETS[tokenNetwork()];

export const CHAIN_ID = Number(env("TOKEN_CHAIN_ID") ?? preset.chainId);
export const CHAIN_NAME = env("TOKEN_CHAIN_NAME") ?? preset.chainName;
export const RPC_URL = env("TOKEN_RPC_URL") ?? env("CELO_RPC_URL") ?? preset.rpcUrl;
export const EXPLORER_URL = env("TOKEN_EXPLORER_URL") ?? preset.explorerUrl;
export const TOKEN_ADDRESS = (env("TOKEN_ADDRESS") ?? preset.address) as Address;
export const TOKEN_DECIMALS = Number(env("TOKEN_DECIMALS") ?? preset.decimals);
export const TOKEN_SYMBOL = env("TOKEN_SYMBOL") ?? preset.symbol;

/**
 * Built from the config rather than imported from viem/chains, so an override
 * is complete in itself — no table of known networks to keep in sync.
 */
export const chain: Chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "explorer", url: EXPLORER_URL } },
});

/**
 * More than one way to reach the chain: public RPCs flake, and a wallet that
 * reads as empty because one endpoint hiccuped is worse than a slow answer.
 */
const FALLBACK_RPCS: Record<TokenNetwork, string[]> = {
  mainnet: ["https://forno.celo.org", "https://celo.drpc.org"],
  testnet: ["https://celo-sepolia.drpc.org", "https://forno.celo-sepolia.celo-testnet.org"],
};

const rpcUrls = Array.from(new Set([RPC_URL, ...FALLBACK_RPCS[tokenNetwork()]]));

export const transport = fallback(
  rpcUrls.map((url) => http(url, { timeout: 8_000, retryCount: 1 })),
);

export const publicClient = createPublicClient({ chain, transport });

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
