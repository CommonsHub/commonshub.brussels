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
 * Load all transactions for all accounts in a year
 */
async function loadAllYearlyTransactions(
  year: string
): Promise<Map<string, TokenTransfer[]>> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const yearPath = path.join(dataDir, year);

  if (!fs.existsSync(yearPath)) {
    return new Map();
  }

  const transactionsByAccount = new Map<string, TokenTransfer[]>();

  const etherscanAccounts = settings.finance.accounts.filter(isEtherscanAccount);

  // Get all month directories
  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const account of etherscanAccounts) {
    const allTransactions: TokenTransfer[] = [];

    for (const month of monthDirs) {
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
            allTransactions.push(...data.transactions);
          }
        } catch (error) {
          console.error(`Error reading transaction file for ${account.slug} ${year}-${month}:`, error);
        }
      }
    }

    if (allTransactions.length > 0) {
      transactionsByAccount.set(account.slug, allTransactions);
    }
  }

  return transactionsByAccount;
}

/**
 * Load all Monerium orders for all accounts in a year
 */
async function loadAllYearlyMoneriumOrders(
  year: string
): Promise<Map<string, Map<string, MoneriumOrder>>> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const yearPath = path.join(dataDir, year);

  if (!fs.existsSync(yearPath)) {
    return new Map();
  }

  const ordersByAccount = new Map<string, Map<string, MoneriumOrder>>();

  const etherscanAccounts = settings.finance.accounts.filter(isEtherscanAccount);

  // Get all month directories
  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const account of etherscanAccounts) {
    const allOrdersByTxHash = new Map<string, MoneriumOrder>();

    for (const month of monthDirs) {
      const filePath = path.join(
        dataDir,
        year,
        month,
        "private",
        "monerium",
        `${account.address.toLowerCase()}.json`
      );

      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const data = JSON.parse(fileContent);
          const orders = data.orders || [];

          for (const order of orders) {
            if (order.meta?.txHashes) {
              for (const txHash of order.meta.txHashes) {
                allOrdersByTxHash.set(txHash.toLowerCase(), order);
              }
            }
          }
        } catch (error) {
          console.error(`Error reading Monerium file for ${account.slug} ${year}-${month}:`, error);
        }
      }
    }

    ordersByAccount.set(account.slug, allOrdersByTxHash);
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

