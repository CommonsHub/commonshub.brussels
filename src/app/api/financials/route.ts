import { NextResponse } from "next/server";
import settings from "@/settings/settings.json";
import fs from "fs";
import path from "path";
import {
  parseTokenValue,
  getMonthKeyFromDate,
  type TokenTransfer,
} from "@/lib/etherscan";
import { calculateStripeBalance } from "@/lib/stripe";
import { DATA_DIR } from "@/lib/data-paths";
import { isInternalTransfer, txDirection } from "@/lib/transactions";
import type { Transaction, TransactionsFile } from "@/types/transactions";

interface MonthlyBreakdown {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}

interface AccountData {
  slug: string;
  name: string;
  provider: string;
  chain?: string;
  address?: string;
  tokenSymbol: string;
  currency?: string;
  balance: number;
  totalInflow: number;
  totalOutflow: number;
  monthlyBreakdown: MonthlyBreakdown[];
  recentTransactions: Array<{
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
    source?: any;
    reportingCategory?: string;
  }>;
  lastModified?: number | null;
}

// Cache durations
const BALANCE_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for balance (changes less frequently)
const CURRENT_MONTH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for current month transactions

// Cache file paths
const BALANCE_CACHE_FILE = path.join(DATA_DIR, "stripe-cache-balance.json");
const CURRENT_MONTH_CACHE_FILE = path.join(
  DATA_DIR,
  "stripe-cache-current-month.json"
);
const FINANCE_CACHE_FILE = path.join(DATA_DIR, "finance.json");
const ACCOUNT_BALANCE_CACHE_FILE = path.join(DATA_DIR, "latest", "balances.json");

interface StripeBalanceCache {
  data: {
    available: any[];
    pending: any[];
  };
  lastFetched: number;
}

interface StripeCurrentMonthCache {
  data: any[];
  lastFetched: number;
  month: string; // YYYY-MM format
}

interface AccountBalanceCache {
  fetchedAt?: string;
  balances?: Record<string, number>;
}

const CHAIN_RPC_URLS: Record<string, string> = {
  gnosis: "https://rpc.gnosischain.com",
};

// In-memory cache for faster access
const stripeBalanceCache: Map<string, { data: any; lastFetched: number }> =
  new Map();
const stripeCurrentMonthCache: Map<
  string,
  { data: any[]; lastFetched: number; month: string }
> = new Map();

/**
 * Get cache file path for a specific month
 * Format: data/year/month/finance/stripe/{accountId}.json
 */
function getMonthlyCacheFilePath(monthKey: string, accountId: string): string {
  const [year, month] = monthKey.split("-");
  return path.join(DATA_DIR, year, month, "finance", "stripe", `${accountId}.json`);
}

/**
 * Get cache file path for a specific month and account slug
 * Format: data/year/month/etherscan/:accountSlug-:address.json
 */
function getEtherscanMonthlyCacheFilePath(
  monthKey: string,
  accountSlug: string,
  address: string
): string {
  const [year, month] = monthKey.split("-");
  return path.join(DATA_DIR, year, month, "etherscan", `${accountSlug}-${address}.json`);
}

/**
 * Read monthly transactions from cache file
 */
function readMonthlyTransactions(monthKey: string): any[] | null {
  try {
    // Get Stripe account ID from settings
    const stripeAccount = settings.finance.accounts.find((a) => a.provider === "stripe");
    if (!stripeAccount || !stripeAccount.accountId) {
      console.error("Stripe account not found in settings or missing accountId");
      return null;
    }

    const filePath = getMonthlyCacheFilePath(monthKey, stripeAccount.accountId);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const cache = JSON.parse(fileContent) as { transactions: any[] };
      return cache.transactions || null;
    }
  } catch (error) {
    console.error(`Error reading monthly cache file for ${monthKey}:`, error);
  }
  return null;
}

/**
 * Write monthly transactions to cache file
 */
