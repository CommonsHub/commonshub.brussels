import fs from "fs";
import path from "path";
import settings from "@/settings/settings.json";
import { DATA_DIR } from "@/lib/data-paths";
import { isInternalTransfer } from "@/lib/transactions";
import type { Transaction, TransactionsFile } from "@/types/transactions";

export interface MonthlyBreakdown {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface FinanceRecentTransaction {
  hash: string;
  date: string;
  from?: string;
  to?: string;
  value?: number;
  type?: string;
  description?: string;
  amount?: number;
  fee?: number;
  net?: number;
  direction?: "in" | "out";
  source?: string;
  reportingCategory?: string;
}

export interface AccountData {
  slug: string;
  name: string;
  provider: string;
  chain?: string;
  address?: string;
  tokenSymbol: string;
  currency?: string;
  balance: number;
  /** Where `balance` came from: chb's live balances.json vs summing transactions. */
  balanceSource?: "live" | "derived";
  /** Balance computed by summing generated transactions (for diagnostics). */
  derivedBalance?: number;
  totalInflow: number;
  totalOutflow: number;
  monthlyBreakdown: MonthlyBreakdown[];
  recentTransactions: FinanceRecentTransaction[];
  lastModified?: number | null;
}

export interface FinancialsOverview {
  accounts: AccountData[];
  aggregatedMonthlyBreakdown: MonthlyBreakdown[];
  totalInflow: number;
  totalOutflow: number;
  lastModified: number | null;
}

const FINANCE_CACHE_FILE = path.join(DATA_DIR, "finance.json");

/**
 * Get the last modified time of the most recently updated generated finance file.
 * Returns null if no files exist.
 */
function getCurrentMonthLastModified(): number | null {
  try {
    let latestMtime: number | null = null;

    const trackMtime = (filePath: string) => {
      if (!fs.existsSync(filePath)) return;
      const stats = fs.statSync(filePath);
      if (!latestMtime || stats.mtimeMs > latestMtime) {
        latestMtime = stats.mtimeMs;
      }
    };

    // First check finance.json from the legacy cache if it exists.
    if (fs.existsSync(FINANCE_CACHE_FILE)) {
      trackMtime(FINANCE_CACHE_FILE);
    }

    if (!fs.existsSync(DATA_DIR)) return latestMtime;

    const yearDirs = fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name));

    for (const yearDir of yearDirs) {
      const yearPath = path.join(DATA_DIR, yearDir.name);
      const monthDirs = fs
        .readdirSync(yearPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name));

      for (const monthDir of monthDirs) {
        const generatedDir = path.join(yearPath, monthDir.name, "generated");
        if (!fs.existsSync(generatedDir)) continue;
        for (const file of fs.readdirSync(generatedDir, {
          withFileTypes: true,
        })) {
          if (file.isFile() && file.name.endsWith(".json")) {
            trackMtime(path.join(generatedDir, file.name));
          }
        }
      }
    }

    return latestMtime;
  } catch (error) {
    console.error("Error getting current month last modified time:", error);
    return null;
  }
}

/**
 * Read chb's authoritative live balance for an account from latest/balances.json.
 * Balances are keyed by slug, Stripe accountId, or on-chain address (all lowercase),
 * mirroring how src/lib/reports.ts resolves them. Returns null when no live balance
 * is available so callers can fall back to the transaction-derived value.
 */
function getLiveBalance(account: any): number | null {
  const filePath = path.join(DATA_DIR, "latest", "balances.json");
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
      balances?: Record<string, number>;
    };
    const balances = data.balances ?? {};
    const keys: string[] = [];
    if (typeof account.slug === "string") keys.push(account.slug.toLowerCase());
    if (typeof account.accountId === "string")
      keys.push(account.accountId.toLowerCase());
    if (typeof account.iban === "string") keys.push(account.iban.toLowerCase());
    if (typeof account.address === "string") {
      keys.push(account.address.toLowerCase());
      // chb writes balances under chain-prefixed keys (e.g. "gnosis:0x…").
      if (typeof account.chain === "string") {
        keys.push(`${account.chain}:${account.address}`.toLowerCase());
      }
    }
    for (const key of keys) {
      if (typeof balances[key] === "number") return balances[key];
    }
  } catch (error) {
    console.error("Error reading latest balances.json:", error);
  }
  return null;
}

function calculateBalanceFromTransactions(transactions: Transaction[]): number {
  // Sum the signed normalizedAmount of every transaction — including INTERNAL
  // and TRANSFER rows. Transfers between our own accounts genuinely change this
  // account's balance, so they must be counted (only the org-wide aggregate
  // cancels them out). Summing this way reproduces the live on-chain balance to
  // the cent for any account whose transaction history is complete.
  return transactions.reduce((balance, tx) => {
    const amount = tx.normalizedAmount ?? tx.amount ?? 0;
    return balance + amount;
  }, 0);
}

