import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "./data-paths";

export type Quarter = 1 | 2 | 3 | 4;

export type OdooRowType = "invoice" | "bill";
export type OdooRowDirection = "positive" | "refund";

export interface OdooRow {
  id: number;
  type: OdooRowType;
  direction: OdooRowDirection;
  date: string;
  reference: string | null;
  month: string;
  partnerId: number | null;
  partnerKey: string;
  partnerLabel: string;
  partnerIsCompany: boolean;
  category: string;
  journal: string;
  untaxedAmount: number;
  vatAmount: number;
  totalAmount: number;
  status: string;
  odooUrl?: string;
}

export interface QuarterlyTotals {
  invoicedTotal: number;
  invoicedUntaxed: number;
  vatCollected: number;
  billsTotal: number;
  billsUntaxed: number;
  vatDeductible: number;
  vatNet: number;
  invoiceCount: number;
  billCount: number;
}

export interface PartnerAggregate {
  key: string;
  label: string;
  isCompany: boolean;
  count: number;
  total: number;
}

export interface QuarterlyData {
  year: string;
  quarter: Quarter;
  months: string[];
  totals: QuarterlyTotals;
  topCustomers: PartnerAggregate[];
  topVendors: PartnerAggregate[];
  rows: OdooRow[];
  redacted: boolean;
  missingMonths: string[];
}

export function getQuarterMonths(quarter: Quarter): string[] {
  const start = (quarter - 1) * 3;
  return [start + 1, start + 2, start + 3].map((n) => n.toString().padStart(2, "0"));
}

export function parseQuarter(segment: string): Quarter | null {
  const match = /^Q([1-4])$/.exec(segment);
  if (!match) return null;
  return parseInt(match[1], 10) as Quarter;
}

interface PublicLineItem {
  displayType?: string;
  totalAmount?: number;
  subtotalAmount?: number;
}

interface PublicRecord {
  id: number;
  title?: string;
  state: string;
  paymentState?: string;
  date: string;
  untaxedAmount?: number;
  vatAmount?: number;
  totalAmount?: number;
  category?: string | null;
  journal?: { id?: number; name?: string };
  lineItems?: PublicLineItem[];
}

interface PrivatePartner {
  id?: number;
  name?: string;
  displayName?: string;
  companyType?: "company" | "person";
  isCompany?: boolean;
}

interface PrivateRecord {
  id: number;
  moveType: string;
  partner?: PrivatePartner;
  partnerDisplayName?: string;
  reference?: string;
  ref?: string;
  number?: string;
  invoiceUrl?: string;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch (error) {
    console.error(`[odoo-quarter] Failed to parse ${filePath}:`, error);
    return null;
  }
}

function buildRow(
  pub: PublicRecord,
  priv: PrivateRecord,
  type: OdooRowType,
  month: string,
  showPii: boolean,
  showOdooLinks: boolean,
): OdooRow {
  const isRefund = priv.moveType === "out_refund" || priv.moveType === "in_refund";
  const sign = isRefund ? -1 : 1;

  const partner = priv.partner ?? {};
  const isCompany = partner.companyType === "company" || partner.isCompany === true;

  let partnerKey: string;
  let partnerLabel: string;
  if (showPii || isCompany) {
    partnerKey = `partner:${partner.id ?? "unknown"}`;
    partnerLabel = partner.displayName || partner.name || priv.partnerDisplayName || "(unknown)";
  } else {
    partnerKey = type === "invoice" ? "bucket:individual-client" : "bucket:individual-supplier";
    partnerLabel = type === "invoice" ? "Individual client" : "Individual supplier";
  }

  return {
    id: pub.id,
    type,
    direction: isRefund ? "refund" : "positive",
    date: pub.date,
    reference: priv.number || priv.reference || priv.ref || pub.title || null,
    month,
    partnerId: partner.id ?? null,
    partnerKey,
    partnerLabel,
    partnerIsCompany: isCompany,
    category: pub.category || pub.journal?.name || "—",
    journal: pub.journal?.name || "",
    untaxedAmount: (pub.untaxedAmount ?? 0) * sign,
    vatAmount: (pub.vatAmount ?? 0) * sign,
    totalAmount: (pub.totalAmount ?? 0) * sign,
    status: pub.paymentState || pub.state,
    odooUrl: showOdooLinks ? priv.invoiceUrl : undefined,
  };
}

