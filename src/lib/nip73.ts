/**
 * NIP-73 external content IDs.
 * https://github.com/nostr-protocol/nips/blob/master/73.md
 */

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  gnosis: 100,
  celo: 42220,
};

const CHAIN_BY_ID: Record<number, string> = Object.fromEntries(
  Object.entries(CHAIN_IDS).map(([name, id]) => [id, name])
);

export function chainIdFor(chain: string | null | undefined): number | null {
  if (!chain) return null;
  return CHAIN_IDS[chain.toLowerCase()] ?? null;
}

export function chainNameFor(chainId: number | string): string | null {
  const id = typeof chainId === "string" ? parseInt(chainId, 10) : chainId;
  return CHAIN_BY_ID[id] ?? null;
}

export function ethereumAddressId(
  chain: string | null | undefined,
  address: string | null | undefined
): string | null {
  if (!address) return null;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
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

/**
 * Extract the 0x address from an `ethereum:<chainId>:address:<addr>` URI
 * (also accepts `ethereum:<chainId>:token:<addr>` for token-contract refs).
 * Returns null for non-ethereum URIs or malformed input.
 */
export function addressFromUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const parts = uri.split(":");
  if (parts[0] !== "ethereum") return null;
  if (parts[2] !== "address" && parts[2] !== "token") return null;
  const addr = parts[3];
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
  return addr.toLowerCase();
}

/**
 * Extract the tx hash from an `ethereum:<chainId>:tx:<hash>` URI.
 */
export function txHashFromUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const parts = uri.split(":");
  if (parts[0] !== "ethereum" || parts[2] !== "tx") return null;
  const hash = parts[3];
  if (!hash || !/^0x[a-fA-F0-9]{1,}$/.test(hash)) return null;
  return hash.toLowerCase();
}

/**
 * Extract the chain name from an ethereum NIP-73 URI.
 */
export function chainFromUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const parts = uri.split(":");
  if (parts[0] !== "ethereum") return null;
  const chainId = parseInt(parts[1] ?? "", 10);
  if (!chainId) return null;
  return chainNameFor(chainId);
}
