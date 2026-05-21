import { notFound } from "next/navigation";
import * as fs from "fs";
import * as path from "path";
import settings from "@/settings/settings.json";
import { isAdmin } from "@/lib/admin-check";
import type { TokenTransfer } from "@/lib/etherscan";
import type { MoneriumOrder } from "@/lib/monerium-node";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PageProps {
  params: Promise<{
    year: string;
    month: string;
  }>;
}

interface TransactionWithMonerium extends TokenTransfer {
  moneriumOrder?: MoneriumOrder;
  accountSlug: string;
}

interface CounterpartSummary {
  name: string;
  iban?: string;
  totalIncoming: bigint;
  totalOutgoing: bigint;
  transactionCount: number;
  accountSlug?: string;
}

type FinanceAccount = (typeof settings.finance.accounts)[number];
type EtherscanFinanceAccount = FinanceAccount & {
  provider: "etherscan";
  address: string;
  chain: string;
  token: { symbol: string; decimals: string | number };
};

function isEtherscanAccount(account: FinanceAccount | undefined): account is EtherscanFinanceAccount {
  return Boolean(
    account?.provider === "etherscan" &&
    typeof account.address === "string" &&
    typeof account.chain === "string" &&
    account.token !== undefined
  );
}

/**
 * Load transactions for all accounts in a month
 */
async function loadAllMonthlyTransactions(
  year: string,
  month: string
): Promise<Map<string, TokenTransfer[]>> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const transactionsByAccount = new Map<string, TokenTransfer[]>();

  const etherscanAccounts = settings.finance.accounts.filter(isEtherscanAccount);

  for (const account of etherscanAccounts) {
    const filePath = path.join(
      dataDir,
      year,
      month,
      account.chain,
      account.token.symbol,
      `${account.address}.json`
    );

    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(fileContent);
        if (data.transactions) {
          transactionsByAccount.set(account.slug, data.transactions);
        }
      } catch (error) {
        console.error(`Error reading transaction file for ${account.slug}:`, error);
      }
    }
  }

  return transactionsByAccount;
}

/**
 * Load Monerium orders for all accounts in a month
 */