export default async function YearlyFinanceAggregatePage({ params }: PageProps) {
  const { year } = await params;

  // Load all transactions
  const transactionsByAccount = await loadAllYearlyTransactions(year);

  if (transactionsByAccount.size === 0) {
    notFound();
  }

  // Check if user is admin
  const userIsAdmin = await isAdmin();

  // Load Monerium data if admin
  let moneriumOrdersByAccount = new Map<string, Map<string, MoneriumOrder>>();
  if (userIsAdmin) {
    moneriumOrdersByAccount = await loadAllYearlyMoneriumOrders(year);
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

    // Ensure each counterpart appears only once - on the side with higher volume
    customers = sorted.filter(c => c.totalIncoming >= c.totalOutgoing && c.totalIncoming > BigInt(0));
    vendors = sorted.filter(c => c.totalOutgoing > c.totalIncoming);
  }

  const showD3Viz = customers.length >= 3 && vendors.length >= 3;

  // Pre-calculate positions for visualization
  interface PositionedCounterpart extends CounterpartSummary {
    x: number;
    y: number;
    radius: number;
    linkWeight?: number;
  }

  let sortedCounterparts: Array<PositionedCounterpart> = [];

  if (showD3Viz) {
    // Filter out counterparts without valid names
    const validCustomers = customers.filter(c => c.name && c.name.length > 0);
    const validVendors = vendors.filter(c => c.name && c.name.length > 0);

    // Limit to top 9 + "Other" (max 10 per category)
    const MAX_NODES = 10;
    const displayCustomers: CounterpartSummary[] = validCustomers.slice(0, MAX_NODES - 1);
    const displayVendors: CounterpartSummary[] = validVendors.slice(0, MAX_NODES - 1);

    // Add "Other" node if there are more than 9
    if (validCustomers.length > MAX_NODES - 1) {
      const otherCustomers = validCustomers.slice(MAX_NODES - 1);
      const otherTotal = otherCustomers.reduce((sum, c) => sum + c.totalIncoming, BigInt(0));
      const otherCount = otherCustomers.reduce((sum, c) => sum + c.transactionCount, 0);
      displayCustomers.push({
        name: `Other (${otherCustomers.length})`,
        totalIncoming: otherTotal,
        totalOutgoing: BigInt(0),
        transactionCount: otherCount,
      });
    }

    if (validVendors.length > MAX_NODES - 1) {
      const otherVendors = validVendors.slice(MAX_NODES - 1);
      const otherTotal = otherVendors.reduce((sum, v) => sum + v.totalOutgoing, BigInt(0));
      const otherCount = otherVendors.reduce((sum, v) => sum + v.transactionCount, 0);
      displayVendors.push({
        name: `Other (${otherVendors.length})`,
        totalIncoming: BigInt(0),
        totalOutgoing: otherTotal,
        transactionCount: otherCount,
      });
    }

    const maxAmount = Math.max(
      ...displayCustomers.map(c => Number(c.totalIncoming)),
      ...displayVendors.map(c => Number(c.totalOutgoing))
    );
    const fixedRadius = 50;

    // Position customers (left side)
    const positionedCustomers = displayCustomers.map((customer, idx) => {
      const linkWeight = Math.max(1, Math.min(10, 1 + Math.sqrt(Number(customer.totalIncoming) / maxAmount) * 9));
      const useZPattern = displayCustomers.length > 5;
      const xPos = useZPattern && idx % 2 === 1 ? 200 : 350;
      const ySpacing = useZPattern ? 120 : 140;

      const yPos = useZPattern
        ? (idx % 2 === 0
            ? 100 + (idx / 2) * ySpacing
            : 100 + Math.floor(idx / 2) * ySpacing + ySpacing / 2)
        : 100 + idx * ySpacing;

      return {
        ...customer,
        x: xPos,
        y: yPos,
        radius: fixedRadius,
        linkWeight
      };
    });

    // Position vendors (right side)
    const positionedVendors = displayVendors.map((vendor, idx) => {
      const linkWeight = Math.max(1, Math.min(10, 1 + Math.sqrt(Number(vendor.totalOutgoing) / maxAmount) * 9));
      const useZPattern = displayVendors.length > 5;
      const xPos = useZPattern && idx % 2 === 1 ? 1000 : 850;
      const ySpacing = useZPattern ? 120 : 140;

      const yPos = useZPattern
        ? (idx % 2 === 0
            ? 100 + (idx / 2) * ySpacing
            : 100 + Math.floor(idx / 2) * ySpacing + ySpacing / 2)
        : 100 + idx * ySpacing;

      return {
        ...vendor,
        x: xPos,
        y: yPos,
        radius: fixedRadius,
        linkWeight
      };
    });

    sortedCounterparts = [...positionedCustomers, ...positionedVendors];
  }

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

  // Calculate monthly breakdown for all accounts combined
  const monthlyBreakdown = new Map<string, { incoming: bigint; outgoing: bigint; count: number }>();

  for (const tx of allAugmentedTransactions) {
    const account = settings.finance.accounts.find((a): a is EtherscanFinanceAccount => a.slug === tx.accountSlug && isEtherscanAccount(a));
    if (!account) continue;

    const date = new Date(parseInt(tx.timeStamp) * 1000);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const isIncoming = tx.to.toLowerCase() === account.address.toLowerCase();
    const amount = BigInt(tx.value);

    const existing = monthlyBreakdown.get(monthKey);
    if (existing) {
      if (isIncoming) {
        existing.incoming += amount;
      } else {
        existing.outgoing += amount;
      }
      existing.count++;
    } else {
      monthlyBreakdown.set(monthKey, {
        incoming: isIncoming ? amount : BigInt(0),
        outgoing: isIncoming ? BigInt(0) : amount,
        count: 1,
      });
    }
  }

  const sortedMonths = Array.from(monthlyBreakdown.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          All Accounts - Finance
        </h1>
        <p className="text-muted-foreground">
          {year} - {totalTransactions} transactions across {transactionsByAccount.size} accounts
        </p>
      </div>

      {/* Account summaries */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Accounts Overview</CardTitle>
          <CardDescription>Summary by account for {year}</CardDescription>
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
                  href={`/${year}/finance/${summary.accountSlug}`}
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

      {/* SVG Visualization */}
      {userIsAdmin && showD3Viz && (
        <Card className="mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle>Transaction Network</CardTitle>
            <CardDescription>
              Visual breakdown of customers and vendors for {year}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="w-full h-[600px] relative bg-gradient-to-br from-background to-muted/20 rounded-lg">
              <svg width="100%" height="100%" viewBox="0 0 1200 600">
                <defs>
                  <linearGradient id="customerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="vendorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>

                {/* Bubbles and connections */}
                {sortedCounterparts.map((cp, idx) => {
                  // Skip if name is missing
                  if (!cp.name) return null;

                  const isCustomer = cp.totalIncoming > BigInt(0);
                  // Get token info - prefer account token, fallback to EURe
                  const account = cp.accountSlug
                    ? settings.finance.accounts.find((a): a is EtherscanFinanceAccount => a.slug === cp.accountSlug && isEtherscanAccount(a))
                    : null;
                  const decimals = account ? parseInt(account.token.decimals.toString()) : 18;
                  const tokenSymbol = account?.token.symbol || 'EURe';

                  const amount = isCustomer
                    ? formatAmount(cp.totalIncoming.toString(), decimals, tokenSymbol, false)
                    : formatAmount(cp.totalOutgoing.toString(), decimals, tokenSymbol, false);
                  const amountWithDecimals = isCustomer
                    ? formatAmount(cp.totalIncoming.toString(), decimals, tokenSymbol, true)
                    : formatAmount(cp.totalOutgoing.toString(), decimals, tokenSymbol, true);

                  return (
                    <g key={idx} style={{ cursor: 'pointer' }}>
                      <title>
                        {cp.name}
                        {'\n'}{cp.transactionCount} transaction{cp.transactionCount > 1 ? 's' : ''}
                        {'\n'}{isCustomer ? '+' : '-'}{amountWithDecimals}
                      </title>
                      <line
                        x1={cp.x}
                        y1={cp.y}
                        x2="600"
                        y2="300"
                        stroke={isCustomer ? "#10b981" : "#ef4444"}
                        strokeWidth={cp.linkWeight || 2}
                        opacity="0.5"
                      />
                      <circle
                        cx={cp.x}
                        cy={cp.y}
                        r={cp.radius}
                        fill={isCustomer ? "url(#customerGrad)" : "url(#vendorGrad)"}
                        stroke={isCustomer ? "#10b981" : "#ef4444"}
                        strokeWidth="2"
                        opacity="0.9"
                      />
                      <text
                        x={cp.x}
                        y={cp.y - 5}
                        textAnchor="middle"
                        fill="white"
                        fontSize="12"
                        fontWeight="600"
                        pointerEvents="none"
                      >
                        {cp.name.length > 15 ? cp.name.slice(0, 13) + '...' : cp.name}
                      </text>
                      <text
                        x={cp.x}
                        y={cp.y + 10}
                        textAnchor="middle"
                        fill="white"
                        fontSize="14"
                        fontWeight="700"
                        pointerEvents="none"
                      >
                        {isCustomer ? '+' : '-'}{amount}
                      </text>
                    </g>
                  );
                })}

                {/* Center Hub - rendered last so it appears on top */}
                <circle cx="600" cy="300" r="60" fill="#FF4C02" stroke="#fff" strokeWidth="3" />
                <svg x="560" y="260" width="80" height="80" viewBox="0 0 500 500">
                  <path
                    d="M213.528 91L126.722 141.505L201.691 225.154L92 201.48V302.49L201.691 280.394L126.722 359.308L213.528 409.813L250.223 303.632L286.918 409.813L373.723 359.308L298.755 280.394L408.446 302.49V201.48L298.755 225.154L373.723 141.505L286.918 91L250.223 190.155L213.528 91Z"
                    fill="#FBF4F2"
                  />
                </svg>

                {/* Legend */}
                <text x="50" y="30" fill="#10b981" fontSize="14" fontWeight="600">
                  ← Customers (Incoming)
                </text>
                <text x="1150" y="30" textAnchor="end" fill="#ef4444" fontSize="14" fontWeight="600">
                  Vendors (Outgoing) →
                </text>
              </svg>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Counterpart breakdown */}
      {userIsAdmin && !showD3Viz && (customers.length > 0 || vendors.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Top Counterparts</CardTitle>
            <CardDescription>
              Customers and vendors across all accounts for {year}
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
                      const tokenSymbol = account?.token.symbol || 'EURe';
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
                      const tokenSymbol = account?.token.symbol || 'EURe';
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

      {/* Monthly breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Monthly Breakdown</CardTitle>
          <CardDescription>Combined transaction summary by month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedMonths.map(([monthKey, data]) => {
              const [y, m] = monthKey.split('-');
              const monthName = new Date(`${y}-${m}-01`).toLocaleString('en-US', { month: 'long' });
              // Use EURe decimals as default for aggregate view
              const decimals = 18;
              const tokenSymbol = 'EURe';

              return (
                <a
                  key={monthKey}
                  href={`/${y}/${m}/finance`}
                  className="block p-4 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{monthName} {y}</div>
                      <div className="text-sm text-muted-foreground">{data.count} transactions</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-green-600">
                        +{formatAmount(data.incoming.toString(), decimals, tokenSymbol, false)}
                      </div>
                      <div className="text-sm text-red-600">
                        -{formatAmount(data.outgoing.toString(), decimals, tokenSymbol, false)}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
