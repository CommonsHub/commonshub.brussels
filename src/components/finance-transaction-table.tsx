"use client";

import { Fragment, useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { InlineDescriptionEditor } from "@/components/inline-description-editor";
import { WalletAddress } from "@/components/wallet-address";
import { addressFromUri } from "@/lib/nip73";
import settings from "@/settings/settings.json";
import {
  counterpartyLabel,
  type CounterpartyMetadata,
} from "@/types/counterparties";
import { useNostr } from "@/components/nostr-provider";

interface TransactionMetadata {
  collective: string;
  project: string | null;
  event: string | null;
  category: string;
  tags: string[];
  description: string;
}

interface EnrichedTransaction {
  // Core display fields (TokenTransfer-shaped legacy contract).
  hash?: string;
  timeStamp: string;
  from?: string;
  to?: string;
  value: string;
  transactionId: string;
  transactionUri?: string;
  transactionMetadata?: TransactionMetadata;
  counterpartyId?: string | null;
  counterpartyMetadata?: CounterpartyMetadata;
  accountName?: string;
  accountSlug?: string;
  normalizedAmount?: number;
  amount?: number;
  grossAmount?: number;
  netAmount?: number;
  currency?: string;
  provider?: "etherscan" | "stripe" | string;
  chain?: string | null;
  stripeChargeId?: string;
  type?: "CREDIT" | "DEBIT";
  rawType?: "CREDIT" | "DEBIT" | "MINT" | "BURN" | "TRANSFER" | "INTERNAL";
  timestamp?: number;
}

function typeLabel(
  rawType: EnrichedTransaction["rawType"],
  isIncoming: boolean
): string {
  switch (rawType) {
    case "MINT":
      return "Mint";
    case "BURN":
      return "Burn";
    case "INTERNAL":
      return "Internal";
    case "TRANSFER":
      return "Transfer";
    case "CREDIT":
    case "DEBIT":
    default:
      return isIncoming ? "In" : "Out";
  }
}

function typeBadgeClass(
  rawType: EnrichedTransaction["rawType"],
  isIncoming: boolean
): string {
  switch (rawType) {
    case "MINT":
      // Strong green — fresh tokens entering circulation.
      return "border-transparent bg-green-600 text-white";
    case "BURN":
      // Accent orange — tokens spent / consumed.
      return "border-transparent bg-orange-500 text-white";
    case "INTERNAL":
      // Neutral — between our own accounts.
      return "border-transparent bg-muted text-muted-foreground";
    case "TRANSFER":
      // Cool blue — peer-to-peer token movement.
      return "border-transparent bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100";
    case "CREDIT":
    case "DEBIT":
    default:
      return isIncoming
        ? // Pastel green — money in.
          "border-transparent bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100"
        : // Pastel red — money out.
          "border-transparent bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100";
  }
}

const CHAIN_EXPLORERS: Record<string, string> = {
  gnosis: "https://gnosisscan.io",
  celo: "https://celoscan.io",
  ethereum: "https://etherscan.io",
};

function txExplorerUrl(
  tx: EnrichedTransaction,
  fallbackChain: string
): string | null {
  if (tx.provider === "stripe") {
    if (tx.stripeChargeId) {
      return `https://dashboard.stripe.com/balance/transactions/${tx.stripeChargeId}`;
    }
    return null;
  }
  const chain = tx.chain || fallbackChain;
  const base = chain ? CHAIN_EXPLORERS[chain] : undefined;
  const hash = tx.hash;
  if (!base || !hash) return null;
  return `${base}/tx/${hash}`;
}

function counterpartExplorerUrl(
  tx: EnrichedTransaction,
  fallbackChain: string
): string | null {
  // Stripe customer (when chb starts emitting it).
  if (tx.counterpartyId?.startsWith("stripe:customer:")) {
    const cusId = tx.counterpartyId.slice("stripe:customer:".length);
    return `https://dashboard.stripe.com/customers/${cusId}`;
  }
  // Blockchain address.
  const chain = tx.chain || fallbackChain;
  const base = chain ? CHAIN_EXPLORERS[chain] : undefined;
  const addr = addressFromUri(tx.counterpartyId);
  if (!base || !addr) return null;
  return `${base}/address/${addr}`;
}

interface FinanceTransactionTableProps {
  transactions: EnrichedTransaction[];
  accountAddress: string;
  accountName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  chain: string;
  /** Discord admin — drives batch selection + multi-edit footer. */
  isAdmin: boolean;
  /** Logged-in with the Discord member role — drives inline edit affordances. */
  canEdit?: boolean;
  showAccountColumn?: boolean;
  showExportButton?: boolean;
  useNormalizedAmount?: boolean;
  /** "month" swaps the month-filter for a week-filter and assumes every row
   *  is in the same calendar month. */
  viewScope?: "year" | "month";
}

const EUR_SYMBOLS = new Set(["EUR", "EURe", "EURb"]);

/** Format one row's amount honouring its own currency + sensible decimals. */
function formatRowAmount(
  tx: EnrichedTransaction,
  fallbackSymbol: string,
  fallbackDecimals: number,
  explicitValue?: number
): { value: string; suffix: string } {
  const currency = tx.currency || fallbackSymbol || "";
  const isEur = EUR_SYMBOLS.has(currency);

  // tx.amount/normalizedAmount are already decoded (EUR or token units).
  // For old single-account views without those, fall back to raw value/decimals.
  let decoded: number | undefined;
  if (typeof explicitValue === "number") decoded = explicitValue;
  else if (typeof tx.amount === "number") decoded = tx.amount;
  else if (typeof tx.normalizedAmount === "number") decoded = tx.normalizedAmount;

  let formatted: string;
  if (decoded !== undefined) {
    const abs = Math.abs(decoded);
    if (isEur) {
      formatted = abs.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      const isInt = Number.isInteger(abs);
      formatted = abs.toLocaleString("en-US", {
        minimumFractionDigits: isInt ? 0 : 2,
        maximumFractionDigits: isInt ? 0 : 6,
      });
    }
  } else {
    // legacy raw-integer string path
    try {
      const num = BigInt(tx.value);
      const divisor = BigInt(10 ** fallbackDecimals);
      const integerPart = num / divisor;
      const fractionalPart = num % divisor;
      const fracStr = fractionalPart
        .toString()
        .padStart(fallbackDecimals, "0")
        .replace(/0+$/, "");
      const intStr = integerPart
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      formatted = fracStr ? `${intStr}.${fracStr}` : intStr;
    } catch {
      formatted = "?";
    }
  }

  return isEur
    ? { value: `€${formatted}`, suffix: currency === "EUR" ? "" : currency }
    : { value: formatted, suffix: currency };
}

/** Week-of-month bucket for a given timestamp (1-indexed). */
function weekOfMonth(timestamp: number): number {
  const day = new Date(timestamp * 1000).getDate();
  return Math.min(5, Math.floor((day - 1) / 7) + 1);
}

function weekLabel(year: number, month: number, week: number): string {
  // month is 1-12 here. Build inclusive day range.
  const startDay = (week - 1) * 7 + 1;
  const endDate = new Date(year, month, 0); // last day of month
  const endDay = Math.min(endDate.getDate(), week * 7);
  const fmt = (d: number) =>
    new Date(year, month - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return `Week ${week} (${fmt(startDay)}–${fmt(endDay)})`;
}

function formatAmount(
  value: string,
  decimals: number,
  tokenSymbol: string,
  showDecimals: boolean = true
): string {
  const num = BigInt(value);
  const divisor = BigInt(10 ** decimals);
  const integerPart = num / divisor;
  const fractionalPart = num % divisor;

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  const integerStr = integerPart
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  let formattedNumber;
  if (!showDecimals || trimmedFractional === "") {
    formattedNumber = integerStr;
  } else {
    formattedNumber = `${integerStr}.${trimmedFractional}`;
  }

  const isEuro =
    tokenSymbol === "EUR" || tokenSymbol === "EURe" || tokenSymbol === "EURb";

  if (isEuro) {
    return `€${formattedNumber}`;
  }

  return formattedNumber;
}

/**
 * Reveal panel shown below a row when a member clicks on it.
 * Surfaces the raw chb tags + metadata + identifiers from
 * generated/transactions.json — useful for spot-checking what the
 * pipeline actually wrote for a given row.
 */
function ExpandedRowDetails({ tx }: { tx: EnrichedTransaction }) {
  const rows = tx as unknown as Record<string, unknown>;
  const rawTags = Array.isArray(rows.tags) ? (rows.tags as unknown[][]) : [];
  const metadata = (rows.metadata as Record<string, unknown> | undefined) ?? {};

  const idFields: Array<[string, string | null | undefined]> = [
    ["id", tx.transactionId],
    ["accountId", (rows.accountId as string | undefined) ?? null],
    ["counterpartyId", tx.counterpartyId ?? null],
    ["providerId", (rows.providerId as string | undefined) ?? null],
  ];
  const numericFields: Array<[string, unknown]> = [
    ["amount", tx.amount],
    ["grossAmount", tx.grossAmount],
    ["netAmount", tx.netAmount],
    ["fee", rows.fee],
    ["normalizedAmount", tx.normalizedAmount],
    ["currency", tx.currency],
    ["chain", tx.chain],
    ["provider", tx.provider],
    ["type", tx.rawType ?? tx.type],
    ["value", (rows.value as string | undefined) ?? null],
  ];

  return (
    <div className="grid gap-4 text-xs md:grid-cols-3">
      <section>
        <h4 className="font-semibold text-foreground mb-2">Identifiers</h4>
        <dl className="space-y-1 font-mono">
          {idFields.map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-[7rem_1fr] gap-2 break-all"
            >
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v ?? <span className="text-muted-foreground">—</span>}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h4 className="font-semibold text-foreground mb-2">Fields</h4>
        <dl className="space-y-1 font-mono">
          {numericFields.map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-[7rem_1fr] gap-2 break-all"
            >
              <dt className="text-muted-foreground">{k}</dt>
              <dd>
                {v === null || v === undefined || v === "" ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  String(v)
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="md:col-span-1 col-span-full space-y-4">
        <div>
          <h4 className="font-semibold text-foreground mb-2">
            Tags ({rawTags.length})
          </h4>
          {rawTags.length === 0 ? (
            <p className="text-muted-foreground">no tags</p>
          ) : (
            <ul className="space-y-1 font-mono">
              {rawTags.map((t, i) => (
                <li key={i} className="break-all">
                  <span className="text-muted-foreground">{String(t[0])}</span>
                  {t.length > 1 && (
                    <> = {t.slice(1).map((x) => String(x)).join(" ")}</>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-2">
            Metadata ({Object.keys(metadata).length})
          </h4>
          {Object.keys(metadata).length === 0 ? (
            <p className="text-muted-foreground">no metadata</p>
          ) : (
            <dl className="space-y-1 font-mono">
              {Object.entries(metadata).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[8rem_1fr] gap-2 break-all"
                >
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{String(v ?? "")}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>
    </div>
  );
}

function formatNormalizedAmount(
  amountInCents: number,
  tokenSymbol: string
): string {
  // Handle absolute value for formatting
  const absAmount = Math.abs(amountInCents);
  const euros = absAmount / 100;

  const formattedNumber = euros.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const isEuro =
    tokenSymbol === "EUR" || tokenSymbol === "EURe" || tokenSymbol === "EURb";

  if (isEuro) {
    return `€${formattedNumber}`;
  }

  return formattedNumber;
}

function shortenAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function FinanceTransactionTable({
  transactions,
  accountAddress,
  tokenSymbol,
  tokenDecimals,
  chain,
  isAdmin,
  canEdit = false,
  showAccountColumn = false,
  showExportButton = false,
  useNormalizedAmount = false,
  viewScope = "year",
}: FinanceTransactionTableProps) {
  // Admins are members too for editing purposes; either grants inline edits.
  const canEditRows = canEdit || isAdmin;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { publish, watch, getAnnotation } = useNostr();

  // Subscribe to every NIP-73 URI on this page so we receive annotation
  // events from the relay (and trigger re-renders when they merge in).
  useEffect(() => {
    for (const tx of transactions) {
      if (tx.transactionUri) watch(tx.transactionUri);
      if (tx.counterpartyId) watch(tx.counterpartyId);
    }
  }, [transactions, watch]);

  // Merge baseline + nostr annotation for one row's tx metadata.
  function effectiveTxMetadata(tx: EnrichedTransaction): TransactionMetadata {
    const baseline = tx.transactionMetadata ?? {
      collective: "commonshub",
      project: null,
      event: null,
      category: "other",
      tags: [],
      description: "",
    };
    const ann = tx.transactionUri ? getAnnotation(tx.transactionUri) : undefined;
    if (!ann) return baseline;
    return {
      ...baseline,
      collective: ann.tagMap.collective ?? baseline.collective,
      category: ann.tagMap.category ?? baseline.category,
      description: ann.content || baseline.description,
    };
  }

  // Merge baseline + nostr annotation for one row's counterparty metadata.
  function effectiveCpMetadata(
    tx: EnrichedTransaction
  ): CounterpartyMetadata | undefined {
    const baseline = tx.counterpartyMetadata;
    const ann = tx.counterpartyId ? getAnnotation(tx.counterpartyId) : undefined;
    if (!ann) return baseline;
    return { ...(baseline ?? {}), ...ann.tagMap };
  }

  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(
    new Set()
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleExpanded = (txId: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  const [batchCollective, setBatchCollective] = useState("");
  const [batchCategory, setBatchCategory] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [counterpartFilter, setCounterpartFilter] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [collectiveFilter, setCollectiveFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  // Initialize filters from URL on mount
  useEffect(() => {
    const counterpart = searchParams.get("counterpart");
    const min = searchParams.get("minAmount");
    const max = searchParams.get("maxAmount");
    const collective = searchParams.get("collective");
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const month = searchParams.get("month");
    const week = searchParams.get("week");
    const account = searchParams.get("account");

    if (counterpart) setCounterpartFilter(counterpart);
    if (min) setMinAmount(min);
    if (max) setMaxAmount(max);
    if (collective) setCollectiveFilter(collective);
    if (category) setCategoryFilter(category);
    if (type) setTypeFilter(type);
    if (month) setMonthFilter(month);
    if (week) setWeekFilter(week);
    if (account) setAccountFilter(account);
  }, [searchParams]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Update or remove each filter param
    if (counterpartFilter !== "all") {
      params.set("counterpart", counterpartFilter);
    } else {
      params.delete("counterpart");
    }

    if (minAmount) {
      params.set("minAmount", minAmount);
    } else {
      params.delete("minAmount");
    }

    if (maxAmount) {
      params.set("maxAmount", maxAmount);
    } else {
      params.delete("maxAmount");
    }

    if (collectiveFilter !== "all") {
      params.set("collective", collectiveFilter);
    } else {
      params.delete("collective");
    }

    if (categoryFilter !== "all") {
      params.set("category", categoryFilter);
    } else {
      params.delete("category");
    }

    if (typeFilter !== "all") {
      params.set("type", typeFilter);
    } else {
      params.delete("type");
    }

    if (monthFilter !== "all") {
      params.set("month", monthFilter);
    } else {
      params.delete("month");
    }

    if (weekFilter !== "all") {
      params.set("week", weekFilter);
    } else {
      params.delete("week");
    }

    if (accountFilter !== "all") {
      params.set("account", accountFilter);
    } else {
      params.delete("account");
    }

    const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
    router.replace(newUrl, { scroll: false });
  }, [
    counterpartFilter,
    minAmount,
    maxAmount,
    collectiveFilter,
    categoryFilter,
    typeFilter,
    monthFilter,
    weekFilter,
    accountFilter,
    router,
  ]);

  // Get collectives and categories from settings
  const collectivesObj = (settings.finance as any).collectives || {};
  const collectives = Object.keys(collectivesObj);
  const categoriesObj = (settings.finance as any).categories || {};

  // Categories applicable to a given row.
  //
  // MINT/BURN means different things depending on the currency: for the
  // contribution token (CHT) they're "why tokens were issued / spent"
  // (heartbeat, booking, …); for Monerium EURe/EURb they're "money in /
  // money out" — i.e. the same shape as Stripe CREDIT/DEBIT. So pick the
  // list by currency family first, then by direction inside it.
  //
  // INTERNAL → no categories (it's between our own accounts).
  function categoriesForTx(tx: EnrichedTransaction): string[] {
    if (tx.rawType === "INTERNAL") return [];
    const isContributionToken =
      tx.currency ===
      (settings as any).contributionToken?.symbol;
    if (isContributionToken) {
      switch (tx.rawType) {
        case "MINT":
          return categoriesObj.mint || [];
        case "BURN":
        case "TRANSFER":
          return categoriesObj.burn || [];
        case "DEBIT":
          return categoriesObj.debit || [];
        case "CREDIT":
        default:
          return categoriesObj.credit || [];
      }
    }
    // Fiat-like currency (EUR / EURe / EURb / Stripe EUR / …). Direction
    // is what matters; the tx.type override from augmentTransaction has
    // already been normalised to CREDIT / DEBIT.
    return tx.type === "DEBIT"
      ? categoriesObj.debit || []
      : categoriesObj.credit || [];
  }

  // Extract unique values for filter dropdowns
  // Best human-readable label for a row's counterparty: the annotated
  // name from generated/counterparties.json, or null when there's no
  // entry for this counterparty.
  function counterpartLabelForTx(tx: EnrichedTransaction): string | null {
    return counterpartyLabel(tx.counterpartyMetadata) || null;
  }

  const uniqueCounterparts = useMemo(() => {
    const counterparts = new Set<string>();
    transactions.forEach((tx) => {
      const label = counterpartLabelForTx(tx);
      if (label) counterparts.add(label);
    });
    return Array.from(counterparts).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [transactions]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    for (const key of ["credit", "debit", "mint", "burn"] as const) {
      for (const cat of categoriesObj[key] || []) categories.add(cat);
    }
    return Array.from(categories).sort();
  }, [categoriesObj]);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((tx) => {
      const timestamp = tx.timestamp || parseInt(tx.timeStamp);
      const date = new Date(timestamp * 1000);
      const monthYear = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      months.add(monthYear);
    });
    return Array.from(months).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
  }, [transactions]);

  // Weeks (1..5) present in the data and the calendar-month they belong to.
  const weekContext = useMemo(() => {
    if (viewScope !== "month") return null;
    const weeks = new Set<number>();
    let year: number | null = null;
    let month: number | null = null;
    for (const tx of transactions) {
      const ts = tx.timestamp || parseInt(tx.timeStamp || "0");
      if (!ts) continue;
      const d = new Date(ts * 1000);
      if (year === null) {
        year = d.getFullYear();
        month = d.getMonth() + 1;
      }
      weeks.add(weekOfMonth(ts));
    }
    if (year === null || month === null) return null;
    return { year, month, weeks: Array.from(weeks).sort((a, b) => a - b) };
  }, [transactions, viewScope]);

  const uniqueAccounts = useMemo(() => {
    // [slug, name] tuples — slug is what the URL stores and what the
    // filter compares against; name is the human label shown in the
    // dropdown.
    const accounts = new Map<string, string>();
    transactions.forEach((tx) => {
      if (tx.accountSlug) {
        accounts.set(tx.accountSlug, tx.accountName || tx.accountSlug);
      }
    });
    return Array.from(accounts.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([slug, name]) => ({ slug, name }));
  }, [transactions]);

  // Calculate counts for each filter option
  const filterCounts = useMemo(() => {
    const counts = {
      months: new Map<string, number>(),
      accounts: new Map<string, number>(),
      types: {
        in: 0,
        out: 0,
        mint: 0,
        burn: 0,
        internal: 0,
        transfer: 0,
      },
      collectives: new Map<string, number>(),
      categories: new Map<string, number>(),
      counterparts: new Map<string, number>(),
    };

    transactions.forEach((tx) => {
      // Check if transaction matches all filters EXCEPT the one we're counting for
      const isIncoming = useNormalizedAmount
        ? tx.type === "CREDIT"
        : tx.to?.toLowerCase() === accountAddress?.toLowerCase();

      // Get transaction values
      const amount =
        Math.abs(Number(tx.amount ?? Number(tx.value) ?? 0));

      const timestamp = tx.timestamp || parseInt(tx.timeStamp);
      const date = new Date(timestamp * 1000);
      const monthYear = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      const txCounterpart = counterpartLabelForTx(tx);
      const txCollective = tx.transactionMetadata?.collective || "commonshub";
      const txCategory = tx.transactionMetadata?.category || "other";
      const txAccount = tx.accountSlug;

      // Helper to check if tx matches all filters except one
      const matchesFiltersExcept = (exceptFilter: string) => {
        if (
          exceptFilter !== "counterpart" &&
          counterpartFilter !== "all" &&
          txCounterpart !== counterpartFilter
        )
          return false;
        if (
          exceptFilter !== "amount" &&
          minAmount &&
          amount < parseFloat(minAmount)
        )
          return false;
        if (
          exceptFilter !== "amount" &&
          maxAmount &&
          amount > parseFloat(maxAmount)
        )
          return false;
        if (
          exceptFilter !== "collective" &&
          collectiveFilter !== "all" &&
          txCollective !== collectiveFilter
        )
          return false;
        if (
          exceptFilter !== "category" &&
          categoryFilter !== "all" &&
          txCategory !== categoryFilter
        )
          return false;
        if (exceptFilter !== "type" && typeFilter !== "all") {
          if (typeFilter === "in" && !isIncoming) return false;
          if (typeFilter === "out" && isIncoming) return false;
          if (
            typeFilter === "mint" ||
            typeFilter === "burn" ||
            typeFilter === "internal" ||
            typeFilter === "transfer"
          ) {
            if ((tx.rawType ?? "").toLowerCase() !== typeFilter) return false;
          }
        }
        if (
          exceptFilter !== "month" &&
          monthFilter !== "all" &&
          monthYear !== monthFilter
        )
          return false;
        if (
          exceptFilter !== "account" &&
          accountFilter !== "all" &&
          txAccount !== accountFilter
        )
          return false;
        return true;
      };

      // Count for month filter
      if (matchesFiltersExcept("month")) {
        counts.months.set(monthYear, (counts.months.get(monthYear) || 0) + 1);
      }

      // Count for account filter
      if (txAccount && matchesFiltersExcept("account")) {
        counts.accounts.set(
          txAccount,
          (counts.accounts.get(txAccount) || 0) + 1
        );
      }

      // Count for type filter
      if (matchesFiltersExcept("type")) {
        if (isIncoming) {
          counts.types.in++;
        } else {
          counts.types.out++;
        }
        const raw = (tx.rawType ?? "").toLowerCase();
        if (raw === "mint") counts.types.mint++;
        else if (raw === "burn") counts.types.burn++;
        else if (raw === "internal") counts.types.internal++;
        else if (raw === "transfer") counts.types.transfer++;
      }

      // Count for collective filter
      if (matchesFiltersExcept("collective")) {
        counts.collectives.set(
          txCollective,
          (counts.collectives.get(txCollective) || 0) + 1
        );
      }

      // Count for category filter
      if (matchesFiltersExcept("category")) {
        counts.categories.set(
          txCategory,
          (counts.categories.get(txCategory) || 0) + 1
        );
      }

      // Count for counterpart filter
      if (txCounterpart && matchesFiltersExcept("counterpart")) {
        counts.counterparts.set(
          txCounterpart,
          (counts.counterparts.get(txCounterpart) || 0) + 1
        );
      }
    });

    return counts;
  }, [
    transactions,
    counterpartFilter,
    minAmount,
    maxAmount,
    collectiveFilter,
    categoryFilter,
    typeFilter,
    monthFilter,
    accountFilter,
    tokenDecimals,
    accountAddress,
    useNormalizedAmount,
  ]);

  // Filter transactions based on all filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Determine if transaction is incoming
      const isIncoming = useNormalizedAmount
        ? tx.type === "CREDIT"
        : tx.to?.toLowerCase() === accountAddress?.toLowerCase();

      // Filter by counterpart
      if (counterpartFilter !== "all") {
        const txCounterpart = counterpartLabelForTx(tx);
        if (txCounterpart !== counterpartFilter) return false;
      }

      // Filter by amount
      const amount =
        Math.abs(Number(tx.amount ?? Number(tx.value) ?? 0));
      if (minAmount && amount < parseFloat(minAmount)) return false;
      if (maxAmount && amount > parseFloat(maxAmount)) return false;

      // Filter by collective
      if (collectiveFilter !== "all") {
        const txCollective = tx.transactionMetadata?.collective || "commonshub";
        if (txCollective !== collectiveFilter) return false;
      }

      // Filter by category
      if (categoryFilter !== "all") {
        const txCategory = tx.transactionMetadata?.category || "other";
        if (txCategory !== categoryFilter) return false;
      }

      // Filter by type
      if (typeFilter !== "all") {
        if (typeFilter === "in" && !isIncoming) return false;
        if (typeFilter === "out" && isIncoming) return false;
        if (
          typeFilter === "mint" ||
          typeFilter === "burn" ||
          typeFilter === "internal" ||
          typeFilter === "transfer"
        ) {
          if ((tx.rawType ?? "").toLowerCase() !== typeFilter) return false;
        }
      }

      // Filter by month (year-scope only)
      if (viewScope === "year" && monthFilter !== "all") {
        const timestamp = tx.timestamp || parseInt(tx.timeStamp);
        const date = new Date(timestamp * 1000);
        const monthYear = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        });
        if (monthYear !== monthFilter) return false;
      }

      // Filter by week (month-scope only)
      if (viewScope === "month" && weekFilter !== "all") {
        const timestamp = tx.timestamp || parseInt(tx.timeStamp);
        if (String(weekOfMonth(timestamp)) !== weekFilter) return false;
      }

      // Filter by account
      if (accountFilter !== "all") {
        if (tx.accountSlug !== accountFilter) return false;
      }

      return true;
    });
  }, [
    transactions,
    counterpartFilter,
    minAmount,
    maxAmount,
    collectiveFilter,
    categoryFilter,
    typeFilter,
    monthFilter,
    weekFilter,
    accountFilter,
    tokenDecimals,
    accountAddress,
    useNormalizedAmount,
    viewScope,
  ]);

  // Calculate totals for filtered transactions
  const totals = useMemo(() => {
    // Per-currency totals. EUR / EURe / EURb collapse to a single "EUR"
    // bucket since they're all denominated in euros (Stripe EUR, Monerium
    // EURe and EURb are all 1:1 with the euro).
    const byCurrency = new Map<
      string,
      { totalIn: number; totalOut: number }
    >();
    const canonical = (currency: string | undefined): string => {
      if (!currency) return "?";
      if (currency === "EUR" || currency === "EURe" || currency === "EURb")
        return "EUR";
      return currency;
    };

    filteredTransactions.forEach((tx) => {
      const isIncoming = useNormalizedAmount
        ? tx.type === "CREDIT"
        : tx.to?.toLowerCase() === accountAddress?.toLowerCase();

      const amount = Number(tx.amount ?? Number(tx.value) ?? 0);
      const cur = canonical(tx.currency || tokenSymbol);
      const entry = byCurrency.get(cur) ?? { totalIn: 0, totalOut: 0 };
      if (isIncoming) entry.totalIn += amount;
      else entry.totalOut += amount;
      byCurrency.set(cur, entry);
    });

    const perCurrency = Array.from(byCurrency.entries())
      .map(([currency, v]) => ({
        currency,
        totalIn: v.totalIn,
        totalOut: v.totalOut,
        net: v.totalIn - v.totalOut,
      }))
      // Show EUR first, then alphabetical for the rest.
      .sort((a, b) => {
        if (a.currency === "EUR") return -1;
        if (b.currency === "EUR") return 1;
        return a.currency.localeCompare(b.currency);
      });

    return {
      count: filteredTransactions.length,
      perCurrency,
    };
  }, [
    filteredTransactions,
    useNormalizedAmount,
    accountAddress,
    tokenSymbol,
  ]);

  // Totals grouped by collective × currency (same currency-merge rules as
  // `totals` above: EUR / EURe / EURb collapse to "EUR").
  // Computed off the unfiltered `transactions` so every collective stays
  // visible as a clickable dashboard card regardless of the current
  // collective filter.
  const totalsByCollective = useMemo(() => {
    const canonical = (currency: string | undefined): string => {
      if (!currency) return "?";
      if (currency === "EUR" || currency === "EURe" || currency === "EURb")
        return "EUR";
      return currency;
    };
    const map = new Map<
      string,
      Map<string, { totalIn: number; totalOut: number; count: number }>
    >();
    transactions.forEach((tx) => {
      const meta = effectiveTxMetadata(tx);
      const collective = meta.collective || "commonshub";
      const isIncoming = useNormalizedAmount
        ? tx.type === "CREDIT"
        : tx.to?.toLowerCase() === accountAddress?.toLowerCase();
      const amount = Number(tx.amount ?? Number(tx.value) ?? 0);
      const cur = canonical(tx.currency || tokenSymbol);
      if (!map.has(collective)) map.set(collective, new Map());
      const byCur = map.get(collective)!;
      const entry = byCur.get(cur) ?? {
        totalIn: 0,
        totalOut: 0,
        count: 0,
      };
      entry.count += 1;
      if (isIncoming) entry.totalIn += amount;
      else entry.totalOut += amount;
      byCur.set(cur, entry);
    });
    return Array.from(map.entries())
      .map(([collective, byCur]) => ({
        collective,
        perCurrency: Array.from(byCur.entries())
          .map(([currency, v]) => ({
            currency,
            totalIn: v.totalIn,
            totalOut: v.totalOut,
            net: v.totalIn - v.totalOut,
            count: v.count,
          }))
          .sort((a, b) => {
            if (a.currency === "EUR") return -1;
            if (b.currency === "EUR") return 1;
            return a.currency.localeCompare(b.currency);
          }),
      }))
      .sort((a, b) => {
        // Push "commonshub" first; the rest alphabetical.
        if (a.collective === "commonshub") return -1;
        if (b.collective === "commonshub") return 1;
        return a.collective.localeCompare(b.collective);
      });
    // effectiveTxMetadata depends on the nostr annotation context, which
    // is fetched via the hook closure — re-running on transactions
    // changes is good enough since annotation updates trigger re-renders
    // through React state anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, useNormalizedAmount, accountAddress, tokenSymbol]);

  const toggleTransaction = (txId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(txId)) {
      newSelected.delete(txId);
    } else {
      newSelected.add(txId);
    }
    setSelectedTransactions(newSelected);
  };

  const toggleAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(
        new Set(filteredTransactions.map((tx) => tx.transactionId))
      );
    }
  };

  const selectedTotal = useMemo(() => {
    // Sum the human-unit amount (tx.amount is already the parsed number).
    // chb writes tx.value as a decimal string ("3.000000"), which isn't
    // a valid BigInt input, so we can't accumulate token-level integers
    // any more.
    let total = 0;
    transactions.forEach((tx) => {
      if (selectedTransactions.has(tx.transactionId)) {
        const isIncoming =
          tx.to?.toLowerCase() === accountAddress?.toLowerCase();
        const value = Number(tx.amount ?? Number(tx.value) ?? 0);
        total += isIncoming ? value : -value;
      }
    });
    return total;
  }, [selectedTransactions, transactions, accountAddress]);

  const handleBatchUpdate = async () => {
    if (selectedTransactions.size < 2) return;

    setIsBatchUpdating(true);
    try {
      const tagPatch: Record<string, string> = {};
      if (batchCollective) tagPatch.collective = batchCollective;
      if (batchCategory) tagPatch.category = batchCategory;

      const selectedRows = transactions.filter(
        (tx) => selectedTransactions.has(tx.transactionId) && tx.transactionUri
      );

      await Promise.all(
        selectedRows.map((tx) =>
          publish(tx.transactionUri!, {
            content: batchNote || undefined,
            tags: tagPatch,
          })
        )
      );
    } catch (error) {
      console.error("Error batch updating transactions:", error);
      alert("Failed to publish annotations");
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const exportToCSV = () => {
    // Prepare CSV headers — match the on-screen column order.
    const headers = [
      "Date",
      "Type",
      "Amount",
      "Counterpart",
      "Collective",
      "Category",
      "Description",
      ...(showAccountColumn ? ["Account"] : []),
      "Transaction Hash",
    ];

    // Prepare CSV rows
    const rows = filteredTransactions.map((tx) => {
      const date = new Date(parseInt(tx.timeStamp) * 1000);
      const dateStr = date.toLocaleDateString("en-GB");
      const timeStr = date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const isIncoming = useNormalizedAmount
        ? tx.type === "CREDIT"
        : tx.to?.toLowerCase() === accountAddress?.toLowerCase();
      const a = formatRowAmount(
        tx,
        tokenSymbol,
        tokenDecimals,
        typeof tx.grossAmount === "number" ? tx.grossAmount : undefined
      );
      const amount = a.suffix ? `${a.value} ${a.suffix}` : a.value;

      const txMeta = effectiveTxMetadata(tx);
      const cpMeta = effectiveCpMetadata(tx);
      const collective = txMeta.collective || "commonshub";
      const category = txMeta.category || "";
      const cpLabel = counterpartyLabel(cpMeta);
      const description = txMeta.description || "";
      const counterparty = cpLabel || (isIncoming ? tx.from : tx.to) || "";

      const row = [
        `${dateStr} ${timeStr}`,
        typeLabel(tx.rawType, isIncoming),
        `${isIncoming ? "+" : "-"}${amount}`,
        counterparty,
        collective,
        category,
        description,
        ...(showAccountColumn ? [tx.accountName || ""] : []),
        tx.hash ?? "",
      ];

      return row;
    });

    // Convert to CSV string
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            // Escape cells that contain commas, quotes, or newlines
            const cellStr = String(cell);
            if (
              cellStr.includes(",") ||
              cellStr.includes('"') ||
              cellStr.includes("\n")
            ) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(",")
      ),
    ].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${new Date().toISOString().split("T")[0]}-transactions.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format a signed currency amount, e.g. "+€42.00" or "-3.5 CHT".
  const formatSummaryAmount = (
    sign: "+" | "-",
    n: number,
    currency: string
  ): string => {
    const isEur = currency === "EUR";
    const display = n.toLocaleString("en-US", {
      minimumFractionDigits: isEur ? 2 : 0,
      maximumFractionDigits: isEur ? 2 : 6,
    });
    return isEur ? `${sign}€${display}` : `${sign}${display} ${currency}`;
  };

  return (
    <div>
      {showExportButton && (
        <div className="flex justify-end mb-4 px-4">
          <Button onClick={exportToCSV} variant="outline" size="sm">
            Export to CSV
          </Button>
        </div>
      )}
      {totalsByCollective.length > 0 && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 px-4">
          {totalsByCollective.map((c) => {
            const name =
              collectivesObj[c.collective]?.name || c.collective;
            const isActive = collectiveFilter === c.collective;
            const totalCount = c.perCurrency.reduce(
              (sum, r) => sum + r.count,
              0
            );
            return (
              <button
                key={c.collective}
                type="button"
                onClick={() =>
                  setCollectiveFilter(isActive ? "all" : c.collective)
                }
                aria-pressed={isActive}
                title={
                  isActive
                    ? `Showing only ${name} — click to clear`
                    : `Filter by ${name}`
                }
                className={`text-left rounded-lg border p-3 transition-colors ${
                  isActive
                    ? "bg-primary/10 border-primary"
                    : "bg-muted/20 border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm truncate">{name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {totalCount}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {c.perCurrency.map((row) => (
                    <div
                      key={row.currency}
                      className="flex flex-col text-xs"
                    >
                      <span
                        className={`whitespace-nowrap font-semibold ${
                          row.net >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatSummaryAmount(
                          row.net >= 0 ? "+" : "-",
                          Math.abs(row.net),
                          row.currency
                        )}
                      </span>
                      <div className="flex gap-2 text-muted-foreground">
                        <span className="whitespace-nowrap">
                          {formatSummaryAmount(
                            "+",
                            row.totalIn,
                            row.currency
                          )}
                        </span>
                        <span className="whitespace-nowrap">
                          {formatSummaryAmount(
                            "-",
                            row.totalOut,
                            row.currency
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-muted/30">
          <tr className="text-xs text-muted-foreground">
            {isAdmin && (
              <th className="text-left py-2 px-4 font-medium w-8">
                <input
                  type="checkbox"
                  checked={
                    selectedTransactions.size === filteredTransactions.length &&
                    filteredTransactions.length > 0
                  }
                  onChange={toggleAll}
                  className="cursor-pointer"
                />
              </th>
            )}
            <th className="text-left py-2 px-4 font-medium w-24">Date</th>
            <th className="text-left py-2 px-4 font-medium">Type</th>
            <th className="text-left py-2 px-4 font-medium">Amount</th>
            <th className="text-left py-2 px-4 font-medium">Counterpart</th>
            <th className="text-left py-2 px-4 font-medium">Collective</th>
            <th className="text-left py-2 px-4 font-medium">Category</th>
            <th className="text-left py-2 px-4 font-medium">Description</th>
            {showAccountColumn && (
              <th className="text-left py-2 px-4 font-medium">Account</th>
            )}
          </tr>
          {/* Filter row */}
          <tr className="bg-muted/10 border-b">
            {isAdmin && <th className="py-2 px-4"></th>}
            <th className="py-2 px-4 w-24">
              {viewScope === "month" && weekContext ? (
                <Select value={weekFilter} onValueChange={setWeekFilter}>
                  <SelectTrigger className="h-7 text-xs w-full min-w-0">
                    <SelectValue placeholder="Week" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All weeks ({totals.count})
                    </SelectItem>
                    {weekContext.weeks.map((w) => (
                      <SelectItem
                        key={w}
                        value={String(w)}
                        className="text-xs"
                      >
                        {weekLabel(weekContext.year, weekContext.month, w)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="h-7 text-xs w-full min-w-0">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All months ({totals.count})
                    </SelectItem>
                    {uniqueMonths.map((month) => (
                      <SelectItem key={month} value={month} className="text-xs">
                        {month} ({filterCounts.months.get(month) || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </th>
            <th className="py-2 px-4">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-7 text-xs w-full">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All ({totals.count})
                  </SelectItem>
                  <SelectItem value="in" className="text-xs">
                    In ({filterCounts.types.in})
                  </SelectItem>
                  <SelectItem value="out" className="text-xs">
                    Out ({filterCounts.types.out})
                  </SelectItem>
                  {filterCounts.types.mint > 0 && (
                    <SelectItem value="mint" className="text-xs">
                      Mint ({filterCounts.types.mint})
                    </SelectItem>
                  )}
                  {filterCounts.types.burn > 0 && (
                    <SelectItem value="burn" className="text-xs">
                      Burn ({filterCounts.types.burn})
                    </SelectItem>
                  )}
                  {filterCounts.types.transfer > 0 && (
                    <SelectItem value="transfer" className="text-xs">
                      Transfer ({filterCounts.types.transfer})
                    </SelectItem>
                  )}
                  {filterCounts.types.internal > 0 && (
                    <SelectItem value="internal" className="text-xs">
                      Internal ({filterCounts.types.internal})
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </th>
            <th className="py-2 px-4">
              <div className="flex gap-1">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="h-7 text-xs w-16"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="h-7 text-xs w-16"
                />
              </div>
            </th>
            <th className="py-2 px-4">
              <Select
                value={counterpartFilter}
                onValueChange={setCounterpartFilter}
              >
                <SelectTrigger className="h-7 text-xs w-full">
                  <SelectValue placeholder="All counterparts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All counterparts ({totals.count})
                  </SelectItem>
                  {uniqueCounterparts.map((name) => (
                    <SelectItem key={name} value={name} className="text-xs">
                      {name} ({filterCounts.counterparts.get(name) || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </th>
            <th className="py-2 px-4">
              <Select
                value={collectiveFilter}
                onValueChange={setCollectiveFilter}
              >
                <SelectTrigger className="h-7 text-xs w-full">
                  <SelectValue placeholder="All collectives" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All collectives ({totals.count})
                  </SelectItem>
                  {collectives.map((slug) => (
                    <SelectItem key={slug} value={slug} className="text-xs">
                      {collectivesObj[slug]?.name || slug} (
                      {filterCounts.collectives.get(slug) || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </th>
            <th className="py-2 px-4" colSpan={showAccountColumn ? 1 : 2}>
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger className="h-7 text-xs w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All categories ({totals.count})
                  </SelectItem>
                  {uniqueCategories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat} ({filterCounts.categories.get(cat) || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </th>
            {showAccountColumn && (
              <>
                <th className="py-2 px-4"></th>
                <th className="py-2 px-4">
                  <Select
                    value={accountFilter}
                    onValueChange={setAccountFilter}
                  >
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue placeholder="All accounts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">
                        All accounts ({totals.count})
                      </SelectItem>
                      {uniqueAccounts.map((account) => (
                        <SelectItem
                          key={account.slug}
                          value={account.slug}
                          className="text-xs"
                        >
                          {account.name} (
                          {filterCounts.accounts.get(account.slug) || 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {filteredTransactions.map((tx, index) => {
            // Determine if transaction is incoming based on mode
            const isIncoming = useNormalizedAmount
              ? tx.type === "CREDIT"
              : tx.to?.toLowerCase() === accountAddress?.toLowerCase();

            // Use appropriate timestamp field based on mode
            const timestamp =
              useNormalizedAmount && tx.timestamp
                ? tx.timestamp
                : parseInt(tx.timeStamp || "0");
            const date = new Date(timestamp * 1000);
            const dateStr = date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            const timeStr = date.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const categories = categoriesForTx(tx);

            const txMeta = effectiveTxMetadata(tx);
            const cpMeta = effectiveCpMetadata(tx);

            const isExpanded = expandedRows.has(tx.transactionId);

            return (
              <Fragment key={`${tx.hash}-${index}`}>
              <tr
                className={`hover:bg-muted/20 transition-colors text-sm ${
                  selectedTransactions.has(tx.transactionId)
                    ? "bg-muted/30"
                    : ""
                }`}
                onClick={(e) => {
                  // Don't toggle if clicking on interactive elements
                  const target = e.target as HTMLElement;
                  if (
                    target.tagName === "INPUT" ||
                    target.tagName === "SELECT" ||
                    target.tagName === "BUTTON" ||
                    target.tagName === "A" ||
                    target.closest("button") ||
                    target.closest("a") ||
                    target.closest(".select-trigger")
                  ) {
                    return;
                  }
                  if (canEditRows) {
                    toggleExpanded(tx.transactionId);
                  }
                }}
                style={{ cursor: canEditRows ? "pointer" : "default" }}
              >
                {isAdmin && (
                  <td className="py-2.5 px-4">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.has(tx.transactionId)}
                      onChange={() => toggleTransaction(tx.transactionId)}
                      className="cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                <td className="py-2.5 px-4">
                  <div className="flex items-start gap-1.5">
                    <div>
                      <div className="font-medium">{dateStr}</div>
                      <div className="text-xs text-muted-foreground">
                        {timeStr}
                      </div>
                    </div>
                    {(() => {
                      const href = txExplorerUrl(tx, chain);
                      if (!href) return null;
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 text-muted-foreground hover:text-foreground"
                          title="View transaction on block explorer"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      );
                    })()}
                  </div>
                </td>
                <td className="py-2.5 px-4">
                  <Badge
                    className={`text-xs ${typeBadgeClass(tx.rawType, isIncoming)}`}
                  >
                    {typeLabel(tx.rawType, isIncoming)}
                  </Badge>
                </td>
                <td className="py-2.5 px-4">
                  {(() => {
                    const hasGross = typeof tx.grossAmount === "number";
                    const hasNet = typeof tx.netAmount === "number";
                    const grossVal = hasGross ? tx.grossAmount : undefined;
                    const netVal = hasNet ? tx.netAmount : undefined;
                    const showNet =
                      hasGross && hasNet && tx.grossAmount !== tx.netAmount;

                    const gross = formatRowAmount(
                      tx,
                      tokenSymbol,
                      tokenDecimals,
                      grossVal
                    );
                    const net = showNet
                      ? formatRowAmount(tx, tokenSymbol, tokenDecimals, netVal)
                      : null;

                    return (
                      <>
                        <div
                          className={`whitespace-nowrap font-semibold text-base ${isIncoming ? "text-green-600" : "text-red-600"}`}
                        >
                          {isIncoming ? "+" : "-"}
                          {gross.value}
                        </div>
                        {net ? (
                          <div className="whitespace-nowrap text-xs text-muted-foreground">
                            {isIncoming ? "+" : "-"}
                            {net.value}
                            {net.suffix ? ` ${net.suffix}` : ""}
                          </div>
                        ) : gross.suffix ? (
                          <div className="text-xs text-muted-foreground">
                            {gross.suffix}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </td>
                <td className="py-2.5 px-4">
                  {(() => {
                    const cpName = counterpartyLabel(cpMeta);
                    const cpAddr = addressFromUri(tx.counterpartyId);
                    const cpExplorer = counterpartExplorerUrl(tx, chain);
                    const editable = canEditRows && !!tx.counterpartyId;

                    const explorerIcon = cpExplorer ? (
                      <a
                        href={cpExplorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground"
                        title={
                          tx.provider === "stripe"
                            ? "Open in Stripe"
                            : "View address on block explorer"
                        }
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : null;

                    const renderEditor = (placeholder: string) => (
                      <div onClick={(e) => e.stopPropagation()}>
                        <InlineDescriptionEditor
                          value={cpName}
                          className="font-medium"
                          placeholder={placeholder}
                          onSave={async (value) => {
                            if (tx.counterpartyId) {
                              await publish(tx.counterpartyId, {
                                tags: { name: value },
                              });
                            }
                          }}
                        />
                      </div>
                    );

                    // A labeled counterparty — render the label once. Click
                    // to edit if allowed; otherwise plain text.
                    if (cpName) {
                      return (
                        <div className="flex items-center gap-1.5">
                          {editable ? (
                            renderEditor("add label")
                          ) : (
                            <div className="font-medium">{cpName}</div>
                          )}
                          {explorerIcon}
                        </div>
                      );
                    }

                    // Stripe row with no label and no address — nothing to show.
                    if (tx.provider === "stripe") {
                      if (editable) {
                        return (
                          <div className="flex items-center gap-1.5">
                            {renderEditor("add label")}
                            {explorerIcon}
                          </div>
                        );
                      }
                      return (
                        <div className="text-xs text-muted-foreground">—</div>
                      );
                    }

                    // Blockchain row, no annotated name: show the address
                    // (WalletAddress already wraps it in its own explorer
                    // link + copy button) with an optional inline editor
                    // beneath for adding a label.
                    if (cpAddr) {
                      return (
                        <div className="flex flex-col gap-1">
                          <WalletAddress
                            address={cpAddr}
                            chain={tx.chain || chain}
                            showLink={true}
                            showCopy={true}
                          />
                          {editable && renderEditor("add label")}
                        </div>
                      );
                    }

                    return (
                      <div className="text-xs text-muted-foreground">—</div>
                    );
                  })()}
                </td>
                <td
                  className="py-2.5 px-4"
                  onClick={(e) => canEditRows && e.stopPropagation()}
                >
                  {canEditRows ? (
                    <Select
                      value={txMeta.collective || "commonshub"}
                      disabled={!tx.transactionUri}
                      onValueChange={(value) => {
                        if (tx.transactionUri) {
                          publish(tx.transactionUri, {
                            tags: { collective: value },
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs select-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {collectives.map((slug) => (
                          <SelectItem
                            key={slug}
                            value={slug}
                            className="text-xs"
                          >
                            {collectivesObj[slug]?.name || slug}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {collectivesObj[txMeta.collective || "commonshub"]?.name ||
                        txMeta.collective ||
                        "commonshub"}
                    </Badge>
                  )}
                </td>
                <td
                  className="py-2.5 px-4"
                  onClick={(e) => canEditRows && e.stopPropagation()}
                >
                  {canEditRows && categories.length > 0 ? (
                    <Select
                      value={txMeta.category || "other"}
                      disabled={!tx.transactionUri}
                      onValueChange={(value) => {
                        if (tx.transactionUri) {
                          publish(tx.transactionUri, {
                            tags: { category: value },
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-[120px] h-8 text-xs select-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat: string) => (
                          <SelectItem
                            key={cat}
                            value={cat}
                            className="text-xs"
                          >
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : txMeta.category ? (
                    <Badge variant="outline" className="text-xs">
                      {txMeta.category}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-left">
                  <div className="flex flex-col gap-1">
                    {canEditRows && tx.transactionUri ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <InlineDescriptionEditor
                          value={txMeta.description || ""}
                          onSave={async (value) => {
                            await publish(tx.transactionUri!, {
                              content: value,
                            });
                          }}
                          placeholder="add description"
                        />
                      </div>
                    ) : txMeta.description ? (
                      <div className="text-xs text-left">
                        {txMeta.description}
                      </div>
                    ) : null}
                  </div>
                </td>
                {showAccountColumn && (
                  <td className="py-2.5 px-4">
                    <Badge variant="outline" className="text-xs">
                      {tx.accountName}
                    </Badge>
                  </td>
                )}
              </tr>
              {isExpanded && (
                <tr className="bg-muted/20 border-b">
                  <td
                    colSpan={
                      7 + (isAdmin ? 1 : 0) + (showAccountColumn ? 1 : 0)
                    }
                    className="py-4 px-6"
                  >
                    <ExpandedRowDetails tx={tx} />
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="bg-muted/20 border-t-2 border-gray-300 font-semibold">
          <tr>
            {isAdmin && <td className="py-3 px-4"></td>}
            <td className="py-3 px-4" colSpan={2}>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {totals.count} transaction{totals.count !== 1 ? "s" : ""}
                </span>
              </div>
            </td>
            <td className="py-3 px-4">
              <div className="flex flex-col gap-3">
                {totals.perCurrency.map((row) => {
                  const isEur = row.currency === "EUR";
                  // Fiat currencies use 2 fractional digits; tokens like CHT
                  // are typically integer / few decimals — let toLocaleString
                  // pick within a 0..6 window.
                  const fmt = (n: number) =>
                    n.toLocaleString("en-US", {
                      minimumFractionDigits: isEur ? 2 : 0,
                      maximumFractionDigits: isEur ? 2 : 6,
                    });
                  const symbol = isEur ? "€" : ` ${row.currency}`;
                  const formatSigned = (sign: "+" | "-", n: number) =>
                    isEur
                      ? `${sign}${symbol}${fmt(n)}`
                      : `${sign}${fmt(n)}${symbol}`;
                  return (
                    <div
                      key={row.currency}
                      className="flex flex-col gap-1"
                    >
                      <span className="whitespace-nowrap text-green-600">
                        {formatSigned("+", row.totalIn)}
                      </span>
                      <span className="whitespace-nowrap text-red-600">
                        {formatSigned("-", row.totalOut)}
                      </span>
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <span
                          className={`whitespace-nowrap ${
                            row.net >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatSigned(row.net >= 0 ? "+" : "-", Math.abs(row.net))}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          net
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </td>
            {/* Counterpart, Collective, Category, Description */}
            <td className="py-3 px-4"></td>
            <td className="py-3 px-4"></td>
            <td className="py-3 px-4"></td>
            <td className="py-3 px-4"></td>
            {showAccountColumn && <td className="py-3 px-4"></td>}
          </tr>
        </tfoot>
      </table>
      </div>

      {/* Batch editing footer */}
      {isAdmin && selectedTransactions.size >= 2 && (
        <div className="mt-4 p-4 bg-muted/30 border-t flex items-center gap-4">
          <div className="font-medium">
            {selectedTransactions.size} transactions selected (total{" "}
            <span
              className={
                selectedTotal >= 0 ? "text-green-600" : "text-red-600"
              }
            >
              {selectedTotal >= 0 ? "+" : "-"}
              {(() => {
                const abs = Math.abs(selectedTotal);
                const display = abs.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: tokenDecimals,
                });
                const isEur =
                  tokenSymbol === "EUR" ||
                  tokenSymbol === "EURe" ||
                  tokenSymbol === "EURb";
                return isEur
                  ? `€${display}${tokenSymbol === "EUR" ? "" : ` ${tokenSymbol}`}`
                  : `${display} ${tokenSymbol}`;
              })()}
            </span>
            )
          </div>
          <Select value={batchCollective} onValueChange={setBatchCollective}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Collective" />
            </SelectTrigger>
            <SelectContent>
              {collectives.map((slug) => (
                <SelectItem key={slug} value={slug} className="text-xs">
                  {collectivesObj[slug]?.name || slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={batchCategory} onValueChange={setBatchCategory}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {(selectedTotal >= 0
                ? categoriesObj.credit || ["other"]
                : categoriesObj.debit || ["other"]
              ).map((cat: string) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="text"
            value={batchNote}
            onChange={(e) => setBatchNote(e.target.value)}
            placeholder="note"
            className="text-xs border rounded px-2 py-1 h-8 flex-1 max-w-[200px]"
          />
          <button
            onClick={handleBatchUpdate}
            disabled={
              isBatchUpdating ||
              (!batchCollective && !batchCategory && !batchNote)
            }
            className="text-xs bg-primary text-primary-foreground px-4 py-1 h-8 rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isBatchUpdating ? "Updating..." : "Update"}
          </button>
        </div>
      )}
    </div>
  );
}
