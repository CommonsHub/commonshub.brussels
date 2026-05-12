import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin-check";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";
import {
  readMonthlyTransactions,
  readMonthlyCounterpartyMetadata,
  augmentTransaction,
} from "@/lib/transactions";

interface PageProps {
  params: Promise<{
    year: string;
    month: string;
  }>;
}

export default async function MonthlyTransactionsPage({ params }: PageProps) {
  const { year, month } = await params;

  const transactions = readMonthlyTransactions(year, month);
  if (transactions.length === 0) {
    notFound();
  }

  const userIsAdmin = await isAdmin();
  const counterpartyMetadataMap = readMonthlyCounterpartyMetadata(year, month);

  const augmentedTransactions = transactions
    .map((tx) => augmentTransaction(tx, counterpartyMetadataMap))
    .sort((a, b) => b.timestamp - a.timestamp);

  const monthName = new Date(`${year}-${month}-01`).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

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
