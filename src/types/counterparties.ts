/**
 * Counterparty metadata as produced by chb's nostr-profile pipeline.
 * Keys of CounterpartiesFile.counterparties are NIP-73 external IDs.
 */
export interface CounterpartyMetadata {
  name?: string;
  about?: string;
  picture?: string;
  tags?: Record<string, string>;
  nostrEventId?: string;
  author?: string;
  createdAt?: number;
  [key: string]: unknown;
}

export interface CounterpartiesFile {
  month: string;
  generatedAt: string;
  counterparties: Record<string, CounterpartyMetadata>;
}

/**
 * Best human-readable label for a counterparty.
 * `name` is the canonical user-supplied label; `about` typically holds a
 * profile bio sourced from Nostr.
 */
export function counterpartyLabel(meta: CounterpartyMetadata | undefined): string {
  if (!meta) return "";
  return meta.name?.trim() || meta.about?.trim() || "";
}