function transactionValue(tx: Transaction): number {
  return tx.provider === "stripe"
    ? Math.abs(tx.normalizedAmount)
    : Math.abs(tx.amount);
}

/**
 * Load normalized transactions for an account from the generated
 * data/year/month/generated/transactions.json files.
 *
 * Generated transactions are keyed by `accountSlug`, which is the human slug
 * for on-chain accounts (savings, checking, …) but the provider account id for
 * Stripe (e.g. "acct_1Nn0FaFAhaWeDyow"). Match against both the configured slug
 * and accountId so Stripe transactions are picked up too.
 */
function loadNormalizedTransactions(account: any): Transaction[] {
  const identifiers = new Set<string>();
  if (typeof account.slug === "string") identifiers.add(account.slug);
  if (typeof account.accountId === "string") identifiers.add(account.accountId);

  const allTransactions: Transaction[] = [];

  try {
    if (!fs.existsSync(DATA_DIR)) {
      return [];
    }

    const yearDirs = fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    for (const year of yearDirs) {
      const yearPath = path.join(DATA_DIR, year);

      const monthDirs = fs
        .readdirSync(yearPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
        .map((dirent) => dirent.name)
        .sort();

      for (const month of monthDirs) {
        const transactionsPath = path.join(
          yearPath,
          month,
          "generated",
          "transactions.json"
        );

        if (!fs.existsSync(transactionsPath)) {
          continue;
        }

        try {
          const content = fs.readFileSync(transactionsPath, "utf-8");
          const data = JSON.parse(content) as TransactionsFile;
          const accountTransactions = data.transactions.filter(
            (tx) => identifiers.has(tx.accountSlug)
          );
          allTransactions.push(...accountTransactions);
        } catch (error) {
          console.error(`Error reading transactions for ${year}-${month}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(
      `Error loading normalized transactions for ${account?.slug}:`,
      error
    );
  }

  return allTransactions;
}

/**
 * Calculate aggregated monthly breakdown across all accounts (for the total row).
 */
function calculateAggregatedMonthlyBreakdown(
  accountsData: AccountData[]
): MonthlyBreakdown[] {
  const monthlyMap = new Map<string, { inflow: number; outflow: number }>();

  accountsData.forEach((accountData) => {
    accountData.monthlyBreakdown.forEach((month) => {
      if (!monthlyMap.has(month.month)) {
        monthlyMap.set(month.month, { inflow: 0, outflow: 0 });
      }
      const monthData = monthlyMap.get(month.month)!;
      monthData.inflow += month.inflow;
      monthData.outflow += month.outflow;
    });
  });

  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      inflow: Math.round(data.inflow * 100) / 100,
      outflow: Math.round(data.outflow * 100) / 100,
      net: Math.round((data.inflow - data.outflow) * 100) / 100,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

function fetchAccountData(
  account: any,
  filterInternal: boolean = false
): AccountData {
  const { address, token } = account;

  try {
    // Load normalized transactions from transactions.json
    const accountTransactions = loadNormalizedTransactions(account).sort(
      (a, b) => b.timestamp - a.timestamp // Sort by most recent first
    );
    let allTransactions = accountTransactions;

    // Filter out internal transactions only for overview (monthly breakdown summary)
    // Keep them for individual account views
    if (filterInternal) {
      allTransactions = allTransactions.filter(
        (tx) => !isInternalTransfer(tx) && tx.type !== "TRANSFER"
      );
    }

    // Prefer chb's authoritative live balance (latest/balances.json), which is
    // what `chb accounts` reports. Fall back to deriving the balance from
    // generated transactions only when no live balance is available (e.g. the
    // full transaction history hasn't been backfilled for this account).
    const liveBalance = getLiveBalance(account);
    const derivedBalance = calculateBalanceFromTransactions(accountTransactions);
    const balance = liveBalance !== null ? liveBalance : derivedBalance;

    // Calculate monthly breakdown
    const monthlyMap = new Map<string, { inflow: number; outflow: number }>();

    allTransactions.forEach((tx: any) => {
      const date = new Date(tx.timestamp * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      // Classify by the sign of the balance impact, counting every transaction
      // (including transfers between accounts). Summed across all of an account's
      // months this equals the balance change; aggregated across all accounts the
      // inter-account transfers cancel, so the total Net equals the total balance.
      const signed = tx.normalizedAmount ?? tx.amount ?? 0;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { inflow: 0, outflow: 0 });
      }

      const monthData = monthlyMap.get(monthKey)!;
      if (signed >= 0) {
        monthData.inflow += signed;
      } else {
        monthData.outflow += -signed;
      }
    });

    const monthlyBreakdown: MonthlyBreakdown[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        inflow: Math.round(data.inflow * 100) / 100,
        outflow: Math.round(data.outflow * 100) / 100,
        net: Math.round((data.inflow - data.outflow) * 100) / 100,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    // Format recent transactions. Stripe rows carry richer fields
    // (gross amount / fee / net / kind), so map them to the shape the Stripe
    // account page renders; on-chain rows use the generic transfer shape.
    const isStripe = account.provider === "stripe";
    const recentTransactions: FinanceRecentTransaction[] = allTransactions
      .slice(0, isStripe ? 100 : 20)
      .map((tx: any) => {
        const direction = (tx.normalizedAmount ?? tx.amount ?? 0) >= 0 ? "in" : "out";
        const description =
          typeof tx.metadata?.description === "string"
            ? tx.metadata.description
            : tx.type;
        if (isStripe) {
          return {
            hash: tx.providerId || tx.id,
            date: new Date(tx.timestamp * 1000).toISOString(),
            description,
            type:
              typeof tx.metadata?.kind === "string" ? tx.metadata.kind : tx.type,
            amount: Math.round((tx.grossAmount ?? tx.amount ?? 0) * 100) / 100,
            fee: Math.round((tx.fee ?? 0) * 100) / 100,
            net:
              Math.round(
                (tx.normalizedAmount ?? tx.netAmount ?? tx.amount ?? 0) * 100
              ) / 100,
            direction: direction as "in" | "out",
            reportingCategory:
              typeof tx.metadata?.category === "string"
                ? tx.metadata.category
                : undefined,
          };
        }
        return {
          hash: tx.providerId || tx.id,
          date: new Date(tx.timestamp * 1000).toISOString(),
          from: direction === "out" ? address : undefined,
          to: direction === "in" ? address : undefined,
          value: Math.round(transactionValue(tx) * 100) / 100,
          type: direction as "in" | "out",
          description,
        };
      });

    const totalInflow = monthlyBreakdown.reduce((sum, m) => sum + m.inflow, 0);
    const totalOutflow = monthlyBreakdown.reduce((sum, m) => sum + m.outflow, 0);

    return {
      slug: account.slug,
      name: account.name,
      provider: account.provider,
      chain: account.chain,
      address,
      tokenSymbol: token?.symbol || account.currency || "EUR",
      currency: account.currency,
      balance: Math.round(balance * 100) / 100,
      balanceSource: liveBalance !== null ? "live" : "derived",
      derivedBalance: Math.round(derivedBalance * 100) / 100,
      totalInflow: Math.round(totalInflow * 100) / 100,
      totalOutflow: Math.round(totalOutflow * 100) / 100,
      monthlyBreakdown,
      recentTransactions,
    };
  } catch (error) {
    console.error(`Error fetching account ${account.slug}:`, error);
    return {
      slug: account.slug,
      name: account.name,
      provider: account.provider,
      chain: account.chain,
      address: account.address,
      tokenSymbol: account.token?.symbol || account.currency || "EUR",
      currency: account.currency,
      balance: 0,
      totalInflow: 0,
      totalOutflow: 0,
      monthlyBreakdown: [],
      recentTransactions: [],
    };
  }
}

/**
 * Financial data for a single account (individual account view keeps internal
 * transfers). Returns null when the slug is not a configured finance account.
 */
export function getAccountFinancials(slug: string): AccountData | null {
  const account = settings.finance.accounts.find((a) => a.slug === slug);
  if (!account) return null;

  const accountData = fetchAccountData(account, false);
  accountData.lastModified = getCurrentMonthLastModified();
  return accountData;
}

/**
 * Aggregated financial data across all configured accounts (overview).
 * Internal transfers are excluded from the aggregated monthly breakdown.
 */
export function getFinancialsOverview(): FinancialsOverview {
  const lastModified = getCurrentMonthLastModified();

  // Only active accounts are shown and totalled. Archived accounts (drained or
  // migrated, ~€0) are hidden so the page isn't overloaded; they're excluded
  // from the totals too, since their pre-archive history is incomplete and
  // would otherwise break the reconciliation.
  const activeAccounts = settings.finance.accounts.filter(
    (account) => !("archivedAt" in account && (account as any).archivedAt)
  );

  // Count every transaction (including inter-account transfers) so the
  // aggregated inflow/outflow and Net reconcile to the change in total balance:
  // Net is the sum of every signed transaction, which equals the balance by
  // identity, and inter-account transfers cancel across the set.
  const accountsData = activeAccounts.map((account) =>
    fetchAccountData(account, false)
  );
  accountsData.forEach((account) => {
    account.lastModified = lastModified;
  });

  const aggregatedMonthlyBreakdown =
    calculateAggregatedMonthlyBreakdown(accountsData);

  const totalInflow = aggregatedMonthlyBreakdown.reduce(
    (sum, month) => sum + month.inflow,
    0
  );
  const totalOutflow = aggregatedMonthlyBreakdown.reduce(
    (sum, month) => sum + month.outflow,
    0
  );

  return {
    accounts: accountsData,
    aggregatedMonthlyBreakdown,
    totalInflow: Math.round(totalInflow * 100) / 100,
    totalOutflow: Math.round(totalOutflow * 100) / 100,
    lastModified,
  };
}
