/**
 * Helpers for reading and augmenting the consolidated transaction file
 * produced by the chb pipeline at
 *   data/{year}/{month}/generated/transactions.json
 *
 * The frontend reads only from `generated/` — everything else is opaque.
 */

import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "./data-paths";
import {
  addressFromUri,
  ethereumAddressId,
  txHashFromUri,
  chainFromUri,
} from "./nip73";
import type {
  Transaction,
  TransactionType,
  TransactionsFile,
} from "@/types/transactions";
import type {
  CounterpartiesFile,
  CounterpartyMetadata,
} from "@/types/counterparties";
import settings from "@/settings/settings.json";

export type Direction = "CREDIT" | "DEBIT";

/** Read a single tx tag's value by key, or undefined if absent. */
export function tagValue(
  tx: Pick<Transaction, "tags">,
  key: string
): string | undefined {
  for (const t of tx.tags ?? []) {
    if (t[0] === key && typeof t[1] === "string") return t[1];
  }
  return undefined;
}

/**
 * Resolve the direction of a tx relative to its accountId.
 *
 * CREDIT / MINT → into the account (incoming).
 * DEBIT / BURN  → out of the account (outgoing).
 * INTERNAL      → look at the per-row "direction" tag/metadata.
 * TRANSFER      → compare the `from` tag against the account address.
 */
export function txDirection(tx: Transaction): Direction {
  switch (tx.type) {
    case "CREDIT":
    case "MINT":
      return "CREDIT";
    case "DEBIT":
    case "BURN":
      return "DEBIT";
    case "INTERNAL": {
      const dir =
        tagValue(tx, "direction") ??
        (typeof tx.metadata?.direction === "string"
          ? (tx.metadata.direction as string)
          : undefined);
      return dir === "CREDIT" ? "CREDIT" : "DEBIT";
    }
    case "TRANSFER": {
      const fromTag = tagValue(tx, "from")?.toLowerCase();
      const accountAddr = addressFromUri(tx.accountId);
      if (fromTag && accountAddr) {
        return fromTag === accountAddr ? "DEBIT" : "CREDIT";
      }
      return "CREDIT";
    }
  }
}

/**
 * Extract the on-chain (or stripe) hash/id for explorer linking.
 * Returns a 0x… hash for blockchain rows or null for stripe rows.
 */
export function txHashFor(tx: Transaction): string | null {
  return txHashFromUri(tx.id);
}

export function accountAddressFor(tx: Transaction): string | null {
  return addressFromUri(tx.accountId);
}

export function counterpartyAddressFor(tx: Transaction): string | null {
  return addressFromUri(tx.counterpartyId);
}

/** Both sides are accounts we control. */
export function isInternalTransfer(tx: Transaction): boolean {
  return tx.type === "INTERNAL";
}

export function readMonthlyTransactions(
  year: string,
  month: string
): Transaction[] {
  const filePath = path.join(
    DATA_DIR,
    year,
    month,
    "generated",
    "transactions.json"
  );
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(
      fs.readFileSync(filePath, "utf-8")
    ) as TransactionsFile;
    return data.transactions ?? [];
  } catch (error) {
    console.error(
      `Error reading consolidated transactions for ${year}-${month}:`,
      error
    );
    return [];
  }
}

/**
 * Fill in names for our own finance accounts so that when one of them
 * shows up as a counterparty on another row (typical for INTERNAL
 * transfers) it renders with a human label. Only writes when the
 * generated/counterparties.json entry for that URI doesn't already
 * carry a name.
 */
function seedWithFinanceAccounts(
  map: Map<string, CounterpartyMetadata>
): void {
  for (const account of settings.finance.accounts) {
    if (!account.address || !account.chain) continue;
    const uri = ethereumAddressId(account.chain, account.address);
    if (!uri) continue;
    const existing = map.get(uri);
    if (existing?.name?.trim()) continue;
    map.set(uri, { ...(existing ?? {}), name: account.name });
  }
}

export function readMonthlyCounterpartyMetadata(
  year: string,
  month: string
): Map<string, CounterpartyMetadata> {
  const out = new Map<string, CounterpartyMetadata>();
  const filePath = path.join(
    DATA_DIR,
    year,
    month,
    "generated",
    "counterparties.json"
  );
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(
        fs.readFileSync(filePath, "utf-8")
      ) as CounterpartiesFile;
      for (const [id, meta] of Object.entries(data.counterparties ?? {})) {
        out.set(id, meta);
      }
    } catch (error) {
      console.error(
        `Error reading counterparty metadata for ${year}-${month}:`,
        error
      );
    }
  }
  seedWithFinanceAccounts(out);
  return out;
}

