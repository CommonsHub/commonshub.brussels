import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { getFinancialsOverview } from "@/lib/financials";
import { MonthlyBreakdownTable } from "./monthly-breakdown-table";
import { AccountCards } from "./account-cards";

// Data is read from local files at request time; never statically cached.
export const dynamic = "force-dynamic";

export default async function FinanceOverviewPage() {
  const {
    accounts,
    archivedAccounts,
    aggregatedMonthlyBreakdown,
    totalInflow,
    totalOutflow,
    lastModified,
  } = getFinancialsOverview();

  // Total balance across all accounts (rounded)
  const totalBalance = Math.round(
    accounts.reduce((sum, acc) => sum + (acc.balance ?? 0), 0)
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Transparent Finances</h1>
            <p className="text-muted-foreground">
              All community funds are managed transparently. Click on any
              account to see full details.
            </p>
          </div>

          {/* Total Summary Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Total Across All Accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-bold">
                €{(totalBalance ?? 0).toLocaleString()}
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <ArrowDownLeft className="w-4 h-4" />
                  <span className="font-medium">
                    +€{Math.round(totalInflow).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="font-medium">
                    -€{Math.round(totalOutflow).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Net:</span>
                  <span
                    className={`font-medium ${totalInflow - totalOutflow >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {totalInflow - totalOutflow >= 0 ? "+" : ""}€
                    {Math.round(totalInflow - totalOutflow).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Inflow and outflow count every transaction across all active
                accounts (including transfers between them), so the net equals
                the change in total balance.
              </p>
            </CardContent>
          </Card>

          {/* Monthly Breakdown (interactive) */}
          <MonthlyBreakdownTable
            accounts={accounts}
            aggregatedMonthlyBreakdown={aggregatedMonthlyBreakdown}
          />

          {/* Account Cards Grid (active by default; archived behind a toggle) */}
          <AccountCards active={accounts} archived={archivedAccounts} />

          {/* Info Section */}
          <Card>
            <CardHeader>
              <CardTitle>About Our Financial Transparency</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                The Commons Hub Brussels believes in full financial
                transparency. All our accounts are visible to anyone, and most
                of our funds are held on the Gnosis blockchain where every
                transaction can be verified.
              </p>
              <p>
                We use <strong>EURe</strong> (Monerium Euro) for our main
                accounts - a regulated Euro stablecoin that can be converted 1:1
                to regular bank transfers. For internal community tokens, we use{" "}
                <strong>EURb</strong> (Brussels Euro) which powers our fridge
                and coffee systems.
              </p>
            </CardContent>
          </Card>

          {/* Last Modified */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {lastModified ? (
                    <>
                      Data last updated:{" "}
                      <span className="font-medium">
                        {new Date(lastModified).toLocaleString()}
                      </span>
                    </>
                  ) : (
                    "No cached data available"
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
