"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import type { AccountData, MonthlyBreakdown } from "@/lib/financials";

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  const date = new Date(Number.parseInt(year), Number.parseInt(m) - 1);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function MonthlyBreakdownTable({
  accounts,
  aggregatedMonthlyBreakdown,
}: {
  accounts: AccountData[];
  aggregatedMonthlyBreakdown: MonthlyBreakdown[];
}) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(6);

  // Get per-account breakdown for a specific month
  const getAccountBreakdownForMonth = (monthKey: string) => {
    return accounts
      .map((account) => {
        const monthData = account.monthlyBreakdown?.find(
          (m) => m.month === monthKey
        );
        if (!monthData || (monthData.inflow === 0 && monthData.outflow === 0)) {
          return null;
        }
        return {
          account,
          monthData: {
            ...monthData,
            inflow: Math.round(monthData.inflow),
            outflow: Math.round(monthData.outflow),
            net: Math.round(monthData.net),
          },
        };
      })
      .filter(
        (
          item
        ): item is { account: AccountData; monthData: MonthlyBreakdown } =>
          item !== null
      )
      .sort((a, b) => {
        // Sort by net amount descending
        return b.monthData.net - a.monthData.net;
      });
  };

  const visibleMonthlyBreakdown = aggregatedMonthlyBreakdown.slice(
    0,
    visibleRows
  );
  const hasMoreRows = aggregatedMonthlyBreakdown.length > visibleRows;

  if (aggregatedMonthlyBreakdown.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Breakdown</CardTitle>
        <CardDescription>
          Total income and expenses across all accounts per month. Click on a
          row to see breakdown by account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right whitespace-nowrap w-[140px]">
                Inflow
              </TableHead>
              <TableHead className="text-right whitespace-nowrap w-[140px]">
                Outflow
              </TableHead>
              <TableHead className="text-right whitespace-nowrap w-[140px]">
                Net
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleMonthlyBreakdown.map((month) => {
              const accountBreakdown =
                expandedMonth === month.month
                  ? getAccountBreakdownForMonth(month.month)
                  : [];
              return (
                <React.Fragment key={month.month}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      setExpandedMonth(
                        expandedMonth === month.month ? null : month.month
                      )
                    }
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{formatMonth(month.month)}</span>
                        {expandedMonth === month.month ? (
                          <span className="text-xs text-muted-foreground">
                            ▼
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            ▶
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-green-600 whitespace-nowrap w-[140px]">
                      +€{month.inflow.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-red-600 whitespace-nowrap w-[140px]">
                      -€{month.outflow.toLocaleString()}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium whitespace-nowrap w-[140px] ${month.net >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {month.net >= 0 ? "+" : ""}€{month.net.toLocaleString()}
                    </TableCell>
                  </TableRow>
                  {expandedMonth === month.month &&
                    accountBreakdown.map(({ account, monthData }) => (
                      <TableRow key={account.slug} className="bg-muted/30">
                        <TableCell className="pl-8 py-2">
                          <Link
                            href={`/finance/${account.slug}`}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {account.name}
                          </Link>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({account.tokenSymbol})
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-green-600 py-2 whitespace-nowrap w-[140px]">
                          +€{monthData.inflow.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-600 py-2 whitespace-nowrap w-[140px]">
                          -€{monthData.outflow.toLocaleString()}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium py-2 whitespace-nowrap w-[140px] ${monthData.net >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {monthData.net >= 0 ? "+" : ""}€
                          {monthData.net.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
        {hasMoreRows && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleRows(aggregatedMonthlyBreakdown.length)}
            >
              Load More ({aggregatedMonthlyBreakdown.length - visibleRows} more)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
