import { notFound } from "next/navigation";
import * as fs from "fs";
import * as path from "path";
import { isAdmin } from "@/lib/admin-check";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";
import { DATA_DIR } from "@/lib/data-paths";
import { counterpartyNip73Id, transactionNip73Id } from "@/lib/nip73";
import type {
  CounterpartiesFile,
  CounterpartyMetadata,
} from "@/types/counterparties";

interface PageProps {
  params: Promise<{
    year: string;
    month: string;
  }>;
}

interface TransactionMetadata {
  collective: string;
  project: string | null;
  event: string | null;
  category: string;
  tags: string[];
  description: string;
}

interface Transaction {
  id: string;
  provider: "etherscan" | "stripe";
  chain: string | null;
  account: string;
  accountSlug: string;
  accountName: string;
  currency: string;
  value: string;
  normalizedAmount: number; // in cents
  type: "CREDIT" | "DEBIT";
  counterparty: string;
  timestamp: number;
  txHash?: string;
  stripeChargeId?: string;
  metadata: TransactionMetadata;
}

interface TransactionsFile {
  month: string;
  generatedAt: string;
  transactions: Transaction[];
}

/**
 * Load all transactions from consolidated file for a month
 */
async function loadAllMonthlyTransactions(year: string, month: string): Promise<Transaction[]> {
  const filePath = path.join(DATA_DIR, year, month, "generated", "transactions.json");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data: TransactionsFile = JSON.parse(fileContent);
    return data.transactions;
  } catch (error) {
    console.error(`Error reading transaction file for ${year}-${month}:`, error);
    return [];
  }
}

/**
 * Load counterparty metadata for a month
 */
async function loadMonthlyCounterpartyMetadata(year: string, month: string): Promise<Map<string, CounterpartyMetadata>> {
  const metadataMap = new Map<string, CounterpartyMetadata>();
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

  return metadataMap;
}

export default async function MonthlyTransactionsPage({ params }: PageProps) {
  const { year, month } = await params;

  // Load all transactions for the month
  const transactions = await loadAllMonthlyTransactions(year, month);

  if (transactions.length === 0) {
    notFound();
  }

  // Check if user is admin
  const userIsAdmin = await isAdmin();

  // Load counterparty metadata
  const counterpartyMetadataMap = await loadMonthlyCounterpartyMetadata(year, month);

  // Augment transactions with counterparty metadata
  const augmentedTransactions = transactions.map((tx) => {
    const counterpartyId = counterpartyNip73Id(tx) ?? undefined;
    const transactionUri = transactionNip73Id(tx) ?? undefined;
    const counterpartyMetadata = counterpartyId
      ? counterpartyMetadataMap.get(counterpartyId)
      : undefined;

    return {
      ...tx,
      transactionId: tx.id,
      transactionUri,
      counterpartyId,
      counterpartyMetadata,
      // Add TokenTransfer-like fields for compatibility
      hash: tx.txHash,
      timeStamp: tx.timestamp.toString(),
      from: tx.type === "DEBIT" ? tx.account : tx.counterparty,
      to: tx.type === "CREDIT" ? tx.account : tx.counterparty,
      transactionMetadata: tx.metadata,
    };
  });

  // Sort transactions by timestamp (newest first)
  augmentedTransactions.sort((a, b) => b.timestamp - a.timestamp);

  // Format month name
  const monthName = new Date(`${year}-${month}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          All Transactions {monthName}
        </h1>
        <p className="text-muted-foreground">
          {augmentedTransactions.length} transactions across all accounts
        </p>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Transactions</CardTitle>
          <CardDescription>All transactions for {monthName}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <FinanceTransactionTable
            transactions={augmentedTransactions}
            accountAddress=""
            accountName="All Accounts"
            tokenSymbol="EUR"
            tokenDecimals={2}
            chain="gnosis"
            isAdmin={userIsAdmin}
            showAccountColumn={true}
            showExportButton={true}
            useNormalizedAmount={true}
            viewScope="month"
          />
        </CardContent>
      </Card>
    </div>
  );
}
