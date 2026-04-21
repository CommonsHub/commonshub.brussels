"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { X, Lock, ExternalLink } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  OdooRow,
  PartnerAggregate,
  QuarterlyData,
} from "@/lib/odoo-quarter";

interface QuarterlyReportViewProps {
  data: QuarterlyData;
  showPii: boolean;
}

function formatEur(value: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(Math.abs(value) < 0.005 ? 0 : value);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

const CATEGORY_PALETTE = [
  "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200",
];

function categoryColor(category: string): string {
  if (!category || category === "—") {
    return "bg-muted text-muted-foreground";
  }
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % CATEGORY_PALETTE.length;
  return CATEGORY_PALETTE[idx];
}

function statusColor(status: string): string {
  const s = status?.toLowerCase() || "";
  if (s === "paid" || s === "in_payment") {
    return "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200";
  }
  if (s === "not_paid") {
    return "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";
  }
  return "";
}

const ALL_VALUE = "__all__";

const MAX_BAR_HEIGHT_PX = 320;

function CategoryBreakdownBar({
  title,
  items,
  total,
  maxTotal,
  selected,
  onSelect,
  emptyLabel,
}: {
  title: string;
  items: Array<{ category: string; total: number; count: number }>;
  total: number;
  maxTotal: number;
  selected: string;
  onSelect: (value: string) => void;
  emptyLabel: string;
}) {
  const barHeight = maxTotal > 0 ? (total / maxTotal) * MAX_BAR_HEIGHT_PX : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          {items.length === 0 ? emptyLabel : `${formatEur(total)} total`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? null : (
          <div className="flex items-stretch gap-4">
            {/* Bar */}
            <div
              className="relative w-12 flex-shrink-0 flex flex-col justify-end rounded-md overflow-hidden border border-border bg-muted/30"
              style={{ height: `${MAX_BAR_HEIGHT_PX}px` }}
              aria-hidden
            >
              <div
                className="flex flex-col"
                style={{ height: `${barHeight}px` }}
              >
                {items.map((item) => {
                  const segmentHeight = total > 0 ? (item.total / total) * barHeight : 0;
                  const isSelected = selected === item.category;
                  return (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() => onSelect(isSelected ? ALL_VALUE : item.category)}
                      className={`${categoryColor(item.category)} transition-opacity cursor-pointer border-b border-background/30 last:border-b-0 ${
                        isSelected ? "ring-2 ring-primary ring-inset" : "hover:opacity-80"
                      }`}
                      style={{ height: `${segmentHeight}px` }}
                      title={`${item.category}: ${formatEur(item.total)} (${Math.round((item.total / total) * 100)}%)`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <ul className="flex-1 min-w-0 space-y-1 text-sm self-end">
              {items.map((item) => {
                const pct = total > 0 ? (item.total / total) * 100 : 0;
                const isSelected = selected === item.category;
                return (
                  <li key={item.category}>
                    <button
                      type="button"
                      onClick={() => onSelect(isSelected ? ALL_VALUE : item.category)}
                      className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors cursor-pointer hover:bg-accent/50 ${
                        isSelected ? "bg-accent" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0 ${categoryColor(item.category)}`}
                          aria-hidden
                        />
                        <span className="text-xs truncate">{item.category}</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                        {formatEur(item.total)}
                        <span className="ml-1 opacity-70">({pct.toFixed(0)}%)</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PartnerList({
  title,
  partners,
  selectedKey,
  onSelect,
  emptyLabel,
}: {
  title: string;
  partners: PartnerAggregate[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  emptyLabel: string;
}) {
  if (partners.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>Click a partner to filter the list below.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {partners.map((p) => {
            const isSelected = selectedKey === p.key;
            return (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => onSelect(isSelected ? null : p.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer hover:bg-accent/50 ${
                    isSelected ? "bg-accent" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.label}
                      {!p.isCompany && p.key.startsWith("bucket:") && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (bucket)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.count} {p.count === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatEur(p.total)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export function QuarterlyReportView({ data, showPii }: QuarterlyReportViewProps) {
  const [selectedPartnerKey, setSelectedPartnerKey] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);
  const [typeFilter, setTypeFilter] = useState<"all" | "invoice" | "bill">("all");

  // Unique values for dropdowns (derived from rows)
  const partnerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data.rows) {
      if (!map.has(row.partnerKey)) map.set(row.partnerKey, row.partnerLabel);
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data.rows]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of data.rows) set.add(row.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data.rows]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of data.rows) if (row.status) set.add(row.status);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data.rows]);

  const filteredRows: OdooRow[] = useMemo(() => {
    return data.rows.filter((row) => {
      if (selectedPartnerKey && row.partnerKey !== selectedPartnerKey) return false;
      if (categoryFilter !== ALL_VALUE && row.category !== categoryFilter) return false;
      if (statusFilter !== ALL_VALUE && row.status !== statusFilter) return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      return true;
    });
  }, [data.rows, selectedPartnerKey, categoryFilter, statusFilter, typeFilter]);

  const { totals } = data;

  const selectedLabel = useMemo(() => {
    if (!selectedPartnerKey) return null;
    return partnerOptions.find((p) => p.key === selectedPartnerKey)?.label ?? null;
  }, [selectedPartnerKey, partnerOptions]);

  const hasAnyFilter =
    selectedPartnerKey !== null ||
    categoryFilter !== ALL_VALUE ||
    statusFilter !== ALL_VALUE ||
    typeFilter !== "all";

  const clearAllFilters = () => {
    setSelectedPartnerKey(null);
    setCategoryFilter(ALL_VALUE);
    setStatusFilter(ALL_VALUE);
    setTypeFilter("all");
  };

  const hasOdooLinks = useMemo(() => data.rows.some((r) => !!r.odooUrl), [data.rows]);

  const categoriesByType = useMemo(() => {
    function aggregate(rows: OdooRow[]) {
      const map = new Map<string, { total: number; count: number }>();
      for (const row of rows) {
        const entry = map.get(row.category) || { total: 0, count: 0 };
        entry.total += row.totalAmount;
        entry.count += 1;
        map.set(row.category, entry);
      }
      return Array.from(map.entries())
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.total - a.total);
    }
    return {
      invoice: aggregate(data.rows.filter((r) => r.type === "invoice")),
      bill: aggregate(data.rows.filter((r) => r.type === "bill")),
    };
  }, [data.rows]);

  return (
    <main className="min-h-screen bg-background">
      <div className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Hero */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Q{data.quarter} {data.year} — Financial Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Posted Odoo invoices and bills, months{" "}
            {data.months.join(", ")}. Drafts and cancelled entries are excluded.
          </p>
          {data.missingMonths.length > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              No Odoo data found for month(s): {data.missingMonths.join(", ")}
            </p>
          )}
          {!showPii && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                Company names are shown. Individual partners are bucketed to
                protect PII. Sign in as a member to see full details.
              </p>
            </div>
          )}
        </div>

        {/* Totals */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total bills received</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatEur(totals.billsTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {totals.billCount} bills · ex. VAT {formatEur(totals.billsUntaxed)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total invoiced</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatEur(totals.invoicedTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {totals.invoiceCount} invoices · ex. VAT {formatEur(totals.invoicedUntaxed)}
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardDescription>Net VAT position</CardDescription>
              <CardTitle
                className={`text-2xl tabular-nums ${
                  totals.vatNet >= 0 ? "text-foreground" : "text-green-600"
                }`}
              >
                {formatEur(totals.vatNet)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span>Paid to state (on invoices)</span>
                <span className="tabular-nums">{formatEur(totals.vatCollected)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Claimed back (on bills)</span>
                <span className="tabular-nums">{formatEur(totals.vatDeductible)}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Category breakdown */}
        <section className="grid gap-4 lg:grid-cols-2">
          <CategoryBreakdownBar
            title="Costs by category"
            items={categoriesByType.bill}
            total={Math.abs(totals.billsTotal)}
            maxTotal={Math.max(Math.abs(totals.billsTotal), Math.abs(totals.invoicedTotal))}
            selected={categoryFilter}
            onSelect={setCategoryFilter}
            emptyLabel="No bills in this quarter."
          />
          <CategoryBreakdownBar
            title="Income by category"
            items={categoriesByType.invoice}
            total={Math.abs(totals.invoicedTotal)}
            maxTotal={Math.max(Math.abs(totals.billsTotal), Math.abs(totals.invoicedTotal))}
            selected={categoryFilter}
            onSelect={setCategoryFilter}
            emptyLabel="No invoices in this quarter."
          />
        </section>

        {/* Top partners */}
        <section className="grid gap-4 lg:grid-cols-2">
          <PartnerList
            title="Top vendors"
            partners={data.topVendors}
            selectedKey={selectedPartnerKey}
            onSelect={setSelectedPartnerKey}
            emptyLabel="No bills in this quarter."
          />
          <PartnerList
            title="Top customers"
            partners={data.topCustomers}
            selectedKey={selectedPartnerKey}
            onSelect={setSelectedPartnerKey}
            emptyLabel="No invoices in this quarter."
          />
        </section>

        {/* List */}
        <section>
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg">All entries</CardTitle>
                <CardDescription>
                  {filteredRows.length} of {data.rows.length} shown
                  {selectedLabel && (
                    <>
                      {" "}· filtered to{" "}
                      <span className="font-medium text-foreground">
                        {selectedLabel}
                      </span>
                    </>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={typeFilter === "all" ? "default" : "outline"}
                    onClick={() => setTypeFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={typeFilter === "invoice" ? "default" : "outline"}
                    onClick={() => setTypeFilter("invoice")}
                  >
                    Invoices
                  </Button>
                  <Button
                    size="sm"
                    variant={typeFilter === "bill" ? "default" : "outline"}
                    onClick={() => setTypeFilter("bill")}
                  >
                    Bills
                  </Button>
                </div>
                {hasAnyFilter && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearAllFilters}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="min-w-[180px]">
                        <Select
                          value={selectedPartnerKey ?? ALL_VALUE}
                          onValueChange={(v) =>
                            setSelectedPartnerKey(v === ALL_VALUE ? null : v)
                          }
                        >
                          <SelectTrigger className="h-8 border-0 bg-transparent px-0 font-medium text-foreground shadow-none focus:ring-0 focus-visible:ring-0 cursor-pointer">
                            <SelectValue placeholder="Partner" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[320px]">
                            <SelectItem value={ALL_VALUE}>All partners</SelectItem>
                            {partnerOptions.map((p) => (
                              <SelectItem key={p.key} value={p.key}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableHead>
                      <TableHead className="min-w-[160px]">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                          <SelectTrigger className="h-8 border-0 bg-transparent px-0 font-medium text-foreground shadow-none focus:ring-0 focus-visible:ring-0 cursor-pointer">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[320px]">
                            <SelectItem value={ALL_VALUE}>All categories</SelectItem>
                            {categoryOptions.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="min-w-[130px]">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="h-8 border-0 bg-transparent px-0 font-medium text-foreground shadow-none focus:ring-0 focus-visible:ring-0 cursor-pointer">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                            {statusOptions.map((s) => (
                              <SelectItem key={s} value={s}>
                                <span className="capitalize">
                                  {s.replace(/_/g, " ")}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableHead>
                      {hasOdooLinks && (
                        <TableHead className="w-10"></TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={hasOdooLinks ? 6 : 5}
                          className="text-center text-sm text-muted-foreground py-10"
                        >
                          No entries match the current filter.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredRows.map((row) => (
                      <TableRow key={`${row.type}-${row.id}`}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(row.date)}
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <button
                            type="button"
                            onClick={() => setSelectedPartnerKey(row.partnerKey)}
                            className="text-left hover:underline block min-w-0 w-full cursor-pointer"
                            title={row.partnerLabel}
                          >
                            <span className="text-sm truncate block">
                              {row.partnerLabel}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                              {row.direction === "refund" ? `${row.type} refund` : row.type}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(
                              row.category,
                            )}`}
                          >
                            {row.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {formatEur(row.totalAmount, 2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${statusColor(row.status)}`}
                          >
                            {row.status?.replace(/_/g, " ") || "—"}
                          </Badge>
                        </TableCell>
                        {hasOdooLinks && (
                          <TableCell className="w-10">
                            {row.odooUrl && (
                              <a
                                href={row.odooUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                                title="Open in Odoo"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