async function loadAllMoneriumOrders(
  year: string,
  month: string
): Promise<Map<string, Map<string, MoneriumOrder>>> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const ordersByAccount = new Map<string, Map<string, MoneriumOrder>>();

  const etherscanAccounts = settings.finance.accounts.filter(isEtherscanAccount);

  for (const account of etherscanAccounts) {
    const filePath = path.join(
      dataDir,
      year,
      month,
      "private",
      "monerium",
      `${account.address.toLowerCase()}.json`
    );

    const ordersByTxHash = new Map<string, MoneriumOrder>();

    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(fileContent);
        const orders = data.orders || [];

        for (const order of orders) {
          if (order.meta?.txHashes) {
            for (const txHash of order.meta.txHashes) {
              ordersByTxHash.set(txHash.toLowerCase(), order);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading Monerium file for ${account.slug}:`, error);
      }
    }

    ordersByAccount.set(account.slug, ordersByTxHash);
  }

  return ordersByAccount;
}

/**
 * Format amount with proper decimals, thousand separators, and currency symbol
 */
function formatAmount(value: string, decimals: number, tokenSymbol: string, showDecimals: boolean = true): string {
  const num = BigInt(value);
  const divisor = BigInt(10 ** decimals);
  const integerPart = num / divisor;
  const fractionalPart = num % divisor;

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  // Format integer part with thousand separators
  const integerStr = integerPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  let formattedNumber;
  if (!showDecimals || trimmedFractional === "") {
    formattedNumber = integerStr;
  } else {
    formattedNumber = `${integerStr}.${trimmedFractional}`;
  }

  // Check if it's a EUR currency
  const isEuro = tokenSymbol === "EUR" || tokenSymbol === "EURe" || tokenSymbol === "EURb";

  if (isEuro) {
    return `€${formattedNumber}`;
  }

  return formattedNumber;
}

export default async function MonthlyFinanceAggregatePage({ params }: PageProps) {
  const { year, month } = await params;

  // Load all transactions
  const transactionsByAccount = await loadAllMonthlyTransactions(year, month);

  if (transactionsByAccount.size === 0) {
    notFound();
  }

  // Check if user is admin
  const userIsAdmin = await isAdmin();

  // Load Monerium data if admin
  let moneriumOrdersByAccount = new Map<string, Map<string, MoneriumOrder>>();
  if (userIsAdmin) {
    moneriumOrdersByAccount = await loadAllMoneriumOrders(year, month);
  }

  // Augment all transactions
  const allAugmentedTransactions: TransactionWithMonerium[] = [];
  let totalTransactions = 0;

  for (const [accountSlug, transactions] of transactionsByAccount) {
    const moneriumOrders = moneriumOrdersByAccount.get(accountSlug) || new Map();

    for (const tx of transactions) {
      allAugmentedTransactions.push({
        ...tx,
        moneriumOrder: userIsAdmin ? moneriumOrders.get(tx.hash.toLowerCase()) : undefined,
        accountSlug,
      });
      totalTransactions++;
    }
  }

  const monthName = new Date(`${year}-${month}-01`).toLocaleString("en-US", { month: "long", year: "numeric" });

  // Calculate breakdown by counterpart (with accounts as fallback)
  let customers: Array<CounterpartSummary> = [];
  let vendors: Array<CounterpartSummary> = [];

  if (userIsAdmin) {
    const counterpartBreakdown = new Map<string, CounterpartSummary>();

    for (const tx of allAugmentedTransactions) {
      const account = settings.finance.accounts.find((a): a is EtherscanFinanceAccount => a.slug === tx.accountSlug && isEtherscanAccount(a));
      if (!account) continue;

      const isIncoming = tx.to.toLowerCase() === account.address.toLowerCase();
      const amount = BigInt(tx.value);

      let counterpartKey: string;
      let counterpartName: string;
      let iban: string | undefined;

      if (tx.moneriumOrder?.counterpart) {
        // Has Monerium data - use actual counterpart
        counterpartName = tx.moneriumOrder.counterpart.details.name;
        iban = tx.moneriumOrder.counterpart.identifier.iban;
        counterpartKey = `counterpart:${counterpartName}`;
      } else {
        // No Monerium data - use account as counterpart
        counterpartName = account.name;
        counterpartKey = `account:${tx.accountSlug}`;
      }

      const existing = counterpartBreakdown.get(counterpartKey);
      if (existing) {
        if (isIncoming) {
          existing.totalIncoming += amount;
        } else {
          existing.totalOutgoing += amount;
        }
        existing.transactionCount++;
      } else {
        counterpartBreakdown.set(counterpartKey, {
          name: counterpartName,
          iban,
          totalIncoming: isIncoming ? amount : BigInt(0),
          totalOutgoing: isIncoming ? BigInt(0) : amount,
          transactionCount: 1,
          accountSlug: counterpartKey.startsWith('account:') ? tx.accountSlug : undefined,
        });
      }
    }

    const sorted = Array.from(counterpartBreakdown.values()).sort((a, b) => {
      const aTotal = a.totalIncoming + a.totalOutgoing;
      const bTotal = b.totalIncoming + b.totalOutgoing;
      return Number(bTotal - aTotal);
    });

    customers = sorted.filter(c => c.totalIncoming > BigInt(0));
    vendors = sorted.filter(c => c.totalOutgoing > BigInt(0));
  }

  const showD3Viz = customers.length >= 3 && vendors.length >= 3;

  // Calculate totals by account
  const accountSummaries = Array.from(transactionsByAccount.entries()).map(([accountSlug, transactions]) => {
    const account = settings.finance.accounts.find((a): a is EtherscanFinanceAccount => a.slug === accountSlug && isEtherscanAccount(a));
    if (!account) return null;

    let incoming = BigInt(0);
    let outgoing = BigInt(0);

    for (const tx of transactions) {
      const isIncoming = tx.to.toLowerCase() === account.address.toLowerCase();
      if (isIncoming) {
        incoming += BigInt(tx.value);
      } else {
        outgoing += BigInt(tx.value);
      }
    }

    return {
      accountSlug,
      account,
      incoming,
      outgoing,
      count: transactions.length,
    };
  }).filter(Boolean);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          All Accounts - Finance
        </h1>
        <p className="text-muted-foreground">
          {monthName} - {totalTransactions} transactions across {transactionsByAccount.size} accounts
        </p>
      </div>

      {/* Account summaries */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Accounts Overview</CardTitle>
          <CardDescription>Summary by account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {accountSummaries.map((summary) => {
              if (!summary) return null;
              const decimals = parseInt(summary.account.token.decimals.toString());
              const net = summary.incoming - summary.outgoing;

              return (
                <a
                  key={summary.accountSlug}
                  href={`/${year}/${month}/finance/${summary.accountSlug}`}
                  className="block p-4 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{summary.account.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {summary.count} transactions • {summary.account.token.symbol}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-green-600">
                        +{formatAmount(summary.incoming.toString(), decimals, summary.account.token.symbol, false)}
                      </div>
                      <div className="text-sm text-red-600">
                        -{formatAmount(summary.outgoing.toString(), decimals, summary.account.token.symbol, false)}
                      </div>
                      <div className={`text-sm font-semibold ${net >= BigInt(0) ? 'text-green-600' : 'text-red-600'}`}>
                        {net >= BigInt(0) ? '+' : ''}{formatAmount(net.toString(), decimals, summary.account.token.symbol, false)}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Counterpart breakdown - two-column view */}
      {userIsAdmin && (customers.length > 0 || vendors.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Top Counterparts</CardTitle>
            <CardDescription>
              Customers and vendors across all accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {customers.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-green-600">Customers (Incoming)</h3>
                  <div className="space-y-2">
                    {customers.slice(0, 10).map((customer, idx) => {
                      // Get token symbol from account if it's an account-based entry
                      const account = customer.accountSlug
                        ? settings.finance.accounts.find((a): a is EtherscanFinanceAccount => a.slug === customer.accountSlug && isEtherscanAccount(a))
                        : null;
                      const decimals = account ? parseInt(account.token.decimals.toString()) : 18;
                      const tokenSymbol = account?.token.symbol || 'EUR';
                      const amount = formatAmount(customer.totalIncoming.toString(), decimals, tokenSymbol, false);

                      return (
                        <div key={idx} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            {customer.iban && (
                              <div className="text-xs text-muted-foreground font-mono">{customer.iban}</div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {customer.transactionCount} transaction{customer.transactionCount > 1 ? 's' : ''}
                              {customer.accountSlug && ` • ${account?.name}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-600">+{amount}</div>
                            <div className="text-xs text-muted-foreground">{tokenSymbol}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {vendors.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-red-600">Vendors (Outgoing)</h3>
                  <div className="space-y-2">
                    {vendors.slice(0, 10).map((vendor, idx) => {
                      // Get token symbol from account if it's an account-based entry
                      const account = vendor.accountSlug
                        ? settings.finance.accounts.find((a): a is EtherscanFinanceAccount => a.slug === vendor.accountSlug && isEtherscanAccount(a))
                        : null;
                      const decimals = account ? parseInt(account.token.decimals.toString()) : 18;
                      const tokenSymbol = account?.token.symbol || 'EUR';
                      const amount = formatAmount(vendor.totalOutgoing.toString(), decimals, tokenSymbol, false);

                      return (
                        <div key={idx} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                          <div>
                            <div className="font-medium">{vendor.name}</div>
                            {vendor.iban && (
                              <div className="text-xs text-muted-foreground font-mono">{vendor.iban}</div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {vendor.transactionCount} transaction{vendor.transactionCount > 1 ? 's' : ''}
                              {vendor.accountSlug && ` • ${account?.name}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-red-600">-{amount}</div>
                            <div className="text-xs text-muted-foreground">{tokenSymbol}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
