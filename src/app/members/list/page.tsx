"use client";

import { useEffect, useState, useMemo, type ReactElement } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, TrendingUp, Calendar, CreditCard, ArrowLeft, Building2, ExternalLink } from "lucide-react";
import type { MembersFile, Member, Amount } from "@/types/members";

function formatAmount(amount: Amount | number): string {
  const value = typeof amount === "number" ? amount : amount.value;
  const currency = typeof amount === "number" ? "EUR" : amount.currency;
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-EU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function cleanName(name: string): string {
  if (name.includes("@")) return name.split("@")[0].trim();
  return name;
}

function getStatusColor(status: Member["status"]): string {
  switch (status) {
    case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "trialing": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "past_due": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "canceled": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    case "incomplete": case "unpaid": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "paused": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getPlanBadge(member: Member): ReactElement {
  const isOrg = member.isOrganization;
  if (member.plan === "yearly") {
    return (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700">
        {isOrg ? "Yearly (org)" : "Yearly"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700">
      Monthly
    </Badge>
  );
}

function getSourceBadge(source?: string): ReactElement | null {
  if (!source || source === "stripe") return null;
  return (
    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700">
      {source}
    </Badge>
  );
}

function ExternalLinkIcon({ href, title }: { href: string; title: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground inline-flex" title={title}>
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function getMonthOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

export default function MemberListPage() {
  const [data, setData] = useState<MembersFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const monthOptions = getMonthOptions();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const [year, month] = selectedMonth.split("-");
    fetch(`/api/members?year=${year}&month=${month}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("No membership data available for this month yet.");
          throw new Error("Failed to fetch membership data");
        }
        return res.json();
      })
      .then((data: MembersFile) => {
        data.members.sort((a, b) => cleanName(a.firstName).localeCompare(cleanName(b.firstName)));
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedMonth]);

  // Unique plans and statuses for filter options
  const { plans, statuses } = useMemo(() => {
    if (!data) return { plans: [], statuses: [] };
    const plans = [...new Set(data.members.map((m) => m.plan))].sort();
    const statuses = [...new Set(data.members.map((m) => m.status))].sort();
    return { plans, statuses };
  }, [data]);

  const filteredMembers = useMemo(() => {
    if (!data) return [];
    return data.members.filter((m) => {
      if (filterPlan !== "all" && m.plan !== filterPlan) return false;
      if (filterStatus !== "all" && m.status !== filterStatus) return false;
      return true;
    });
  }, [data, filterPlan, filterStatus]);

  return (
    <div className="min-h-screen bg-background pt-24">
      <main className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href="/members" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Community
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Active Commoners</h1>
              <p className="text-muted-foreground mt-1">
                Supporting members who contribute financially to the Commons Hub
              </p>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Join CTA */}
        <Card className="mb-8 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardHeader>
            <CardTitle>Become a Member</CardTitle>
            <CardDescription>Support the Commons Hub Brussels and get access to member benefits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <a href="https://buy.stripe.com/00g9C7dFH8EI07eaEJ" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                Monthly — €10/month
              </a>
              <a href="https://buy.stripe.com/5kA4hNbxz4os2fm3cl" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-primary bg-background px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-primary/10">
                Yearly — €100/year (save €20)
              </a>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardHeader>
              <CardTitle className="text-yellow-800 dark:text-yellow-200">No Data Available</CardTitle>
              <CardDescription className="text-yellow-700 dark:text-yellow-300">{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : data ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" />Active Members</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.summary.activeMembers}</p>
                  <p className="text-sm text-muted-foreground">of {data.summary.totalMembers} total</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Monthly Revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">{formatAmount(data.summary.mrr)}</p>
                  <p className="text-sm text-muted-foreground">MRR</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><Calendar className="h-4 w-4" />Monthly Plans</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.summary.monthlyMembers}</p>
                  <p className="text-sm text-muted-foreground">€10/month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Yearly Plans</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.summary.yearlyMembers}</p>
                  <p className="text-sm text-muted-foreground">€100/year</p>
                </CardContent>
              </Card>
            </div>

            {/* Members Table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Members</CardTitle>
                    <CardDescription>
                      {filteredMembers.length}{filteredMembers.length !== data.members.length ? ` of ${data.members.length}` : ""} members
                      {" in "}{monthOptions.find(o => o.value === selectedMonth)?.label}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterPlan} onValueChange={setFilterPlan}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All plans</SelectItem>
                        {plans.map((p) => (
                          <SelectItem key={p} value={p}>{p === "monthly" ? "Monthly" : "Yearly"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Latest Payment</TableHead>
                        <TableHead className="hidden md:table-cell">Member Since</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium flex items-center gap-1.5">
                                {member.isOrganization && <Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
                                {cleanName(member.firstName)}
                              </span>
                              {member.accounts.discord && (
                                <span className="text-xs text-muted-foreground">@{member.accounts.discord}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                {getPlanBadge(member)}
                                {getSourceBadge(member.source)}
                              </div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                {formatAmount(member.amount)}/{member.interval}
                                {member.subscriptionUrl && (
                                  <ExternalLinkIcon
                                    href={member.subscriptionUrl}
                                    title={`View subscription on ${member.source === "odoo" ? "Odoo" : "Stripe"}`}
                                  />
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(member.status)} variant="secondary">
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {member.latestPayment ? (
                              <div className="flex flex-col">
                                <span className="text-sm">
                                  {formatAmount(member.latestPayment.amount)}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  {formatDate(member.latestPayment.date)}
                                  {member.latestPayment.url && (
                                    <ExternalLinkIcon href={member.latestPayment.url} title="View invoice" />
                                  )}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {formatDate(member.createdAt)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredMembers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No members match the current filters
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center mt-8">
              Data generated: {new Date(data.generatedAt).toLocaleString()}
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
