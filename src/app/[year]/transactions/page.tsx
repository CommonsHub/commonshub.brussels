import { notFound } from "next/navigation";
import * as fs from "fs";
import * as path from "path";
import { isAdmin } from "@/lib/admin-check";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";
import { DATA_DIR } from "@/lib/data-paths";
import {
  readMonthlyTransactions,
  readMonthlyCounterpartyMetadata,
  augmentTransaction,
} from "@/lib/transactions";
import type { CounterpartyMetadata } from "@/types/counterparties";
import type { Transaction } from "@/types/transactions";

interface PageProps {
  params: Promise<{
    year: string;
  }>;
}

function listMonths(year: string): string[] {
  const yearPath = path.join(DATA_DIR, year);
  if (!fs.existsSync(yearPath)) return [];
  return fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{2}$/.test(d.name))
    .map((d) => d.name)
    .sort();
}

export default async function YearlyTransactionsPage({ params }: PageProps) {
  const { year } = await params;
  const months = listMonths(year);
  if (months.length === 0) notFound();

  const transactions: Transaction[] = [];
  const counterpartyMetadataMap = new Map<string, CounterpartyMetadata>();
  for (const month of months) {
    transactions.push(...readMonthlyTransactions(year, month));
    const meta = readMonthlyCounterpartyMetadata(year, month);
    for (const [id, m] of meta) counterpartyMetadataMap.set(id, m);
  }

  if (transactions.length === 0) notFound();

  const userIsAdmin = await isAdmin();

  const augmentedTransactions = transactions
    .map((tx) => augmentTransaction(tx, counterpartyMetadataMap))
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          All Transactions {year}
        </h1>
        <p className="text-muted-foreground">
          {augmentedTransactions.length} transactions across all accounts
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Transactions</CardTitle>
          <CardDescription>All transactions for {year}</CardDescription>
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
