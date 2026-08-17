/**
 * What a proposal's Safe and the gas signer are holding, straight from the
 * chain — with an explorer link, so nobody has to take our word for it.
 *
 * Everything here is best-effort and briefly cached: these reads decorate
 * pages and the status endpoint, and an RPC hiccup should never take either
 * down with it.
 */

import { formatUnits, type Address } from "viem";
import { CHAIN_ID, CHAIN_NAME, EXPLORER_URL, TOKEN_DECIMALS, TOKEN_SYMBOL, publicClient } from "./chain";
import { balanceOf } from "./tokens";
import { isDeployed, predictSafeAddress, safesConfigured, signerAccount } from "./safe";

const CACHE_TTL_MS = 60_000;
const RPC_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("chain read timed out")), RPC_TIMEOUT_MS),
    ),
  ]);
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL.replace(/\/$/, "")}/address/${address}`;
}

// ── the proposal's Safe ────────────────────────────────────────────────────

export interface ProposalTreasury {
  address: Address;
  explorerUrl: string;
  deployed: boolean;
  /** What it holds right now, in tokens. */
  tokenBalance: number;
  symbol: string;
}

const treasuryCache = new Map<string, { at: number; value: ProposalTreasury }>();

/** Null when Safes are not configured, or the chain cannot be reached. */
export async function proposalTreasury(proposalId: string): Promise<ProposalTreasury | null> {
  if (!safesConfigured()) return null;

  const cached = treasuryCache.get(proposalId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const address = await withTimeout(predictSafeAddress("proposal", proposalId));
    const [deployed, tokenBalance] = await Promise.all([
      withTimeout(isDeployed(address)),
      withTimeout(balanceOf(address)),
    ]);

    const value: ProposalTreasury = {
      address,
      explorerUrl: explorerAddressUrl(address),
      deployed,
      tokenBalance,
      symbol: TOKEN_SYMBOL,
    };
    treasuryCache.set(proposalId, { at: Date.now(), value });
    return value;
  } catch (error) {
    console.error("[treasury] could not read the proposal Safe:", error);
    return null;
  }
}

// ── the gas signer ─────────────────────────────────────────────────────────

export interface SignerStatus {
  configured: boolean;
  address: string | null;
  explorerUrl: string | null;
  chainId: number;
  chainName: string;
  /** Native balance, the one that pays for gas. */
  gasBalance: number | null;
  gasSymbol: string;
  /** Deployments and transfers cost ~0.001 CELO; below this, refunds will start failing. */
  low: boolean;
}

let signerCache: { at: number; value: SignerStatus } | null = null;
const LOW_GAS = 0.05;

export async function signerStatus(): Promise<SignerStatus> {
  if (signerCache && Date.now() - signerCache.at < CACHE_TTL_MS) return signerCache.value;

  const base: SignerStatus = {
    configured: safesConfigured(),
    address: null,
    explorerUrl: null,
    chainId: CHAIN_ID,
    chainName: CHAIN_NAME,
    gasBalance: null,
    gasSymbol: "CELO",
    low: false,
  };

  if (!base.configured) return base;

  const address = signerAccount().address;
  base.address = address;
  base.explorerUrl = explorerAddressUrl(address);

  try {
    const wei = await withTimeout(publicClient.getBalance({ address }));
    base.gasBalance = Number(formatUnits(wei, 18));
    base.low = base.gasBalance < LOW_GAS;
  } catch (error) {
    console.error("[treasury] could not read the signer balance:", error);
  }

  signerCache = { at: Date.now(), value: base };
  return base;
}

export { TOKEN_DECIMALS };