function aggregateByPartner(rows: OdooRow[]): PartnerAggregate[] {
  const map = new Map<string, PartnerAggregate>();
  for (const row of rows) {
    const existing = map.get(row.partnerKey);
    if (existing) {
      existing.count += 1;
      existing.total += row.totalAmount;
    } else {
      map.set(row.partnerKey, {
        key: row.partnerKey,
        label: row.partnerLabel,
        isCompany: row.partnerIsCompany,
        count: 1,
        total: row.totalAmount,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function loadQuarterlyOdoo(
  year: string,
  quarter: Quarter,
  options: { showPii: boolean; showOdooLinks?: boolean },
): QuarterlyData {
  const showOdooLinks = options.showOdooLinks ?? false;
  const months = getQuarterMonths(quarter);
  const rows: OdooRow[] = [];
  const missingMonths: string[] = [];

  for (const month of months) {
    // chb writes the Odoo exports under providers/odoo/<org>/; the older
    // finance/odoo layout is kept as a fallback for pre-migration datasets.
    const providerRoot = path.join(DATA_DIR, year, month, "providers", "odoo", "commonshub");
    const legacyRoot = path.join(DATA_DIR, year, month, "finance", "odoo");
    const monthRoot = fs.existsSync(path.join(providerRoot, "invoices.json"))
      ? providerRoot
      : legacyRoot;
    const pubInv = readJson<{ invoices: PublicRecord[] }>(path.join(monthRoot, "invoices.json"));
    const prvInv = readJson<{ invoices: PrivateRecord[] }>(
      path.join(monthRoot, "private", "invoices.json"),
    );
    const pubBill = readJson<{ bills: PublicRecord[] }>(path.join(monthRoot, "bills.json"));
    const prvBill = readJson<{ bills: PrivateRecord[] }>(
      path.join(monthRoot, "private", "bills.json"),
    );

    if (!pubInv && !prvInv && !pubBill && !prvBill) {
      missingMonths.push(month);
      continue;
    }

    if (pubInv && prvInv) {
      const privMap = new Map(prvInv.invoices.map((r) => [r.id, r]));
      for (const pub of pubInv.invoices) {
        if (pub.state !== "posted") continue;
        const priv = privMap.get(pub.id);
        if (!priv) continue;
        rows.push(buildRow(pub, priv, "invoice", month, options.showPii, showOdooLinks));
      }
    }
    if (pubBill && prvBill) {
      const privMap = new Map(prvBill.bills.map((r) => [r.id, r]));
      for (const pub of pubBill.bills) {
        if (pub.state !== "posted") continue;
        const priv = privMap.get(pub.id);
        if (!priv) continue;
        rows.push(buildRow(pub, priv, "bill", month, options.showPii, showOdooLinks));
      }
    }
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const invoices = rows.filter((r) => r.type === "invoice");
  const bills = rows.filter((r) => r.type === "bill");

  const totals: QuarterlyTotals = {
    invoicedTotal: invoices.reduce((s, r) => s + r.totalAmount, 0),
    invoicedUntaxed: invoices.reduce((s, r) => s + r.untaxedAmount, 0),
    vatCollected: invoices.reduce((s, r) => s + r.vatAmount, 0),
    billsTotal: bills.reduce((s, r) => s + r.totalAmount, 0),
    billsUntaxed: bills.reduce((s, r) => s + r.untaxedAmount, 0),
    vatDeductible: bills.reduce((s, r) => s + r.vatAmount, 0),
    vatNet: 0,
    invoiceCount: invoices.length,
    billCount: bills.length,
  };
  totals.vatNet = totals.vatCollected - totals.vatDeductible;

  const topCustomers = aggregateByPartner(invoices).slice(0, 10);
  const topVendors = aggregateByPartner(bills).slice(0, 10);

  return {
    year,
    quarter,
    months,
    totals,
    topCustomers,
    topVendors,
    rows,
    redacted: !options.showPii,
    missingMonths,
  };
}
