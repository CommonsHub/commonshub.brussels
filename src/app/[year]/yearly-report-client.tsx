"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ReportNotAvailable } from "@/components/report-not-available";
import { ActiveMembersInfo } from "@/components/active-members-info";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DiscordImageGallery } from "@/components/discord-image-gallery";
import { ReportFinancialCharts } from "@/components/report-financial-charts";
import { Users, TrendingUp, TrendingDown, Loader2, ChevronDown } from "lucide-react";
import Image from "@/components/optimized-image";
import Link from "next/link";

interface YearlyReportData {
  year: string;
  activeMembers: {
    count: number;
    users: Array<{
      id: string;
      username: string;
      displayName: string | null;
      avatar: string | null;
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
    channelId: string;
    messageId: string;
  }>;
  financials: {
    totalIncome: number;
    totalExpenses: number;
    net: number;
    totalTokensMinted: number;
    totalTokensBurnt: number;
    monthlyBreakdown: Array<{
      month: string;
      income: number;
      expenses: number;
      activeMembers: number;
      tokensMinted?: number;
      tokensBurnt?: number;
    }>;
  };
  months: string[];
}

interface MonthlyReportData {
  year: string;
  month: string;
  activeMembers: { count: number };
  photos: any[];
  financials: {
    income: number;
    expenses: number;
    net: number;
    tokens: {
      minted: number;
      burnt: number;
      net: number;
      transactionCount: number;
      activeAccounts: number;
    };
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

function getAvatarUrl(avatar: string | null, userId: string): string {
  if (!avatar) return `https://cdn.discordapp.com/embed/avatars/0.png`;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
}

export function YearlyReportClient() {
  const params = useParams();
  const year = params?.year as string;

  const [data, setData] = useState<YearlyReportData | null>(null);
  const [monthlyData, setMonthlyData] = useState<Map<string, MonthlyReportData>>(new Map());
  const [loadingMonthly, setLoadingMonthly] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate params
    if (!/^\d{4}$/.test(year)) {
      setError("Invalid year format");
      setLoading(false);
      return;
    }

    fetch(`/api/reports/${year}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch report");
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [year]);

  const loadMonthlyData = async (month: string) => {
    if (monthlyData.has(month) || loadingMonthly.has(month)) return;

    setLoadingMonthly((prev) => new Set(prev).add(month));

    try {
      const res = await fetch(`/api/reports/${year}/${month}`);
      if (!res.ok) throw new Error("Failed to fetch monthly report");
      const data = await res.json();
      setMonthlyData((prev) => new Map(prev).set(month, data));
    } catch (err) {
      console.error(`Error loading monthly data for ${month}:`, err);
    } finally {
      setLoadingMonthly((prev) => {
        const next = new Set(prev);
        next.delete(month);
        return next;
      });
    }
  };

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
      <ReportNotAvailable
        message={`We don't have a report for ${year} yet. Browse the available reports below.`}
        backHref="/reports"
        backLabel="See all reports"
      />
    );
  }

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

  // Sort months in reverse order (Dec to Jan)
  const sortedMonths = [...data.months].reverse();

  return (
    <div className="container mx-auto py-12 px-4 space-y-12">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">{year} Annual Report</h1>
        <p className="text-muted-foreground">
          Year in review: community activity and financial overview
        </p>
      </div>

      {/* Overview Cards */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Active Members */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Members
                <ActiveMembersInfo />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{data.activeMembers.count}</p>
              <p className="text-sm text-muted-foreground mt-1">throughout the year</p>
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
                <span className="font-medium text-green-600">{formatCurrency(data.financials.totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expenses:</span>
                <span className="font-medium text-red-600">{formatCurrency(data.financials.totalExpenses)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tokens */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tokens (CHT)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className={`text-3xl font-bold whitespace-nowrap ${((data.financials.totalTokensMinted || 0) - (data.financials.totalTokensBurnt || 0)) >= 0 ? "text-green-600" : "text-red-600"}`}>
                {((data.financials.totalTokensMinted || 0) - (data.financials.totalTokensBurnt || 0)) >= 0 ? "+" : ""}
                {Math.round((data.financials.totalTokensMinted || 0) - (data.financials.totalTokensBurnt || 0))}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Minted:</span>
                <span className="font-medium text-blue-600">{Math.round(data.financials.totalTokensMinted || 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Burnt:</span>
                <span className="font-medium text-orange-600">{Math.round(data.financials.totalTokensBurnt || 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Top Photos */}
      {data.photos.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Top Photos of {year}</h2>
              <p className="text-muted-foreground">
                Most popular photos ranked by Discord reactions
              </p>
            </div>
            <Link
              href={`/${year}/photos`}
              className="text-sm font-medium text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <DiscordImageGallery
            images={data.photos.slice(0, 24).map((photo) => ({
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
            thumbnailSize="md"
            userMap={userMap}
            channelMap={{}}
            guildId={GUILD_ID}
          />
        </section>
      )}

      {/* Monthly Trends Charts */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Monthly Trends</h2>
          <p className="text-muted-foreground">
            Evolution of income, expenses, and active members throughout the year
          </p>
        </div>
        <ReportFinancialCharts monthlyBreakdown={data.financials.monthlyBreakdown} />
      </section>

      {/* Monthly Reports Accordion */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Monthly Reports</h2>
          <p className="text-muted-foreground">Detailed breakdown by month (December to January)</p>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {sortedMonths.map((month) => {
            const monthIndex = parseInt(month, 10) - 1;
            const monthName = MONTH_NAMES[monthIndex];
            const breakdown = data.financials.monthlyBreakdown.find((m) => m.month === month);
            const monthData = monthlyData.get(month);
            const isLoading = loadingMonthly.has(month);

            return (
              <AccordionItem
                key={month}
                value={month}
                className="border rounded-lg px-4 bg-card"
              >
                <AccordionTrigger
                  className="hover:no-underline"
                  onClick={() => loadMonthlyData(month)}
                >
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="text-left">
                      <p className="font-semibold">{monthName}</p>
                      {breakdown && (
                        <p className="text-sm text-muted-foreground">
                          {breakdown.activeMembers} active members
                        </p>
                      )}
                    </div>
                    {breakdown && (
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-muted-foreground">Euros</span>
                          <span
                            className={
                              breakdown.income - breakdown.expenses >= 0
                                ? "text-green-600 font-medium whitespace-nowrap"
                                : "text-red-600 font-medium whitespace-nowrap"
                            }
                          >
                            {breakdown.income - breakdown.expenses >= 0 ? "+" : ""}
                            {formatCurrency(breakdown.income - breakdown.expenses)}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-muted-foreground">CHT</span>
                          <span
                            className={
                              ((breakdown.tokensMinted || 0) - (breakdown.tokensBurnt || 0)) >= 0
                                ? "text-green-600 font-medium whitespace-nowrap"
                                : "text-red-600 font-medium whitespace-nowrap"
                            }
                          >
                            {((breakdown.tokensMinted || 0) - (breakdown.tokensBurnt || 0)) >= 0 ? "+" : ""}
                            {Math.round((breakdown.tokensMinted || 0) - (breakdown.tokensBurnt || 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : monthData ? (
                    <>
                      {/* Month stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Active Members</p>
                          <p className="text-2xl font-bold">{monthData.activeMembers.count}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Photos</p>
                          <p className="text-2xl font-bold">{monthData.photos.length}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Euros</p>
                          <p className={`text-2xl font-bold whitespace-nowrap ${monthData.financials.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {monthData.financials.net >= 0 ? "+" : ""}
                            {formatCurrency(monthData.financials.net)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">CHT</p>
                          <p className={`text-2xl font-bold whitespace-nowrap ${(monthData.financials.tokens?.net || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {(monthData.financials.tokens?.net || 0) >= 0 ? "+" : ""}
                            {Math.round(monthData.financials.tokens?.net || 0)}
                          </p>
                        </div>
                      </div>

                      <Link
                        href={`/${year}/${month}`}
                        className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                      >
                        View full monthly report →
                      </Link>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Click to load monthly details
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>
    </div>
  );
}
