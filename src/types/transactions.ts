/**
 * Transactions data types
 * Schema produced by the chb pipeline in
 *   data/{year}/{month}/generated/transactions.json
 */

export interface TransactionMetadata {
  description?: string;
  category?: string;
  collective?: string;
  project?: string | null;
  event?: string | null;
  tags?: string[];
  // chb writes free-form per-source fields here (e.g. fromName, toName,
  // direction, moneriumKind, stripe_*). Keep open for forwards-compat.
  [key: string]: unknown;
}

export type TransactionType =
  | "CREDIT"
  | "DEBIT"
  | "MINT"
  | "BURN"
  | "TRANSFER"
  | "INTERNAL";

export interface Transaction {
  /** Full NIP-73 URI for the tx, e.g. `ethereum:100:tx:0x…` or `stripe:txn_…`. */
  id: string;
  /** Provider-native identifier (tx hash for blockchain, balance-transaction id for stripe). */
  providerId?: string;
  provider: "etherscan" | "stripe";
  chain: string | null;
  /** NIP-73 URI for the account that owns the row, e.g. `ethereum:100:address:0x…` or `stripe:acct_…`. */
  accountId: string;
  accountSlug: string;
  accountName: string;
  /** NIP-73 URI for the counterparty, or null when there isn't one. */
  counterpartyId: string | null;
  currency: string;
  value: string;
  amount: number;
  netAmount: number;
  grossAmount: number;
  normalizedAmount: number;
  fee: number;
  type: TransactionType;
  timestamp: number;
  tags?: Array<[string, ...string[]]>;
  metadata: TransactionMetadata;
}

export interface TransactionsFile {
  year?: string;
  month: string;
  generatedAt: string;
  transactions: Transaction[];
}
