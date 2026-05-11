import { notFound } from "next/navigation";
import * as fs from "fs";
import * as path from "path";
import settings from "@/settings/settings.json";
import { isAdmin } from "@/lib/admin-check";
import type { TokenTransfer } from "@/lib/etherscan";
import type { MoneriumOrder } from "@/lib/monerium-node";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";
import { DATA_DIR } from "@/lib/data-paths";
import { ethereumAddressId } from "@/lib/nip73";
import type {
  CounterpartiesFile,
  CounterpartyMetadata,
} from "@/types/counterparties";

interface PageProps {
  params: Promise<{
    year: string;
    month: string;
    accountSlug: string;
  }>;
}

interface TransactionWithMonerium extends TokenTransfer {
  moneriumOrder?: MoneriumOrder;
}

/**
 * Load transaction data for a specific account and month
 */
async function loadTransactions(
  year: string,
  month: string,
  accountSlug: string
): Promise<TokenTransfer[] | null> {
  // Find account in settings
  const account = settings.finance.accounts.find(
    (a) => a.slug === accountSlug && a.provider === "etherscan"
  );

  if (!account || account.provider !== "etherscan") {
    return null;
  }

  const filePath = path.join(
    DATA_DIR,
    year,
    month,
    account.chain,
    account.token.symbol,
    `${account.address}.json`
  );

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(fileContent);
    return data.transactions || [];
  } catch (error) {
    console.error("Error reading transaction file:", error);
    return null;
  }
}

/**
 * Load Monerium orders for a specific address and month
 */
async function loadMoneriumOrders(
  year: string,
  month: string,
  address: string
): Promise<Map<string, MoneriumOrder>> {
  const filePath = path.join(
    DATA_DIR,
    year,
    month,
    "private",
    "monerium",
    `${address.toLowerCase()}.json`
  );

  const ordersByTxHash = new Map<string, MoneriumOrder>();

  if (!fs.existsSync(filePath)) {
    return ordersByTxHash;
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(fileContent);
    const orders = data.orders || [];

    // Create a map of txHash -> order
    for (const order of orders) {
      if (order.meta?.txHashes) {
        for (const txHash of order.meta.txHashes) {
          ordersByTxHash.set(txHash.toLowerCase(), order);
        }
      }
    }

    return ordersByTxHash;
  } catch (error) {
    console.error("Error reading Monerium file:", error);
    return ordersByTxHash;
  }
}

/**
 * Load transaction metadata from transactions.json
 */
async function loadTransactionMetadata(
  year: string,
  month: string
): Promise<Map<string, any>> {
  const filePath = path.join(DATA_DIR, year, month, "generated", "transactions.json");

  const metadataMap = new Map<string, any>();

  if (!fs.existsSync(filePath)) {
    return metadataMap;
  }

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
    console.error("Error reading transaction metadata:", error);
  }

  return metadataMap;
}

/**
 * Load counterparty metadata from counterparties.json
 */
