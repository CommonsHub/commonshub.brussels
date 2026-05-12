import { notFound } from "next/navigation";
import * as fs from "fs";
import * as path from "path";
import settings from "@/settings/settings.json";
import { isAdmin, isMember } from "@/lib/admin-check";
import type { TokenTransfer } from "@/lib/etherscan";
import type { MoneriumOrder } from "@/lib/monerium-node";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";
import { WalletAddress } from "@/components/wallet-address";
import { DATA_DIR } from "@/lib/data-paths";
import { ethereumAddressId, ethereumTxId } from "@/lib/nip73";
import type {
  CounterpartiesFile,
  CounterpartyMetadata,
} from "@/types/counterparties";

interface PageProps {
  params: Promise<{
    year: string;
    accountSlug: string;
  }>;
}

interface TransactionWithMonerium extends TokenTransfer {
  moneriumOrder?: MoneriumOrder;
  transactionId: string;
  transactionMetadata?: any;
  counterpartyId?: string;
  counterpartyMetadata?: any;
}

interface CounterpartSummary {
  name: string;
  iban?: string;
  totalIncoming: bigint;
  totalOutgoing: bigint;
  transactionCount: number;
}

/**
 * Load all transactions for a year
 */
async function loadYearlyTransactions(
  year: string,
  accountSlug: string
): Promise<TokenTransfer[]> {
  const account = settings.finance.accounts.find(
    (a) => a.slug === accountSlug && a.provider === "etherscan"
  );

  if (!account || account.provider !== "etherscan") {
    return [];
  }

  const yearPath = path.join(DATA_DIR, year);

  if (!fs.existsSync(yearPath)) {
    return [];
  }

  const allTransactions: TokenTransfer[] = [];

  // Get all month directories
  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const month of monthDirs) {
    const filePath = path.join(
      DATA_DIR,
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
          allTransactions.push(...data.transactions);
        }
      } catch (error) {
        console.error(`Error reading transaction file for ${year}-${month}:`, error);
      }
    }
  }

  return allTransactions;
}

/**
 * Load all Monerium orders for a year
 */
async function loadYearlyMoneriumOrders(
  year: string,
  address: string
): Promise<Map<string, MoneriumOrder>> {
  const yearPath = path.join(DATA_DIR, year);

  const ordersByTxHash = new Map<string, MoneriumOrder>();

  if (!fs.existsSync(yearPath)) {
    return ordersByTxHash;
  }

  // Get all month directories
  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const month of monthDirs) {
    const filePath = path.join(
      DATA_DIR,
      year,
      month,
      "private",
      "monerium",
      `${address.toLowerCase()}.json`
    );

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
        console.error(`Error reading Monerium file for ${year}-${month}:`, error);
      }
    }
  }

  return ordersByTxHash;
}

/**
 * Load transaction metadata from all months
 */
async function loadYearlyTransactionMetadata(year: string): Promise<Map<string, any>> {
  const yearPath = path.join(DATA_DIR, year);
  const metadataMap = new Map<string, any>();

  if (!fs.existsSync(yearPath)) {
    return metadataMap;
  }

  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const month of monthDirs) {
    const filePath = path.join(DATA_DIR, year, month, "generated", "transactions.json");

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);

        for (const tx of data.transactions || []) {
          metadataMap.set(tx.id, {
            ...tx.metadata,
            transactionId: tx.id,
          });
        }
      } catch (error) {
        console.error(`Error reading transaction metadata for ${year}-${month}:`, error);
      }
    }
  }

  return metadataMap;
}

/**
 * Load counterparty metadata from all months
 */
async function loadYearlyCounterpartyMetadata(year: string): Promise<Map<string, CounterpartyMetadata>> {
  const yearPath = path.join(DATA_DIR, year);
  const metadataMap = new Map<string, CounterpartyMetadata>();

  if (!fs.existsSync(yearPath)) {
    return metadataMap;
  }

  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const month of monthDirs) {
    const filePath = path.join(DATA_DIR, year, month, "generated", "counterparties.json");

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data: CounterpartiesFile = JSON.parse(content);
        for (const [id, meta] of Object.entries(data.counterparties ?? {})) {
          metadataMap.set(id, meta);
        }
      } catch (error) {
        console.error(`Error reading counterparty metadata for ${year}-${month}:`, error);
      }
    }
  }

  return metadataMap;
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

/**
 * Shorten address for display
 */