function writeMonthlyTransactions(monthKey: string, transactions: any[]): void {
  try {
    // Get Stripe account ID from settings
    const stripeAccount = settings.finance.accounts.find((a) => a.provider === "stripe");
    if (!stripeAccount || !stripeAccount.accountId) {
      console.error("Stripe account not found in settings or missing accountId");
      return;
    }

    const filePath = getMonthlyCacheFilePath(monthKey, stripeAccount.accountId);
    // Ensure nested directory structure exists (data/year/month/finance/stripe/)
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        { transactions, cachedAt: new Date().toISOString() },
        null,
        2
      ),
      "utf-8"
    );
  } catch (error) {
    console.error(`Error writing monthly cache file for ${monthKey}:`, error);
  }
}

/**
 * Get cached balance data
 */
function getCachedBalance(): { data: any; lastFetched: number } | null {
  const now = Date.now();

  // Check in-memory cache first
  const memoryCache = stripeBalanceCache.get("stripe");
  if (memoryCache && now - memoryCache.lastFetched < BALANCE_CACHE_DURATION) {
    return memoryCache;
  }

  // Check file cache
  try {
    if (fs.existsSync(BALANCE_CACHE_FILE)) {
      const fileContent = fs.readFileSync(BALANCE_CACHE_FILE, "utf-8");
      const fileCache = JSON.parse(fileContent) as StripeBalanceCache;
      if (now - fileCache.lastFetched < BALANCE_CACHE_DURATION) {
        // Update in-memory cache
        stripeBalanceCache.set("stripe", {
          data: fileCache.data,
          lastFetched: fileCache.lastFetched,
        });
        return {
          data: fileCache.data,
          lastFetched: fileCache.lastFetched,
        };
      }
    }
  } catch (error) {
    console.error("Error reading balance cache file:", error);
  }

  return null;
}

/**
 * Update balance cache
 */
