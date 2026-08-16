/**
 * A wallet per proposal.
 *
 * Token contributions go to an address that belongs to that proposal and
 * nothing else, so anyone can look up what a proposal is holding without
 * trusting our arithmetic — and refunding is sending it back from where it
 * sat, rather than unpicking it from a shared pot.
 *
 * Keys are derived from one seed, so there is nothing per-proposal to store or
 * lose: the same seed and the same proposal id always give the same address.
 */

import { keccak256, toBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

const SEED_ENV = "PROPOSAL_WALLET_SEED";

export function walletsConfigured(): boolean {
  const seed = process.env[SEED_ENV];
  return !!seed && /^[0-9a-f]{64}$/i.test(seed);
}

function seed(): Hex {
  const value = process.env[SEED_ENV];
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(
      `${SEED_ENV} is not set (64 hex characters). Token contributions need it to derive a wallet per proposal.`,
    );
  }
  return `0x${value.toLowerCase()}` as Hex;
}

/** Deterministic: same seed + same proposal id → same key, every time. */
export function proposalAccount(proposalId: string): PrivateKeyAccount {
  const material = keccak256(toBytes(`${seed()}:proposal:${proposalId}`));
  return privateKeyToAccount(material);
}

export function proposalAddress(proposalId: string): Address {
  return proposalAccount(proposalId).address;
}

/** The address a proposal collects into, or null when wallets are not set up. */
export function proposalAddressOrNull(proposalId: string): Address | null {
  if (!walletsConfigured()) return null;
  try {
    return proposalAddress(proposalId);
  } catch {
    return null;
  }
}
