import { redirect } from "next/navigation";
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
} from "lucide-react";
import Link from "next/link";
import { WalletAddress } from "@/components/wallet-address";
import settings from "@/settings/settings.json";
import { getAccountFinancials, type FinanceRecentTransaction } from "@/lib/financials";

// Data is read from local files at request time; never statically cached.
export const dynamic = "force-dynamic";

const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const formatCounterparty = (tx: FinanceRecentTransaction) => {
  const address = tx.type === "in" ? tx.to : tx.from;
  return address ? formatAddress(address) : "Unknown";
};

const formatMonth = (month: string) => {
  const [year, m] = month.split("-");
  const date = new Date(Number.parseInt(year), Number.parseInt(m) - 1);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (slug === "stripe") {
    redirect("/finance/stripe");
  }

  const accountConfig = settings.finance.accounts.find((a) => a.slug === slug);
  const data = getAccountFinancials(slug);

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

  const explorerBaseUrl =
    data.chain === "gnosis" ? "https://gnosisscan.io" : "https://etherscan.io";

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
            <h1 className="text-4xl font-bold">{data.name}</h1>
            <p className="text-muted-foreground">
              {data.provider === "stripe"
                ? "Stripe payment account"
                : `Tracked on the ${data.chain} blockchain for full transparency.`}
            </p>
            {data.address && (
              <Link
                href={`${explorerBaseUrl}/address/${data.address}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on {data.chain === "gnosis" ? "Gnosisscan" : "Etherscan"}{" "}
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
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
                  {data.balance.toLocaleString(undefined, {
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
                  Total Inflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  +
                  {data.totalInflow.toLocaleString(undefined, {
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
                  Total Outflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  -
                  {data.totalOutflow.toLocaleString(undefined, {
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
                <CardDescription>Income and expenses per month</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Inflow</TableHead>
                      <TableHead className="text-right">Outflow</TableHead>
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
                          +{month.inflow.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          -{month.outflow.toLocaleString()}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${month.net >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {month.net >= 0 ? "+" : ""}
                          {month.net.toLocaleString()}
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
                <CardDescription>Last 20 token transfers</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>From/To</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentTransactions.map((tx) => (
                      <TableRow key={tx.hash}>
                        <TableCell className="text-muted-foreground">
                          {new Date(tx.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={tx.type === "in" ? "default" : "secondary"}
                            className={
                              tx.type === "in"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {tx.type === "in" ? "Received" : "Sent"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatCounterparty(tx)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${tx.type === "in" ? "text-green-600" : "text-red-600"}`}
                        >
                          {tx.type === "in" ? "+" : "-"}
                          {(tx.value ?? 0).toLocaleString()} {data.tokenSymbol}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`${explorerBaseUrl}/tx/${tx.hash}`}
                            target="_blank"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Wallet Info */}
          {data.address && accountConfig && (
            <Card>
              <CardHeader>
                <CardTitle>Wallet Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chain</span>
                  <span className="font-medium capitalize">{data.chain}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Wallet Address</span>
                  <WalletAddress
                    address={data.address}
                    chain={data.chain || "ethereum"}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token</span>
                  <span className="font-medium">{data.tokenSymbol}</span>
                </div>
                {"token" in accountConfig && accountConfig.token && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Token Contract
                    </span>
                    <WalletAddress
                      address={accountConfig.token.address}
                      chain={data.chain || "ethereum"}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