function updateBalanceCache(balanceData: any): void {
  const now = Date.now();

  // Update in-memory cache
  stripeBalanceCache.set("stripe", {
    data: balanceData,
    lastFetched: now,
  });

  // Update file cache
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const cache: StripeBalanceCache = {
      data: balanceData,
      lastFetched: now,
    };
    fs.writeFileSync(
      BALANCE_CACHE_FILE,
      JSON.stringify(cache, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("Error writing balance cache file:", error);
  }
}

/**
 * Get cached current month transactions
 */
function getCachedCurrentMonth(): { data: any[]; month: string } | null {
  const now = Date.now();
  const currentMonth = getMonthKeyFromDate(new Date());

  // Check in-memory cache first
  const memoryCache = stripeCurrentMonthCache.get("stripe");
  if (
    memoryCache &&
    memoryCache.month === currentMonth &&
    now - memoryCache.lastFetched < CURRENT_MONTH_CACHE_DURATION
  ) {
    return { data: memoryCache.data, month: memoryCache.month };
  }

  // Check file cache
  try {
    if (fs.existsSync(CURRENT_MONTH_CACHE_FILE)) {
      const fileContent = fs.readFileSync(CURRENT_MONTH_CACHE_FILE, "utf-8");
      const fileCache = JSON.parse(fileContent) as StripeCurrentMonthCache;
      if (
        fileCache.month === currentMonth &&
        now - fileCache.lastFetched < CURRENT_MONTH_CACHE_DURATION
      ) {
        // Update in-memory cache
        stripeCurrentMonthCache.set("stripe", {
          data: fileCache.data,
          lastFetched: fileCache.lastFetched,
          month: fileCache.month,
        });
        return { data: fileCache.data, month: fileCache.month };
      }
    }
  } catch (error) {
    console.error("Error reading current month cache file:", error);
  }

  return null;
}

/**
 * Update current month transactions cache
 */
function updateCurrentMonthCache(transactions: any[]): void {
  const now = Date.now();
  const currentMonth = getMonthKeyFromDate(new Date());

  // Update in-memory cache
  stripeCurrentMonthCache.set("stripe", {
    data: transactions,
    lastFetched: now,
    month: currentMonth,
  });

  // Update file cache
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const cache: StripeCurrentMonthCache = {
      data: transactions,
      lastFetched: now,
      month: currentMonth,
    };
    fs.writeFileSync(
      CURRENT_MONTH_CACHE_FILE,
      JSON.stringify(cache, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("Error writing current month cache file:", error);
  }
}

/**
 * Read monthly transactions from cache file for etherscan account
 */
function readEtherscanMonthlyTransactions(
  monthKey: string,
  accountSlug: string,
  address: string
): TokenTransfer[] | null {
  try {
    const filePath = getEtherscanMonthlyCacheFilePath(monthKey, accountSlug, address);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const cache = JSON.parse(fileContent) as {
        transactions: TokenTransfer[];
      };
      return cache.transactions || null;
    }
  } catch (error) {
    console.error(
      `Error reading monthly cache file for ${accountSlug} in ${monthKey}:`,
      error
    );
  }
  return null;
}

/**
 * Load all historical transactions from monthly cache files
 * Reads from data/year/month/stripe.json structure
 * Now includes current month from cache
 */
function loadHistoricalTransactions(): any[] {
  const allTransactions: any[] = [];

  try {
    if (!fs.existsSync(DATA_DIR)) {
      return [];
    }

    // Read all year directories
    const yearDirs = fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    for (const year of yearDirs) {
      const yearPath = path.join(DATA_DIR, year);

      // Read all month directories in this year
      const monthDirs = fs
        .readdirSync(yearPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
        .map((dirent) => dirent.name)
        .sort();

      for (const month of monthDirs) {
        const monthKey = `${year}-${month}`;
        // Include all months including current month from cache
        const transactions = readMonthlyTransactions(monthKey);
        if (transactions) {
          allTransactions.push(...transactions);
        }
      }
    }
  } catch (error) {
    console.error("Error loading historical transactions:", error);
  }

  return allTransactions;
}

/**
 * Load all historical transactions from monthly cache files for etherscan account
 * Reads from data/year/month/etherscan/:accountSlug-:address.json structure
 */
function loadEtherscanHistoricalTransactions(
  accountSlug: string,
  address: string
): TokenTransfer[] {
  const allTransactions: TokenTransfer[] = [];
  const currentMonth = getMonthKeyFromDate(new Date());

  try {
    if (!fs.existsSync(DATA_DIR)) {
      return [];
    }

    // Read all year directories
    const yearDirs = fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    for (const year of yearDirs) {
      const yearPath = path.join(DATA_DIR, year);

      // Read all month directories in this year
      const monthDirs = fs
        .readdirSync(yearPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
        .map((dirent) => dirent.name)
        .sort();

      for (const month of monthDirs) {
        const monthKey = `${year}-${month}`;
        // Include current month from cache
        const transactions = readEtherscanMonthlyTransactions(
          monthKey,
          accountSlug,
          address
        );
        if (transactions) {
          allTransactions.push(...transactions);
        }
      }
    }
  } catch (error) {
    console.error(
      `Error loading historical transactions for ${accountSlug}:`,
      error
    );
  }

  return allTransactions;
}

/**
 * Get the last modified time of the most recently updated file in the current month folder
 * Returns null if no files exist in the current month folder
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
 * Read finance cache with balances and last transaction timestamps
 */
function readFinanceCache(): {
  lastUpdated: number;
  accounts: Array<{
    slug: string;
    balance: number;
    lastTransactionTimestamp: number | null;
  }>;
} | null {
  try {
    if (!fs.existsSync(FINANCE_CACHE_FILE)) {
      return null;
    }

    const fileContent = fs.readFileSync(FINANCE_CACHE_FILE, "utf-8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error("Error reading finance cache:", error);
    return null;
  }
}

/**
 * Get cached live balance for an account from chb's latest/balances.json
 */
function getCachedLiveAccountBalance(account: any): number | null {
  try {
    if (!fs.existsSync(ACCOUNT_BALANCE_CACHE_FILE)) {
      return null;
    }

    const fileContent = fs.readFileSync(ACCOUNT_BALANCE_CACHE_FILE, "utf-8");
    const cache = JSON.parse(fileContent) as AccountBalanceCache;
    if (!cache.balances) {
      return null;
    }

    for (const key of [
      account.address,
      account.accountId,
      account.iban,
      account.slug,
    ]) {
      if (!key) continue;
      const balance = cache.balances[String(key).toLowerCase()];
      if (typeof balance === "number") {
        return balance;
      }
    }
  } catch (error) {
    console.error("Error reading live account balance cache:", error);
  }

  return null;
}

/**
 * Get cached balance for an account from the legacy finance.json
 */
function getCachedAccountBalance(accountSlug: string): number | null {
  const financeCache = readFinanceCache();
  if (!financeCache) {
    return null;
  }

  const accountData = financeCache.accounts.find((a) => a.slug === accountSlug);
  return accountData ? accountData.balance : null;
}

/**
 * Get all tracked account addresses from settings
 */
function getTrackedAddresses(): Set<string> {
  const addresses = new Set<string>();
  settings.finance?.accounts?.forEach((account) => {
    if (account.provider === "etherscan" && account.address) {
      addresses.add(account.address.toLowerCase());
    }
  });
  return addresses;
}

/**
 * Filter out internal transactions (transactions between two tracked accounts)
 * and log them to console
 */
function filterInternalTransactions(
  transfers: TokenTransfer[]
): TokenTransfer[] {
  const trackedAddresses = getTrackedAddresses();
  const internalTransactions: TokenTransfer[] = [];
  const externalTransactions: TokenTransfer[] = [];

  transfers.forEach((tx) => {
    const fromLower = tx.from.toLowerCase();
    const toLower = tx.to.toLowerCase();

    // Check if both from and to are tracked accounts
    if (trackedAddresses.has(fromLower) && trackedAddresses.has(toLower)) {
      internalTransactions.push(tx);
      // console.log("Internal transaction filtered out:", {
      //   hash: tx.hash,
      //   from: tx.from,
      //   to: tx.to,
      //   value: tx.value,
      //   tokenSymbol: tx.tokenSymbol,
      //   timeStamp: tx.timeStamp,
      //   blockNumber: tx.blockNumber,
      // });
    } else {
      externalTransactions.push(tx);
    }
  });

  if (internalTransactions.length > 0) {
    console.log(
      `Filtered out ${internalTransactions.length} internal transaction(s)`
    );
  }

  return externalTransactions;
}

/**
 * Calculate aggregated monthly breakdown across all accounts,
 * excluding internal transactions (for the total row)
 */
function calculateAggregatedMonthlyBreakdown(
  accountsData: AccountData[]
): MonthlyBreakdown[] {
  const monthlyMap = new Map<string, { inflow: number; outflow: number }>();

  // Process each account
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

  // Convert to sorted array
  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      inflow: Math.round(data.inflow * 100) / 100,
      outflow: Math.round(data.outflow * 100) / 100,
      net: Math.round((data.inflow - data.outflow) * 100) / 100,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Load normalized transactions from transactions.json files
 * This reads the generated transactions.json files instead of raw API cache
 */
function loadNormalizedTransactions(accountSlug: string): Transaction[] {
  const allTransactions: Transaction[] = [];

  try {
    if (!fs.existsSync(DATA_DIR)) {
      return [];
    }

    // Read all year directories
    const yearDirs = fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    for (const year of yearDirs) {
      const yearPath = path.join(DATA_DIR, year);

      // Read all month directories in this year
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
            (tx) => tx.accountSlug === accountSlug
          );
          allTransactions.push(...accountTransactions);
        } catch (error) {
          console.error(`Error reading transactions for ${year}-${month}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(
      `Error loading normalized transactions for ${accountSlug}:`,
      error
    );
  }

  return allTransactions;
}

function transactionValue(tx: Transaction): number {
  return tx.provider === "stripe"
    ? Math.abs(tx.normalizedAmount)
    : Math.abs(tx.amount);
}

function calculateBalanceFromTransactions(transactions: Transaction[]): number {
  return transactions.reduce((balance, tx) => {
    const signedValue = txDirection(tx) === "CREDIT"
      ? transactionValue(tx)
      : -transactionValue(tx);
    return balance + signedValue;
  }, 0);
}

function parseTokenBalance(hexValue: string, decimals: number): number | null {
  try {
    const raw = BigInt(hexValue);
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const fraction = raw % divisor;
    return Number(whole) + Number(fraction) / 10 ** decimals;
  } catch {
    return null;
  }
}

async function fetchLiveBlockchainAccountBalance(
  account: any
): Promise<number | null> {
  if (account.provider !== "etherscan" || !account.address || !account.token) {
    return null;
  }

  const rpcUrl = CHAIN_RPC_URLS[account.chain];
  if (!rpcUrl) {
    return null;
  }

  const addressParam = account.address
    .toLowerCase()
    .replace(/^0x/, "")
    .padStart(64, "0");

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          {
            to: account.token.address,
            data: `0x70a08231${addressParam}`,
          },
          "latest",
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as { result?: string };
    if (!result.result || !/^0x[0-9a-fA-F]+$/.test(result.result)) {
      return null;
    }

    return parseTokenBalance(result.result, account.token.decimals);
  } catch (error) {
    console.error(`Error fetching live balance for ${account.slug}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  const accounts = settings.finance.accounts;

  // Get last modified time for current month folder
  const lastModified = getCurrentMonthLastModified();

  // If slug is provided, fetch only that account
  if (slug) {
    const account = accounts.find((a) => a.slug === slug);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Individual account view: keep all transactions including internal ones
    const accountData = await fetchAccountData(account, false);
    accountData.lastModified = lastModified;
    return NextResponse.json(accountData);
  }

  // Otherwise fetch all accounts (overview)
  try {
    // Fetch all accounts with all transactions (for per-account breakdown)
    const accountsData = await Promise.all(
      accounts.map((account) => fetchAccountData(account, true))
    );
    // Add lastModified to all accounts
    accountsData.forEach((account) => {
      account.lastModified = lastModified;
    });

    // Calculate aggregated monthly breakdown excluding internal transactions
    const aggregatedMonthlyBreakdown =
      calculateAggregatedMonthlyBreakdown(accountsData);

    // Calculate total inflow and outflow across all accounts (excluding internal transactions)
    const totalInflow = aggregatedMonthlyBreakdown.reduce((sum, month) => sum + month.inflow, 0);
    const totalOutflow = aggregatedMonthlyBreakdown.reduce((sum, month) => sum + month.outflow, 0);

    return NextResponse.json({
      accounts: accountsData,
      aggregatedMonthlyBreakdown,
      totalInflow: Math.round(totalInflow * 100) / 100,
      totalOutflow: Math.round(totalOutflow * 100) / 100,
      lastModified,
    });
  } catch (error) {
    console.error("Error fetching financials:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial data" },
      { status: 500 }
    );
  }
}

async function fetchAccountData(
  account: any,
  filterInternal: boolean = false
): Promise<AccountData> {
  const { address, token } = account;

  try {
    // Load normalized transactions from transactions.json
    const accountTransactions = loadNormalizedTransactions(account.slug).sort(
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

    // Get balance from chain first, then chb's cache, legacy finance cache,
    // and finally derive it from generated transactions.
    const liveBalance = await fetchLiveBlockchainAccountBalance(account);
    const cachedBalance =
      liveBalance ??
      getCachedLiveAccountBalance(account) ??
      getCachedAccountBalance(account.slug);
    const balance =
      cachedBalance !== null
        ? cachedBalance
        : calculateBalanceFromTransactions(accountTransactions);

    // Calculate monthly breakdown
    const monthlyMap = new Map<string, { inflow: number; outflow: number }>();

    allTransactions.forEach((tx: any) => {
      const date = new Date(tx.timestamp * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const value = transactionValue(tx);

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { inflow: 0, outflow: 0 });
      }

      const monthData = monthlyMap.get(monthKey)!;
      if (txDirection(tx) === "CREDIT") {
        monthData.inflow += value;
      } else {
        monthData.outflow += value;
      }
    });

    // Convert to sorted array
    const monthlyBreakdown: MonthlyBreakdown[] = Array.from(
      monthlyMap.entries()
    )
      .map(([month, data]) => ({
        month,
        inflow: Math.round(data.inflow * 100) / 100,
        outflow: Math.round(data.outflow * 100) / 100,
        net: Math.round((data.inflow - data.outflow) * 100) / 100,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    // Format recent transactions
    const recentTransactions = allTransactions
      .slice(0, 20)
      .map((tx: any) => ({
        hash: tx.providerId || tx.id,
        date: new Date(tx.timestamp * 1000).toISOString(),
        from: txDirection(tx) === "DEBIT" ? address : undefined,
        to: txDirection(tx) === "CREDIT" ? address : undefined,
        value:
          Math.round(transactionValue(tx) * 100) / 100,
        type: (txDirection(tx) === "CREDIT" ? "in" : "out") as "in" | "out",
        description:
          typeof tx.metadata?.description === "string"
            ? tx.metadata.description
            : tx.type,
      }));

    // Calculate totals
    const totalInflow = monthlyBreakdown.reduce((sum, m) => sum + m.inflow, 0);
    const totalOutflow = monthlyBreakdown.reduce(
      (sum, m) => sum + m.outflow,
      0
    );

    return {
      slug: account.slug,
      name: account.name,
      provider: account.provider,
      chain: account.chain,
      address,
      tokenSymbol: token?.symbol || account.currency || "EUR",
      currency: account.currency,
      balance: Math.round(balance * 100) / 100,
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
      balance: 0,
      totalInflow: 0,
      totalOutflow: 0,
      monthlyBreakdown: [],
      recentTransactions: [],
    };
  }
}

async function fetchStripeAccountData(account: any): Promise<AccountData> {
  try {
    // Get balance from finance.json cache
    const cachedBalance =
      getCachedLiveAccountBalance(account) ?? getCachedAccountBalance(account.slug);
    const balance = cachedBalance !== null ? cachedBalance : 0;

    // Load all transactions from monthly cache files (including current month)
    const allTransactions = loadHistoricalTransactions().sort(
      (a, b) => b.created - a.created // Sort by most recent first
    );

    // Calculate monthly breakdown
    const monthlyMap = new Map<string, { inflow: number; outflow: number }>();

    allTransactions.forEach((tx: any) => {
      const date = new Date(tx.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const value = Math.abs(tx.net) / 100;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { inflow: 0, outflow: 0 });
      }

      const monthData = monthlyMap.get(monthKey)!;
      if (tx.net > 0) {
        monthData.inflow += value;
      } else {
        monthData.outflow += value;
      }
    });

    // Convert to sorted array
    const monthlyBreakdown: MonthlyBreakdown[] = Array.from(
      monthlyMap.entries()
    )
      .map(([month, data]) => ({
        month,
        inflow: Math.round(data.inflow * 100) / 100,
        outflow: Math.round(data.outflow * 100) / 100,
        net: Math.round((data.inflow - data.outflow) * 100) / 100,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    const recentTransactions = allTransactions.slice(0, 100).map((tx: any) => ({
      hash: tx.id,
      date: new Date(tx.created * 1000).toISOString(),
      description: tx.description || tx.type,
      type: tx.type,
      amount: Math.round((tx.amount / 100) * 100) / 100,
      fee: Math.round((tx.fee / 100) * 100) / 100,
      net: Math.round((tx.net / 100) * 100) / 100,
      direction: (tx.net > 0 ? "in" : "out") as "in" | "out",
      // Extract source ID from source object if it exists
      source: tx.source?.id || tx.source || null,
      // For linking to Stripe dashboard
      reportingCategory: tx.reporting_category,
    }));

    // Calculate totals
    const totalInflow = monthlyBreakdown.reduce((sum, m) => sum + m.inflow, 0);
    const totalOutflow = monthlyBreakdown.reduce(
      (sum, m) => sum + m.outflow,
      0
    );

    return {
      slug: account.slug,
      name: account.name,
      provider: account.provider,
      tokenSymbol: account.currency || "EUR",
      currency: account.currency,
      balance: Math.round(balance * 100) / 100,
      totalInflow: Math.round(totalInflow * 100) / 100,
      totalOutflow: Math.round(totalOutflow * 100) / 100,
      monthlyBreakdown,
      recentTransactions,
    };
  } catch (error) {
    console.error(`Error fetching Stripe account ${account.slug}:`, error);
    return {
      slug: account.slug,
      name: account.name,
      provider: account.provider,
      tokenSymbol: account.currency || "EUR",
      currency: account.currency,
      balance: 0,
      totalInflow: 0,
      totalOutflow: 0,
      monthlyBreakdown: [],
      recentTransactions: [],
    };
  }
}