/**
 * Shape passed to <FinanceTransactionTable>. Layered on top of Transaction
 * with the legacy "TokenTransfer"-style fields the table still reads.
 *
 * `type` is overwritten to the synthesised CREDIT/DEBIT direction so the
 * table's direction logic keeps working for MINT/BURN/TRANSFER/INTERNAL
 * rows. The original chb type is preserved as `rawType` if needed.
 */
export interface AugmentedTransaction
  extends Omit<Transaction, "type"> {
  type: Direction;
  rawType: TransactionType;
  transactionId: string;
  transactionUri: string;
  transactionMetadata: Transaction["metadata"];
  counterpartyMetadata?: CounterpartyMetadata;
  // TokenTransfer-compat fields:
  hash?: string;
  timeStamp: string;
  from?: string;
  to?: string;
  /** Stripe charge id parsed from `tx.id` when applicable, for legacy links. */
  stripeChargeId?: string;
}

/**
 * Set of NIP-73 URIs for the addresses we own (settings.finance.accounts).
 * Used to decide whether `accountId` is "us" or an external community
 * member when picking the display counterparty.
 */
const ORG_ACCOUNT_URIS: Set<string> = (() => {
  const out = new Set<string>();
  for (const account of settings.finance.accounts) {
    if (!account.address || !account.chain) continue;
    const uri = ethereumAddressId(account.chain, account.address);
    if (uri) out.add(uri);
  }
  return out;
})();

/**
 * Pick the "meaningful" counterparty URI for display.
 *
 * chb writes the raw on-chain counterparty in `counterpartyId`. For
 * MINT/BURN rows that's the token contract (EURe, CHT, …), which isn't
 * a useful counterpart to show. Two distinct cases:
 *
 *  - CHT MINT/BURN: `accountId` is a community member (Leen, Doug, …)
 *    who's the actual "active" participant of the row — swap it in.
 *  - Monerium EURe/EURb MINT/BURN: `accountId` is one of our own org
 *    accounts (Checking, Savings, …). The real counterpart is the bank
 *    sender/recipient, which chb doesn't put in `generated/`. Don't
 *    swap — accountId is *us*, not the counterpart. The row will show
 *    "—" until chb populates a real counterparty.
 */
function displayCounterpartyId(tx: Transaction): string | null {
  const isTokenCp =
    !!tx.counterpartyId && tx.counterpartyId.includes(":token:");
  const needsSwap =
    tx.type === "MINT" || tx.type === "BURN" || isTokenCp;
  if (!needsSwap) return tx.counterpartyId;
  // Only swap when accountId isn't one of our org accounts; otherwise we
  // end up labelling the row with our own account name, which is wrong.
  if (ORG_ACCOUNT_URIS.has(tx.accountId)) return tx.counterpartyId;
  return tx.accountId;
}

/**
 * Resolve TokenTransfer-style compat fields for a single tx.
 */
export function augmentTransaction(
  tx: Transaction,
  counterpartyMetadataMap: Map<string, CounterpartyMetadata>
): AugmentedTransaction {
  const effectiveCounterpartyId = displayCounterpartyId(tx);
  const counterpartyMetadata = effectiveCounterpartyId
    ? counterpartyMetadataMap.get(effectiveCounterpartyId)
    : undefined;

  const accountAddr = accountAddressFor(tx);
  const cpAddr = counterpartyAddressFor(tx);
  const fromTag = tagValue(tx, "from")?.toLowerCase();
  const toTag = tagValue(tx, "to")?.toLowerCase();
  const direction = txDirection(tx);

  const from =
    fromTag ?? (direction === "CREDIT" ? cpAddr : accountAddr) ?? undefined;
  const to =
    toTag ?? (direction === "CREDIT" ? accountAddr : cpAddr) ?? undefined;

  const stripeChargeId =
    tx.provider === "stripe" && tx.id.startsWith("stripe:")
      ? tx.id.slice("stripe:".length)
      : undefined;

  return {
    ...tx,
    counterpartyId: effectiveCounterpartyId,
    type: direction,
    rawType: tx.type,
    transactionId: tx.id,
    transactionUri: tx.id,
    transactionMetadata: tx.metadata,
    counterpartyMetadata,
    hash: txHashFor(tx) ?? undefined,
    timeStamp: tx.timestamp.toString(),
    from,
    to,
    stripeChargeId,
    chain: tx.chain ?? chainFromUri(tx.id),
  };
}
