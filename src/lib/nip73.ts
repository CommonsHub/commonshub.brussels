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

export function stripeCustomerId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith("cus_") ? `stripe:customer:${value}` : null;
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