function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default async function YearlyFinancePage({ params }: PageProps) {
  const { year, accountSlug } = await params;

  // Find account in settings
  const account = settings.finance.accounts.find(
    (a) => a.slug === accountSlug && a.provider === "etherscan"
  );

  if (!account || account.provider !== "etherscan") {
    notFound();
  }

  // Load all transactions for the year
  const transactions = await loadYearlyTransactions(year, accountSlug);

  if (transactions.length === 0) {
    notFound();
  }

  // Check if user is admin / has the member role
  const [userIsAdmin, userIsMember] = await Promise.all([isAdmin(), isMember()]);
  const canEdit = userIsAdmin || userIsMember;

  // Load Monerium data if admin
  let moneriumOrdersByTxHash = new Map<string, MoneriumOrder>();
  if (userIsAdmin) {
    moneriumOrdersByTxHash = await loadYearlyMoneriumOrders(year, account.address);
  }

  // Load transaction and counterparty metadata
  const transactionMetadataMap = await loadYearlyTransactionMetadata(year);
  const counterpartyMetadataMap = await loadYearlyCounterpartyMetadata(year);

  // Augment transactions with Monerium data and metadata
  const augmentedTransactions: TransactionWithMonerium[] = transactions.map((tx) => {
    const moneriumOrder = userIsAdmin ? moneriumOrdersByTxHash.get(tx.hash.toLowerCase()) : undefined;
    const transactionId = `${account.chain}:${tx.hash}`;
    const metadata = transactionMetadataMap.get(transactionId);

    // Determine counterparty
    const isIncoming = tx.to.toLowerCase() === account.address.toLowerCase();
    const counterpartyAddress = isIncoming ? tx.from : tx.to;
    const counterpartyId = ethereumAddressId(account.chain, counterpartyAddress) ?? undefined;
    const counterpartyMetadata = counterpartyId
      ? counterpartyMetadataMap.get(counterpartyId)
      : undefined;

    return {
      ...tx,
      moneriumOrder,
      transactionId,
      transactionUri: ethereumTxId(account.chain, tx.hash) ?? undefined,
      transactionMetadata: metadata,
      counterpartyId,
      counterpartyMetadata,
    };
  });

  // Sort transactions by timestamp (newest first)
  augmentedTransactions.sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));

  // Calculate breakdown by counterpart for admins
  let customers: Array<CounterpartSummary> = [];
  let vendors: Array<CounterpartSummary> = [];

  if (userIsAdmin) {
    const counterpartBreakdown = new Map<string, CounterpartSummary>();

    for (const tx of augmentedTransactions) {
      if (!tx.moneriumOrder?.counterpart) continue;

      const counterpartName = tx.moneriumOrder.counterpart.details.name;
      const iban = tx.moneriumOrder.counterpart.identifier.iban;
      const isIncoming = tx.to.toLowerCase() === account.address.toLowerCase();
      const amount = BigInt(tx.value);

      const existing = counterpartBreakdown.get(counterpartName);
      if (existing) {
        if (isIncoming) {
          existing.totalIncoming += amount;
        } else {
          existing.totalOutgoing += amount;
        }
        existing.transactionCount++;
      } else {
        counterpartBreakdown.set(counterpartName, {
          name: counterpartName,
          iban,
          totalIncoming: isIncoming ? amount : BigInt(0),
          totalOutgoing: isIncoming ? BigInt(0) : amount,
          transactionCount: 1,
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

  // Calculate totals
  let totalIncoming = BigInt(0);
  let totalOutgoing = BigInt(0);
  for (const tx of augmentedTransactions) {
    const isIncoming = tx.to.toLowerCase() === account.address.toLowerCase();
    if (isIncoming) {
      totalIncoming += BigInt(tx.value);
    } else {
      totalOutgoing += BigInt(tx.value);
    }
  }

  const decimals = parseInt(account.token.decimals.toString());

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {account.name}
        </h1>
        <p className="text-muted-foreground">
          {year} - {augmentedTransactions.length} transactions
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="outline">{account.chain}</Badge>
          <Badge variant="outline">{account.token.symbol}</Badge>
          <WalletAddress address={account.address} chain={account.chain} />
        </div>
      </div>

      {/* Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Yearly Summary</CardTitle>
          <CardDescription>Financial overview for {year}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Incoming</div>
              <div className="text-2xl font-bold text-green-600">
                +{formatAmount(totalIncoming.toString(), decimals, account.token.symbol, false)}
              </div>
              <div className="text-xs text-muted-foreground">{account.token.symbol}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Outgoing</div>
              <div className="text-2xl font-bold text-red-600">
                -{formatAmount(totalOutgoing.toString(), decimals, account.token.symbol, false)}
              </div>
              <div className="text-xs text-muted-foreground">{account.token.symbol}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Net Change</div>
              <div className={`text-2xl font-bold ${totalIncoming >= totalOutgoing ? 'text-green-600' : 'text-red-600'}`}>
                {totalIncoming >= totalOutgoing ? '+' : ''}{formatAmount((totalIncoming - totalOutgoing).toString(), decimals, account.token.symbol, false)}
              </div>
              <div className="text-xs text-muted-foreground">{account.token.symbol}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Counterpart breakdown - use simple two-column view for yearly data */}
      {userIsAdmin && (customers.length > 0 || vendors.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Top Counterparts</CardTitle>
            <CardDescription>
              Customers and vendors breakdown for {year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {customers.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-green-600">Customers (Incoming)</h3>
                  <div className="space-y-2">
                    {customers.slice(0, 10).map((customer, idx) => {
                      const amount = formatAmount(customer.totalIncoming.toString(), decimals, account.token.symbol, false);
                      return (
                        <div key={idx} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            {customer.iban && (
                              <div className="text-xs text-muted-foreground font-mono">{customer.iban}</div>
                            )}
                            <div className="text-xs text-muted-foreground">{customer.transactionCount} transaction{customer.transactionCount > 1 ? 's' : ''}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-600">+{amount}</div>
                            <div className="text-xs text-muted-foreground">{account.token.symbol}</div>
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
                      const amount = formatAmount(vendor.totalOutgoing.toString(), decimals, account.token.symbol, false);
                      return (
                        <div key={idx} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                          <div>
                            <div className="font-medium">{vendor.name}</div>
                            {vendor.iban && (
                              <div className="text-xs text-muted-foreground font-mono">{vendor.iban}</div>
                            )}
                            <div className="text-xs text-muted-foreground">{vendor.transactionCount} transaction{vendor.transactionCount > 1 ? 's' : ''}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-red-600">-{amount}</div>
                            <div className="text-xs text-muted-foreground">{account.token.symbol}</div>
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

      {/* Monthly breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Monthly Breakdown</CardTitle>
          <CardDescription>Transaction summary by month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(() => {
              // Group transactions by month
              const byMonth = new Map<string, { incoming: bigint; outgoing: bigint; count: number }>();

              for (const tx of augmentedTransactions) {
                const date = new Date(parseInt(tx.timeStamp) * 1000);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                const isIncoming = tx.to.toLowerCase() === account.address.toLowerCase();
                const amount = BigInt(tx.value);

                const existing = byMonth.get(monthKey);
                if (existing) {
                  if (isIncoming) {
                    existing.incoming += amount;
                  } else {
                    existing.outgoing += amount;
                  }
                  existing.count++;
                } else {
                  byMonth.set(monthKey, {
                    incoming: isIncoming ? amount : BigInt(0),
                    outgoing: isIncoming ? BigInt(0) : amount,
                    count: 1,
                  });
                }
              }

              const sortedMonths = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]));

              return sortedMonths.map(([monthKey, data]) => {
                const [y, m] = monthKey.split('-');
                const monthName = new Date(`${y}-${m}-01`).toLocaleString('en-US', { month: 'long' });

                return (
                  <a
                    key={monthKey}
                    href={`/${y}/${m}/finance/${accountSlug}`}
                    className="block p-4 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold">{monthName} {y}</div>
                        <div className="text-sm text-muted-foreground">{data.count} transactions</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-green-600">
                          +{formatAmount(data.incoming.toString(), decimals, account.token.symbol, false)}
                        </div>
                        <div className="text-sm text-red-600">
                          -{formatAmount(data.outgoing.toString(), decimals, account.token.symbol, false)}
                        </div>
                      </div>
                    </div>
                  </a>
                );
              });
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">All Transactions</CardTitle>
          <CardDescription>Detailed transaction history for {year}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <FinanceTransactionTable
            transactions={augmentedTransactions}
            accountAddress={account.address}
            accountName={account.name}
            tokenSymbol={account.token.symbol}
            tokenDecimals={parseInt(account.token.decimals.toString())}
            chain={account.chain}
            isAdmin={userIsAdmin}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
