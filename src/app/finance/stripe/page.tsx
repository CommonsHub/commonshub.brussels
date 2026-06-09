import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Wallet,
  ChevronLeft,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { getAccountFinancials, type FinanceRecentTransaction } from "@/lib/financials";

// Data is read from local files at request time; never statically cached.
export const dynamic = "force-dynamic";

const formatMonth = (month: string) => {
  const [year, m] = month.split("-");
  const date = new Date(Number.parseInt(year), Number.parseInt(m) - 1);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const getTransactionTypeLabel = (type: string) => {
  const typeLabels: Record<string, string> = {
    charge: "Payment",
    payment: "Payment",
    payout: "Payout",
    refund: "Refund",
    transfer: "Transfer",
    adjustment: "Adjustment",
    application_fee: "App Fee",
    application_fee_refund: "Fee Refund",
    stripe_fee: "Stripe Fee",
    network_cost: "Network Cost",
  };
  return typeLabels[type] || type.replace(/_/g, " ");
};

const getStripeDashboardUrl = (tx: FinanceRecentTransaction) => {
  // Link to the payment/payout in Stripe dashboard based on source ID
  if (tx.source?.startsWith("ch_")) {
    return `https://dashboard.stripe.com/payments/${tx.source}`;
  }
  if (tx.source?.startsWith("po_")) {
    return `https://dashboard.stripe.com/payouts/${tx.source}`;
  }
  if (tx.source?.startsWith("re_")) {
    return `https://dashboard.stripe.com/refunds/${tx.source}`;
  }
  if (tx.source?.startsWith("tr_")) {
    return `https://dashboard.stripe.com/transfers/${tx.source}`;
  }
  // Fallback to balance transaction
  return `https://dashboard.stripe.com/balance/transactions/${tx.hash}`;
};

export default async function StripeAccountPage() {
  const data = getAccountFinancials("stripe");

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>Account not found</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Back link */}
          <Link
            href="/finance"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to all accounts
          </Link>

          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold">{data.name}</h1>
            </div>
            <p className="text-muted-foreground">
              Stripe payment account - tracks all payments, payouts, and fees.
            </p>
            <Link
              href="https://dashboard.stripe.com/balance"
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View on Stripe Dashboard <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Current Balance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(data.balance ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span className="text-lg text-muted-foreground">
                    {data.tokenSymbol}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-green-500" />
                  Total Received
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  +
                  {(data.totalInflow ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span className="text-lg text-muted-foreground">
                    {data.tokenSymbol}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                  Total Paid Out
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  -
                  {(data.totalOutflow ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span className="text-lg text-muted-foreground">
                    {data.tokenSymbol}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Breakdown */}
          {data.monthlyBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Breakdown</CardTitle>
                <CardDescription>
                  Payments received and payouts per month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Paid Out</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.monthlyBreakdown.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell className="font-medium">
                          {formatMonth(month.month)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          +
                          {month.inflow.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          -
                          {month.outflow.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${month.net >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {month.net >= 0 ? "+" : ""}
                          {month.net.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Recent Transactions */}
          {data.recentTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>
                  Last {data.recentTransactions.length} transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Fees</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentTransactions.map((tx) => (
                        <TableRow key={tx.hash}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {new Date(tx.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                tx.direction === "in" ? "default" : "secondary"
                              }
                              className={
                                tx.direction === "in"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }
                            >
                              {getTransactionTypeLabel(tx.type ?? "")}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="max-w-[200px] truncate"
                            title={tx.description}
                          >
                            {tx.description || "-"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {(tx.amount ?? 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}{" "}
                            {data.tokenSymbol}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                            {(tx.fee ?? 0) > 0
                              ? `-${(tx.fee ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              : "-"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium whitespace-nowrap ${tx.direction === "in" ? "text-green-600" : "text-red-600"}`}
                          >
                            {tx.direction === "in" ? "+" : ""}
                            {(tx.net ?? 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}{" "}
                            {data.tokenSymbol}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={getStripeDashboardUrl(tx)}
                              target="_blank"
                              className="text-muted-foreground hover:text-primary"
                              title="View in Stripe Dashboard"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium">Stripe</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium">
                  {data.currency?.toUpperCase() || "EUR"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dashboard</span>
                <Link
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  dashboard.stripe.com <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Last Modified */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {data.lastModified ? (
                    <>
                      Data last updated:{" "}
                      <span className="font-medium">
                        {new Date(data.lastModified).toLocaleString()}
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
