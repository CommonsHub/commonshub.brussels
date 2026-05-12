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
  if (!fs.existsSync(filePath)) return out;
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
 * Resolve TokenTransfer-style compat fields for a single tx.
 */
export function augmentTransaction(
  tx: Transaction,
  counterpartyMetadataMap: Map<string, CounterpartyMetadata>
): AugmentedTransaction {
  const counterpartyMetadata = tx.counterpartyId
    ? counterpartyMetadataMap.get(tx.counterpartyId)
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