async function loadCounterpartyMetadata(
  year: string,
  month: string
): Promise<Map<string, CounterpartyMetadata>> {
  const filePath = path.join(DATA_DIR, year, month, "generated", "counterparties.json");

  const metadataMap = new Map<string, CounterpartyMetadata>();

  if (!fs.existsSync(filePath)) {
    return metadataMap;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data: CounterpartiesFile = JSON.parse(content);
    for (const [id, meta] of Object.entries(data.counterparties ?? {})) {
      metadataMap.set(id, meta);
    }
  } catch (error) {
    console.error("Error reading counterparty metadata:", error);
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
 * Format date to readable string
 */
function formatDate(timestamp: string): string {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Shorten address for display
 */
function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default async function FinancePage({ params }: PageProps) {
  const { year, month, accountSlug } = await params;

  // Find account in settings
  const account = settings.finance.accounts.find(
    (a) => a.slug === accountSlug && a.provider === "etherscan"
  );

  if (!account || account.provider !== "etherscan") {
    notFound();
  }

  // Load transactions
  const transactions = await loadTransactions(year, month, accountSlug);

  if (!transactions) {
    notFound();
  }

  // Check if user is admin
  const userIsAdmin = await isAdmin();

  // Load Monerium data if admin
  let moneriumOrdersByTxHash = new Map<string, MoneriumOrder>();
  if (userIsAdmin) {
    moneriumOrdersByTxHash = await loadMoneriumOrders(year, month, account.address);
  }

  // Load transaction metadata and counterparty metadata
  const transactionMetadataMap = await loadTransactionMetadata(year, month);
  const counterpartyMetadataMap = await loadCounterpartyMetadata(year, month);

  // Augment transactions with Monerium data and metadata
  const augmentedTransactions = transactions.map((tx) => {
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
      transactionMetadata: metadata,
      counterpartyId,
      counterpartyMetadata,
    };
  });

  const monthName = new Date(`${year}-${month}-01`).toLocaleString("en-US", { month: "long", year: "numeric" });

  // Calculate breakdown by counterpart for admins
  interface CounterpartSummary {
    name: string;
    iban?: string;
    totalIncoming: bigint;
    totalOutgoing: bigint;
    transactionCount: number;
  }

  let sortedCounterparts: Array<CounterpartSummary & { x: number; y: number; radius: number }> = [];

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

    // Pre-calculate positions
    // Ensure each counterpart appears only once - on the side with higher volume
    const customers = sorted.filter(c => c.totalIncoming >= c.totalOutgoing && c.totalIncoming > BigInt(0));
    const vendors = sorted.filter(c => c.totalOutgoing > c.totalIncoming);

    // Limit to top 9 + "Other" (max 10 per category)
    const MAX_NODES = 10;
    const displayCustomers: CounterpartSummary[] = customers.slice(0, MAX_NODES - 1);
    const displayVendors: CounterpartSummary[] = vendors.slice(0, MAX_NODES - 1);

    // Add "Other" node if there are more than 9
    if (customers.length > MAX_NODES - 1) {
      const otherCustomers = customers.slice(MAX_NODES - 1);
      const otherTotal = otherCustomers.reduce((sum, c) => sum + c.totalIncoming, BigInt(0));
      const otherCount = otherCustomers.reduce((sum, c) => sum + c.transactionCount, 0);
      displayCustomers.push({
        name: `Other (${otherCustomers.length})`,
        iban: undefined,
        totalIncoming: otherTotal,
        totalOutgoing: BigInt(0),
        transactionCount: otherCount,
      });
    }

    if (vendors.length > MAX_NODES - 1) {
      const otherVendors = vendors.slice(MAX_NODES - 1);
      const otherTotal = otherVendors.reduce((sum, v) => sum + v.totalOutgoing, BigInt(0));
      const otherCount = otherVendors.reduce((sum, v) => sum + v.transactionCount, 0);
      displayVendors.push({
        name: `Other (${otherVendors.length})`,
        iban: undefined,
        totalIncoming: BigInt(0),
        totalOutgoing: otherTotal,
        transactionCount: otherCount,
      });
    }

    const maxAmount = Math.max(
      ...displayCustomers.map(c => Number(c.totalIncoming)),
      ...displayVendors.map(c => Number(c.totalOutgoing))
    );

    // Fixed radius for all bubbles
    const fixedRadius = 50;

    // Use Z-pattern for more than 5 items to fit more without overlapping
    const positionedCustomers = displayCustomers.map((customer, idx) => {
      // Calculate link weight based on amount (1 to 10)
      const linkWeight = Math.max(1, Math.min(10, 1 + Math.sqrt(Number(customer.totalIncoming) / maxAmount) * 9));

      // Z-pattern: alternate between two columns
      // Higher volume (lower idx) goes in inner column (closer to center)
      const useZPattern = displayCustomers.length > 5;
      const xPos = useZPattern && idx % 2 === 1 ? 200 : 350; // Even idx (high volume) at x=350 (inner)
      // Need at least 2*radius (100px) spacing, use 120px for breathing room
      const ySpacing = useZPattern ? 120 : 140;

      // Different y calculation for single column vs Z-pattern
      const yPos = useZPattern
        ? (idx % 2 === 0
            ? 100 + (idx / 2) * ySpacing  // Inner column: regular spacing
            : 100 + Math.floor(idx / 2) * ySpacing + ySpacing / 2)  // Outer column: midpoint between inner nodes
        : 100 + idx * ySpacing;  // Single column: simple linear spacing

      return {
        ...customer,
        x: xPos,
        y: yPos,
        radius: fixedRadius,
        linkWeight
      };
    });

    const positionedVendors = displayVendors.map((vendor, idx) => {
      // Calculate link weight based on amount (1 to 10)
      const linkWeight = Math.max(1, Math.min(10, 1 + Math.sqrt(Number(vendor.totalOutgoing) / maxAmount) * 9));

      // Z-pattern: alternate between two columns
      // Higher volume (lower idx) goes in inner column (closer to center)
      const useZPattern = displayVendors.length > 5;
      const xPos = useZPattern && idx % 2 === 1 ? 1000 : 850; // Even idx (high volume) at x=850 (inner)
      // Need at least 2*radius (100px) spacing, use 120px for breathing room
      const ySpacing = useZPattern ? 120 : 140;

      // Different y calculation for single column vs Z-pattern
      const yPos = useZPattern
        ? (idx % 2 === 0
            ? 100 + (idx / 2) * ySpacing  // Inner column: regular spacing
            : 100 + Math.floor(idx / 2) * ySpacing + ySpacing / 2)  // Outer column: midpoint between inner nodes
        : 100 + idx * ySpacing;  // Single column: simple linear spacing

      return {
        ...vendor,
        x: xPos,
        y: yPos,
        radius: fixedRadius,
        linkWeight
      };
    });

    sortedCounterparts = [...positionedCustomers, ...positionedVendors];

    console.log('=== Finance Page Visualization Data ===');
    console.log('Total counterparts:', sortedCounterparts.length);
    console.log('Customers:', positionedCustomers.length);
    console.log('Vendors:', positionedVendors.length);
  }

  // Separate customers and vendors for display
  const customers = userIsAdmin ? sortedCounterparts.filter(c => c.totalIncoming > BigInt(0)) : [];
  const vendors = userIsAdmin ? sortedCounterparts.filter(c => c.totalOutgoing > BigInt(0)) : [];
  const showD3Viz = customers.length >= 3 && vendors.length >= 3;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {account.name}
        </h1>
        <p className="text-muted-foreground">
          {monthName} - {transactions.length} transactions
        </p>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline">{account.chain}</Badge>
          <Badge variant="outline">{account.token.symbol}</Badge>
          <Badge variant="outline">{shortenAddress(account.address)}</Badge>
        </div>
      </div>

      {userIsAdmin && showD3Viz && (
        <Card className="mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle>Transaction Network</CardTitle>
            <CardDescription>
              Visual breakdown of customers and vendors
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
                  const isCustomer = cp.totalIncoming > BigInt(0);
                  const decimals = parseInt(account.token.decimals.toString());
                  const amount = isCustomer
                    ? formatAmount(cp.totalIncoming.toString(), decimals, account.token.symbol, false)
                    : formatAmount(cp.totalOutgoing.toString(), decimals, account.token.symbol, false);
                  const amountWithDecimals = isCustomer
                    ? formatAmount(cp.totalIncoming.toString(), decimals, account.token.symbol, true)
                    : formatAmount(cp.totalOutgoing.toString(), decimals, account.token.symbol, true);

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
                        strokeWidth={cp.linkWeight}
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

      {userIsAdmin && !showD3Viz && (customers.length > 0 || vendors.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Top Counterparts</CardTitle>
            <CardDescription>
              Customers and vendors breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {customers.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-green-600">Customers (Incoming)</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {customers.slice(0, 10).map((customer, idx) => {
                      const decimals = parseInt(account.token.decimals.toString());
                      const amount = formatAmount(customer.totalIncoming.toString(), decimals, account.token.symbol, false);
                      return (
                        <div
                          key={idx}
                          className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg hover:shadow-md transition-shadow"
                        >
                          <div className="font-medium text-sm truncate" title={customer.name}>
                            {customer.name}
                          </div>
                          <div className="font-semibold text-green-600 mt-1">+{amount}</div>
                          <div className="text-xs text-muted-foreground">
                            {customer.transactionCount} tx
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
                  <div className="grid grid-cols-2 gap-2">
                    {vendors.slice(0, 10).map((vendor, idx) => {
                      const decimals = parseInt(account.token.decimals.toString());
                      const amount = formatAmount(vendor.totalOutgoing.toString(), decimals, account.token.symbol, false);
                      return (
                        <div
                          key={idx}
                          className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg hover:shadow-md transition-shadow"
                        >
                          <div className="font-medium text-sm truncate" title={vendor.name}>
                            {vendor.name}
                          </div>
                          <div className="font-semibold text-red-600 mt-1">-{amount}</div>
                          <div className="text-xs text-muted-foreground">
                            {vendor.transactionCount} tx
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Transactions</CardTitle>
          <CardDescription>Detailed transaction history</CardDescription>
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
