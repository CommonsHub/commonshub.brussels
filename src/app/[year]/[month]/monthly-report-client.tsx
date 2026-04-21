"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DiscordImageGallery } from "@/components/discord-image-gallery";
import { MemberCard } from "@/components/member-card";
import { Users, Loader2 } from "lucide-react";

interface MonthlyReportData {
  year: string;
  month: string;
  activeMembers: {
    count: number;
    users: Array<{
      id: string;
      username: string;
      displayName: string | null;
      avatar: string | null;
      address?: string | null;
      tokensReceived?: number;
      tokensSpent?: number;
    }>;
  };
  photos: Array<{
    url: string;
    author: {
      id: string;
      username: string;
      displayName: string | null;
      avatar: string | null;
    };
    reactions: Array<{ emoji: string; count: number; me?: boolean }>;
    totalReactions: number;
    message: string;
    timestamp: string;
    channelId?: string;
    messageId?: string;
  }>;
  financials: {
    income: number;
    expenses: number;
    net: number;
    byAccount: Array<{
      slug: string;
      name: string;
      provider: string;
      income: number;
      expenses: number;
      net: number;
    }>;
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const GUILD_ID = "1280532848604086365";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MonthlyReportClient() {
  const params = useParams();
  const router = useRouter();
  const year = params?.year as string;
  const month = params?.month as string;

  const [data, setData] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate params
    if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) {
      setError("Invalid year or month format");
      setLoading(false);
      return;
    }

    // Fetch images and report data in parallel
    Promise.all([
      fetch(`/data/${year}/${month}/generated/images.json`),
      fetch(`/api/reports/${year}/${month}`)
    ])
      .then(async ([imagesRes, reportRes]) => {
        if (!imagesRes.ok || !reportRes.ok) {
          throw new Error("Failed to fetch data");
        }
        const imagesData = await imagesRes.json();
        const reportData = await reportRes.json();

        // Merge the data - use images from static file
        const mergedData = {
          ...reportData,
          photos: imagesData.images
        };
        setData(mergedData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [year, month]);

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Report</CardTitle>
            <CardDescription>{error || "Unable to load monthly report"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const monthName = MONTH_NAMES[parseInt(month, 10) - 1];
  const isProfit = data.financials.net >= 0;

  // Build userMap for mention resolution
  const userMap = Object.fromEntries(
    data.activeMembers.users.map((user) => [
      user.id,
      {
        username: user.username,
        displayName: user.displayName || user.username,
      },
    ])
  );

  return (
    <div className="container mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">{monthName} {year}</h1>
        <p className="text-muted-foreground">Monthly Report</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Members */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.activeMembers.count}</p>
          </CardContent>
        </Card>

        {/* Euros */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Euros</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className={`text-3xl font-bold whitespace-nowrap ${isProfit ? "text-green-600" : "text-red-600"}`}>
              {isProfit ? "+" : ""}{formatCurrency(data.financials.net)}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Income:</span>
              <span className="font-medium text-green-600">{formatCurrency(data.financials.income)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Expenses:</span>
              <span className="font-medium text-red-600">{formatCurrency(data.financials.expenses)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Tokens */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tokens (CHT)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className={`text-3xl font-bold whitespace-nowrap ${(data.financials.tokens?.net || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {(data.financials.tokens?.net || 0) >= 0 ? "+" : ""}
              {Math.round(data.financials.tokens?.net || 0)}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Minted:</span>
              <span className="font-medium text-blue-600">{Math.round(data.financials.tokens?.minted || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Burnt:</span>
              <span className="font-medium text-orange-600">{Math.round(data.financials.tokens?.burnt || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Transactions:</span>
              <span className="font-medium">{data.financials.tokens?.transactionCount || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Popular Photos */}
      {data.photos.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Popular Photos</h2>
              <p className="text-muted-foreground">Ranked by Discord emoji reactions</p>
            </div>
            <Link
              href={`/${year}/${month}/photos`}
              className="text-sm font-medium text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <DiscordImageGallery
            images={data.photos.slice(0, 12).map((photo) => ({
              imageUrl: photo.url,
              author: {
                id: photo.author.id,
                displayName: photo.author.displayName || photo.author.username,
                avatar: photo.author.avatar
                  ? `https://cdn.discordapp.com/avatars/${photo.author.id}/${photo.author.avatar}.png`
                  : null,
              },
              message: photo.message,
              timestamp: photo.timestamp,
              messageId: photo.messageId,
              channelId: photo.channelId,
              reactions: photo.reactions,
            }))}
            showMessage={true}
            thumbnailSize="lg"
            userMap={userMap}
            channelMap={{}}
            guildId={GUILD_ID}
          />
        </section>
      )}

      {/* Active Members Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Active Members</h2>
          <p className="text-muted-foreground">
            Message authors and mentioned users ({data.activeMembers.count} total)
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.activeMembers.users.map((user) => (
            <MemberCard
              key={user.id}
              member={{
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                tokensReceived: user.tokensReceived,
                tokensSpent: user.tokensSpent,
                address: user.address,
              }}
              size="md"
              showTokens={true}
            />
          ))}
        </div>
      </section>

      {/* Financial Breakdown */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Financial Breakdown</h2>
          <p className="text-muted-foreground">Income and expenses by account</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.financials.byAccount.map((account) => (
                  <TableRow key={account.slug}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(account.income)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(account.expenses)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`whitespace-nowrap ${account.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {account.net >= 0 ? "+" : ""}{formatCurrency(account.net)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(data.financials.income)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(data.financials.expenses)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`whitespace-nowrap ${isProfit ? "text-green-600" : "text-red-600"}`}>
                      {isProfit ? "+" : ""}{formatCurrency(data.financials.net)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
