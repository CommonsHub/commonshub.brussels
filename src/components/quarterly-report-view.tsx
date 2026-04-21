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
import { X, Lock } from "lucide-react";
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
    year: "numeric",
  });
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
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
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
  const [typeFilter, setTypeFilter] = useState<"all" | "invoice" | "bill">("all");

  const filteredRows: OdooRow[] = useMemo(() => {
    return data.rows.filter((row) => {
      if (selectedPartnerKey && row.partnerKey !== selectedPartnerKey) return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      return true;
    });
  }, [data.rows, selectedPartnerKey, typeFilter]);

  const { totals } = data;

  const selectedLabel = useMemo(() => {
    if (!selectedPartnerKey) return null;
    const vendor = data.topVendors.find((v) => v.key === selectedPartnerKey);
    const customer = data.topCustomers.find((c) => c.key === selectedPartnerKey);
    return (vendor || customer)?.label ?? null;
  }, [selectedPartnerKey, data.topVendors, data.topCustomers]);

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
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <CardDescription>VAT paid to the state</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatEur(totals.vatCollected)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              Collected on outgoing invoices
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>VAT claimed back</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatEur(totals.vatDeductible)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              Deductible on bills received
            </CardContent>
          </Card>
        </section>

        {/* Net VAT */}
        <section>
          <Card className="border-primary/30">
            <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-4">
              <div>
                <p className="text-sm font-medium">Net VAT position</p>
                <p className="text-xs text-muted-foreground">
                  Collected minus deductible — positive means due to the state, negative means refundable.
                </p>
              </div>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  totals.vatNet >= 0 ? "text-foreground" : "text-green-600"
                }`}
              >
                {formatEur(totals.vatNet)}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Top partners */}
        <section className="grid gap-4 lg:grid-cols-2">
          <PartnerList
            title="Top customers"
            partners={data.topCustomers}
            selectedKey={selectedPartnerKey}
            onSelect={setSelectedPartnerKey}
            emptyLabel="No invoices in this quarter."
          />
          <PartnerList
            title="Top vendors"
            partners={data.topVendors}
            selectedKey={selectedPartnerKey}
            onSelect={setSelectedPartnerKey}
            emptyLabel="No bills in this quarter."
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
                {selectedPartnerKey && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedPartnerKey(null)}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear filter
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
                      <TableHead>Type</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Untaxed</TableHead>
                      <TableHead className="text-right">VAT</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center text-sm text-muted-foreground py-10"
                        >
                          No entries match the current filter.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredRows.map((row) => (
                      <TableRow key={`${row.type}-${row.id}`}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(row.date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={row.type === "invoice" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {row.direction === "refund"
                              ? `${row.type} refund`
                              : row.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          <button
                            type="button"
                            onClick={() => setSelectedPartnerKey(row.partnerKey)}
                            className="text-left text-sm hover:underline truncate block w-full"
                            title={row.partnerLabel}
                          >
                            {row.partnerLabel}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.category}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {row.reference || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatEur(row.untaxedAmount, 2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatEur(row.vatAmount, 2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {formatEur(row.totalAmount, 2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {row.status?.replace(/_/g, " ") || "—"}
                          </Badge>
                        </TableCell>
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
