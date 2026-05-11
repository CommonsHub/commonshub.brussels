/**
 * NIP-73 external content IDs.
 * https://github.com/nostr-protocol/nips/blob/master/73.md
 */

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  gnosis: 100,
  celo: 42220,
};

export function chainIdFor(chain: string | null | undefined): number | null {
  if (!chain) return null;
  return CHAIN_IDS[chain.toLowerCase()] ?? null;
}

export function ethereumAddressId(
  chain: string | null | undefined,
  address: string | null | undefined
): string | null {
  if (!address) return null;
  const chainId = chainIdFor(chain);
  if (!chainId) return null;
  return `ethereum:${chainId}:address:${address.toLowerCase()}`;
}

export function ethereumTxId(
  chain: string | null | undefined,
  txHash: string | null | undefined
): string | null {
  if (!txHash) return null;
  const chainId = chainIdFor(chain);
  if (!chainId) return null;
  return `ethereum:${chainId}:tx:${txHash.toLowerCase()}`;
}

export function stripeCustomerId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith("cus_") ? `stripe:customer:${value}` : null;
}

export function stripeTxId(value: string | null | undefined): string | null {
  if (!value) return null;
  return `stripe:txn:${value}`;
}

/** NIP-73 `k` tag value (the "kind" of the external identifier). */
export function nip73Kind(uri: string): string {
  const parts = uri.split(":");
  if (parts[0] === "ethereum") {
    // ethereum:<chainId>:tx:<hash> | ethereum:<chainId>:address:<addr>
    return `ethereum:${parts[2] ?? ""}`;
  }
  if (parts[0] === "stripe") {
    // stripe:customer:cus_x | stripe:txn:txn_x
    return `stripe:${parts[1] ?? ""}`;
  }
  return parts[0] ?? "";
}

/** NIP-73 URI for a transaction (returns null when we can't form one). */
export function transactionNip73Id(tx: {
  provider?: string | null;
  chain?: string | null;
  txHash?: string | null;
  stripeChargeId?: string | null;
  id?: string | null;
}): string | null {
  if (tx.provider === "stripe") {
    return stripeTxId(tx.stripeChargeId ?? tx.txHash ?? tx.id);
  }
  return ethereumTxId(tx.chain, tx.txHash);
}

/**
 * Build a NIP-73 counterparty ID from a transaction's provider/chain/counterparty
 * triple. Returns null when no scheme matches (e.g. Stripe txs whose
 * counterparty is a free-text description rather than a customer ID).
 */
export function counterpartyNip73Id(tx: {
  provider?: string | null;
  chain?: string | null;
  counterparty?: string | null;
}): string | null {
  if (tx.provider === "stripe") {
    return stripeCustomerId(tx.counterparty);
  }
  return ethereumAddressId(tx.chain, tx.counterparty);
}
