"use client";

/**
 * "My membership" — the signed-in member's own month-by-month history.
 *
 * Everything shown here comes from /api/members/me, which derives the
 * membership id from the session rather than accepting one. This page never
 * sees or sends an id.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowLeft, CalendarDays, Info, ExternalLink } from "lucide-react";
import type { Amount, MemberHistory, MemberHistoryMonth } from "@/types/members";

function formatAmount(amount: Amount): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: amount.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount.value);
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString("en-EU", {
    month: "long",
    year: "numeric",
  });
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active" || status === "trialing") return "default";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "destructive";
  return "secondary";
}

/**
 * Months between the first and last a member appears in, that they do not
 * appear in. chb writes one entry per month someone was a member, so a hole is
 * a genuine lapse rather than data we are missing.
 */
function gapsWithin(months: MemberHistoryMonth[]): string[] {
  if (months.length < 2) return [];
  const present = new Set(months.map((m) => m.month));
  const gaps: string[] = [];
  const [firstYear, firstMonth] = months[0].month.split("-").map(Number);
  const [lastYear, lastMonth] = months[months.length - 1].month.split("-").map(Number);

  const cursor = new Date(firstYear, firstMonth - 1, 1);
  const end = new Date(lastYear, lastMonth - 1, 1);
  while (cursor < end) {
    cursor.setMonth(cursor.getMonth() + 1);
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    if (!present.has(key) && cursor < end) gaps.push(key);
  }
  return gaps;
}

export default function MyMembershipPage() {
  const { status: sessionStatus } = useSession();
  const [history, setHistory] = useState<MemberHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (sessionStatus !== "authenticated") {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch("/api/members/me")
      .then(async (res) => {
        if (res.ok) return res.json();
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not load your membership.");
      })
      .then((data: MemberHistory) => {
        setHistory(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionStatus]);

  const gaps = history ? gapsWithin(history.months) : [];
  const hasDerived = history?.months.some((m) => m.derived) ?? false;

  return (
    <div className="min-h-screen bg-background pt-24">
      <main className="container mx-auto py-8 px-4 max-w-3xl">
        <Link
          href="/community"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Community
        </Link>

        <h1 className="text-3xl font-bold mb-1">My membership</h1>
        <p className="text-muted-foreground mb-8">
          Your month-by-month membership of the Commons Hub.
        </p>

        {sessionStatus === "unauthenticated" && (
          <Card>
            <CardHeader>
              <CardTitle>Sign in to see your membership</CardTitle>
              <CardDescription>
                We match you to your membership through the email address on your Discord
                account. Nothing is shown until you sign in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => signIn("discord")}>Sign in with Discord</Button>
            </CardContent>
          </Card>
        )}

        {loading && sessionStatus === "authenticated" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your membership…
          </div>
        )}

        {!loading && error && sessionStatus === "authenticated" && (
          <Card>
            <CardHeader>
              <CardTitle>No membership found</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                If you are a member, the address on your Discord account may differ from the
                one you subscribed with.
              </p>
              <Link href="/membership" className="inline-flex items-center gap-1 underline">
                About membership <ExternalLink className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>
        )}

        {!loading && history && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  {history.firstName ? `${history.firstName}, ` : ""}
                  {history.monthsActive} month{history.monthsActive === 1 ? "" : "s"} of membership
                </CardTitle>
                <CardDescription>
                  {history.firstMonth === history.lastMonth
                    ? formatMonth(history.firstMonth!)
                    : `${formatMonth(history.firstMonth!)} — ${formatMonth(history.lastMonth!)}`}
                  {history.createdAt && ` · joined ${new Date(history.createdAt).toLocaleDateString("en-EU", { day: "numeric", month: "short", year: "numeric" })}`}
                </CardDescription>
              </CardHeader>
              {gaps.length > 0 && (
                <CardContent className="text-sm text-muted-foreground">
                  Not a member during {gaps.map(formatMonth).join(", ")}.
                </CardContent>
              )}
            </Card>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.months.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">
                      {formatMonth(m.month)}
                      {m.derived && (
                        <span
                          title="Reconstructed from a later snapshot rather than recorded at the time"
                          className="ml-1 text-muted-foreground"
                        >
                          *
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.plan ?? "—"}
                      {m.source ? ` · ${m.source}` : ""}
                    </TableCell>
                    <TableCell className="text-right">{formatAmount(m.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {hasDerived && (
              <p className="mt-4 text-xs text-muted-foreground flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  * Reconstructed from a later snapshot rather than recorded at the time. Our
                  bookkeeping system reports current state, not history, so these months can
                  miss a membership that had already ended.
                </span>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
