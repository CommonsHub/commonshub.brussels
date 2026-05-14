"use client";

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineDescriptionEditor } from "@/components/inline-description-editor";
import { WalletAddress } from "@/components/wallet-address";
import { addressFromUri, chainFromUri, txHashFromUri } from "@/lib/nip73";
import settings from "@/settings/settings.json";
import {
  counterpartyLabel,
  type CounterpartyMetadata,
} from "@/types/counterparties";
import { useNostr } from "@/components/nostr-provider";
import type { EnrichmentEntry } from "@/lib/transactions";

// Module-scoped Intl formatters. Calling `n.toLocaleString(...)` allocates
// a fresh formatter on every invocation, which on a 400-row table balloons
// into thousands of formatter instances per render. Reusing these saves
// significant CPU and memory.
const fmtEur = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtTokenInt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const fmtTokenFrac = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});
const fmtTokenSummary = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});
const fmtDateMD = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const fmtDateYM = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
});
const fmtTimeHM = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});
const fmtDateGB = new Intl.DateTimeFormat("en-GB");
const fmtTimeGBHM = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

interface TransactionMetadata {
  collective: string;
  project: string | null;
  event: string | null;
  category: string;
  tags: string[];
  description: string;
}

// Sentinel value used wherever a collective is missing (no chb metadata
// and no nostr annotation). Rendered as the "Unassigned" bucket in
// summary cards and the filter dropdown. Can't be the empty string
// because Radix Select rejects empty SelectItem values.
const UNASSIGNED_COLLECTIVE = "__unassigned__";

const DEFAULT_TX_META: TransactionMetadata = {
  collective: UNASSIGNED_COLLECTIVE,
  project: null,
  event: null,
  category: "other",
  tags: [],
  description: "",
};

// Shared empty-array singleton so memoized rows whose category list is
// empty don't see a fresh reference on every render.
const EMPTY_CATEGORIES: string[] = [];

interface EnrichedTransaction {
  // Core display fields (TokenTransfer-shaped legacy contract).
  hash?: string;
  timeStamp: string;
  from?: string;
  to?: string;
  value: string;
  transactionId: string;
  /** NIP-73 URI of the account this row affects. Combined with
   *  transactionId, this disambiguates the two rows that an INTERNAL
   *  transfer emits (one per side). */
  accountId?: string;
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

// LazySelect renders a button that looks like a Radix SelectTrigger until
// the user clicks it. Only then does it mount a real `<Select>` (with
// `defaultOpen` so it pops open immediately). When the popover closes the
// Select unmounts again. This cuts ~800 Radix Select instances down to "0
// or 1 currently being interacted with" on a 400-row table.
interface LazySelectOption {
  value: string;
  label: string;
}

const LazySelect = memo(function LazySelect({
  value,
  label,
  options,
  disabled,
  className = "w-[140px] h-8 text-xs",
  onChange,
}: {
  value: string;
  label: string;
  options: LazySelectOption[];
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  const [active, setActive] = useState(false);

  if (!active) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setActive(true);
        }}
        className={`select-trigger flex items-center justify-between gap-1 rounded-md border border-input bg-background px-3 ${className} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
      </button>
    );
  }

  return (
    <Select
      defaultOpen
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        onChange(v);
        setActive(false);
      }}
      onOpenChange={(open) => {
        if (!open) setActive(false);
      }}
    >
      <SelectTrigger className={`${className} select-trigger`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

// Row component. Memoized so a filter keystroke (which churns
// `filteredTransactions`) only re-renders rows whose props actually
// changed. The shallow-equality default is sufficient since all incoming
// props are primitives or stable references.
interface TransactionRowProps {
  tx: EnrichedTransaction;
  txMeta: TransactionMetadata;
  cpMeta: CounterpartyMetadata | undefined;
  isIncoming: boolean;
  isAdmin: boolean;
  canEditRows: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  chain: string;
  tokenSymbol: string;
  tokenDecimals: number;
  showAccountColumn: boolean;
  categories: string[];
  collectiveOptions: LazySelectOption[];
  enrichment?: EnrichmentEntry;
  onToggleSelect: (txId: string) => void;
  onToggleExpand: (txId: string) => void;
  onPublishCollective: (uri: string, value: string) => void;
  onPublishCategory: (uri: string, value: string) => void;
  onPublishDescription: (uri: string, value: string) => Promise<void>;
  onPublishCounterpartyName: (uri: string, value: string) => Promise<void>;
}

const TransactionRow = memo(function TransactionRow({
  tx,
  txMeta,
  cpMeta,
  isIncoming,
  isAdmin,
  canEditRows,
  isSelected,
  isExpanded,
  chain,
  tokenSymbol,
  tokenDecimals,
  showAccountColumn,
  categories,
  collectiveOptions,
  enrichment,
  onToggleSelect,
  onToggleExpand,
  onPublishCollective,
  onPublishCategory,
  onPublishDescription,
  onPublishCounterpartyName,
}: TransactionRowProps) {
  const timestamp = tx.timestamp ?? parseInt(tx.timeStamp || "0");
  const date = new Date(timestamp * 1000);
  const dateStr = fmtDateMD.format(date);
  const timeStr = fmtTimeHM.format(date);

  const txHref = txExplorerUrl(tx, chain);

  const cpName = counterpartyLabel(cpMeta);
  const cpAddr = addressFromUri(tx.counterpartyId);
  const cpExplorer = counterpartExplorerUrl(tx, chain);
  const cpEditable = canEditRows && !!tx.counterpartyId;

  const hasGross = typeof tx.grossAmount === "number";
  const hasNet = typeof tx.netAmount === "number";
  const grossVal = hasGross ? tx.grossAmount : undefined;
  const netVal = hasNet ? tx.netAmount : undefined;
  const showNet = hasGross && hasNet && tx.grossAmount !== tx.netAmount;
  const gross = formatRowAmount(tx, tokenSymbol, tokenDecimals, grossVal);
  const net = showNet
    ? formatRowAmount(tx, tokenSymbol, tokenDecimals, netVal)
    : null;

  const collectiveValue = txMeta.collective || UNASSIGNED_COLLECTIVE;
  const collectiveLabel =
    collectiveValue === UNASSIGNED_COLLECTIVE
      ? "Unassigned"
      : (collectiveOptions.find((o) => o.value === collectiveValue)?.label ??
        collectiveValue);
  const categoryValue = txMeta.category || "other";

  return (
    <Fragment>
      <tr
        className={`hover:bg-muted/20 transition-colors text-sm ${
          isSelected ? "bg-muted/30" : ""
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
          if (canEditRows) onToggleExpand(tx.transactionId);
        }}
        style={{ cursor: canEditRows ? "pointer" : "default" }}
      >
        {canEditRows && (
          <td className="py-2.5 px-4">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(tx.transactionId)}
              className="cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
          </td>
        )}
        <td className="py-2.5 px-4">
          <div className="flex items-start gap-1.5">
            <div>
              <div className="font-medium">{dateStr}</div>
              <div className="text-xs text-muted-foreground">{timeStr}</div>
            </div>
            {txHref && (
              <a
                href={txHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 text-muted-foreground hover:text-foreground"
                title="View transaction on block explorer"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
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
            <div className="text-xs text-muted-foreground">{gross.suffix}</div>
          ) : null}
        </td>
        <td className="py-2.5 px-4">
          {cpName ? (
            <div className="flex items-center gap-1.5">
              {cpEditable ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <InlineDescriptionEditor
                    value={cpName}
                    className="font-medium"
                    placeholder="add label"
                    onSave={(v) =>
                      onPublishCounterpartyName(tx.counterpartyId!, v)
                    }
                  />
                </div>
              ) : (
                <div className="font-medium">{cpName}</div>
              )}
              {cpExplorer && (
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
              )}
            </div>
          ) : tx.provider === "stripe" ? (
            cpEditable ? (
              <div className="flex items-center gap-1.5">
                <div onClick={(e) => e.stopPropagation()}>
                  <InlineDescriptionEditor
                    value=""
                    className="font-medium"
                    placeholder="add label"
                    onSave={(v) =>
                      onPublishCounterpartyName(tx.counterpartyId!, v)
                    }
                  />
                </div>
                {cpExplorer && (
                  <a
                    href={cpExplorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground"
                    title="Open in Stripe"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">—</div>
            )
          ) : cpAddr ? (
            <div className="flex flex-col gap-1">
              <WalletAddress
                address={cpAddr}
                chain={tx.chain || chain}
                showLink={true}
                showCopy={true}
              />
              {cpEditable && (
                <div onClick={(e) => e.stopPropagation()}>
                  <InlineDescriptionEditor
                    value=""
                    className="font-medium"
                    placeholder="add label"
                    onSave={(v) =>
                      onPublishCounterpartyName(tx.counterpartyId!, v)
                    }
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">—</div>
          )}
        </td>
        <td
          className="py-2.5 px-4"
          onClick={(e) => canEditRows && e.stopPropagation()}
        >
          {canEditRows ? (
            <LazySelect
              value={collectiveValue}
              label={collectiveLabel}
              options={collectiveOptions}
              disabled={!tx.transactionUri}
              className="w-[140px] h-8 text-xs"
              onChange={(v) => {
                if (tx.transactionUri) onPublishCollective(tx.transactionUri, v);
              }}
            />
          ) : (
            <Badge variant="outline" className="text-xs">
              {collectiveLabel}
            </Badge>
          )}
        </td>
        <td
          className="py-2.5 px-4"
          onClick={(e) => canEditRows && e.stopPropagation()}
        >
          {canEditRows && categories.length > 0 ? (
            <LazySelect
              value={categoryValue}
              label={categoryValue}
              options={categories.map((c) => ({ value: c, label: c }))}
              disabled={!tx.transactionUri}
              className="w-[120px] h-8 text-xs"
              onChange={(v) => {
                if (tx.transactionUri) onPublishCategory(tx.transactionUri, v);
              }}
            />
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
                  onSave={(v) => onPublishDescription(tx.transactionUri!, v)}
                  placeholder="add description"
                />
              </div>
            ) : txMeta.description ? (
              <div className="text-xs text-left">{txMeta.description}</div>
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
            colSpan={7 + (canEditRows ? 1 : 0) + (showAccountColumn ? 1 : 0)}
            className="py-4 px-6"
          >
            <ExpandedRowDetails tx={tx} enrichment={enrichment} />
          </td>
        </tr>
      )}
    </Fragment>
  );
});

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
  /** Private per-tx enrichment data (e.g., Monerium bank-sender names +
   *  IBANs), keyed by NIP-73 tx URI. Server pages should only forward
   *  this when the viewer has admin/member role — it contains PII. */
  enrichments?: Record<string, EnrichmentEntry>;
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
      formatted = fmtEur.format(abs);
    } else {
      formatted = (Number.isInteger(abs) ? fmtTokenInt : fmtTokenFrac).format(
        abs
      );
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
  const fmt = (d: number) => fmtDateMD.format(new Date(year, month - 1, d));
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
 * Build an explorer/dashboard URL for one of the row's identifiers.
 * Handles the chb-side stripe: prefix and turns the bare provider ids
 * (cus_…, txn_…, charge…) into deep-links into the right Stripe account.
 * Returns null when no useful link can be built for this id.
 */
function identifierLink(
  field: "id" | "accountId" | "counterpartyId" | "providerId",
  value: string,
  ctx: { acct: string | null; chain: string | null }
): string | null {
  // Stripe identifiers (with or without the chb-side `stripe:` prefix).
  const stripeId = value.startsWith("stripe:")
    ? value.slice("stripe:".length)
    : value;
  if (stripeId.startsWith("acct_")) {
    return `https://dashboard.stripe.com/${stripeId}`;
  }
  if (ctx.acct) {
    if (stripeId.startsWith("cus_")) {
      return `https://dashboard.stripe.com/${ctx.acct}/customers/${stripeId}`;
    }
    if (stripeId.startsWith("txn_") || stripeId.startsWith("ch_")) {
      return `https://dashboard.stripe.com/${ctx.acct}/search?query=${stripeId}`;
    }
  }
  // Ethereum tx URI → block-explorer tx page.
  if (value.startsWith("ethereum:")) {
    const chain = chainFromUri(value) ?? ctx.chain ?? null;
    const base = chain ? CHAIN_EXPLORERS[chain] : undefined;
    const hash = txHashFromUri(value);
    if (base && hash && (value.includes(":tx:") || value.includes(":txn:"))) {
      return `${base}/tx/${hash}`;
    }
    const addr = addressFromUri(value);
    if (base && addr) return `${base}/address/${addr}`;
  }
  return null;
}

/** Render one dt/dd row inside an auto-width grid. */
function DetailRow({
  k,
  children,
}: {
  k: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground whitespace-nowrap pr-2">{k}</dt>
      <dd className="break-all">{children}</dd>
    </>
  );
}

/**
 * Reveal panel shown below a row when a member clicks on it.
 * Surfaces the raw chb tags + metadata + identifiers from
 * generated/transactions.json — useful for spot-checking what the
 * pipeline actually wrote for a given row. Identifiers are turned into
 * deep-links into the relevant dashboard/explorer when possible. The
 * Enrichment section is only populated when the parent passes the
 * private map (admin/member only).
 */
function ExpandedRowDetails({
  tx,
  enrichment,
}: {
  tx: EnrichedTransaction;
  enrichment?: EnrichmentEntry;
}) {
  const rows = tx as unknown as Record<string, unknown>;
  const rawTags = Array.isArray(rows.tags) ? (rows.tags as unknown[][]) : [];
  const metadata = (rows.metadata as Record<string, unknown> | undefined) ?? {};

  // Extract the Stripe account id (acct_…) once so cus_/txn_/ch_ ids on
  // this row can be deep-linked into the same account dashboard.
  const accountIdRaw = (rows.accountId as string | undefined) ?? null;
  const stripeAcct = accountIdRaw?.startsWith("stripe:acct_")
    ? accountIdRaw.slice("stripe:".length)
    : accountIdRaw?.startsWith("acct_")
      ? accountIdRaw
      : null;
  const linkCtx = { acct: stripeAcct, chain: tx.chain ?? null };

  const idFields: Array<["id" | "accountId" | "counterpartyId" | "providerId", string | null]> = [
    ["id", tx.transactionId],
    ["accountId", accountIdRaw],
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

  const enrichmentEntries = enrichment
    ? Object.entries(enrichment).filter(
        ([, v]) => v !== null && v !== undefined && v !== ""
      )
    : [];

  return (
    <div className="grid gap-x-8 gap-y-4 text-xs md:grid-cols-3">
      <section className="min-w-0">
        <h4 className="font-semibold text-foreground mb-2">Identifiers</h4>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono">
          {idFields.map(([k, v]) => (
            <DetailRow key={k} k={k}>
              {v ? (
                (() => {
                  const href = identifierLink(k, v, linkCtx);
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <span className="break-all">{v}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                    </a>
                  ) : (
                    <span className="break-all">{v}</span>
                  );
                })()
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
          ))}
        </dl>
        {enrichmentEntries.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold text-foreground mb-2">Enrichment</h4>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono">
              {enrichmentEntries.map(([k, v]) => (
                <DetailRow key={k} k={k}>
                  {typeof v === "object"
                    ? JSON.stringify(v)
                    : String(v)}
                </DetailRow>
              ))}
            </dl>
          </div>
        )}
      </section>
      <section className="min-w-0">
        <h4 className="font-semibold text-foreground mb-2">Fields</h4>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono">
          {numericFields.map(([k, v]) => (
            <DetailRow key={k} k={k}>
              {v === null || v === undefined || v === "" ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                String(v)
              )}
            </DetailRow>
          ))}
        </dl>
      </section>
      <section className="min-w-0 space-y-4">
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
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono">
              {Object.entries(metadata).map(([k, v]) => (
                <DetailRow key={k} k={k}>
                  {String(v ?? "")}
                </DetailRow>
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

  const formattedNumber = fmtEur.format(euros);

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
  enrichments,
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

  // Pre-compute merged (baseline + nostr annotation) metadata for every
  // tx in one pass. Used to be called inline per row × per render, which
  // on a 400-row page meant 800+ object allocations on every keystroke.
  // Now we recompute only when transactions or annotations change.
  const txMetaMap = useMemo(() => {
    const map = new Map<string, TransactionMetadata>();
    for (const tx of transactions) {
      if (!tx.transactionUri) continue;
      const baseline = tx.transactionMetadata ?? DEFAULT_TX_META;
      const ann = getAnnotation(tx.transactionUri);
      map.set(
        tx.transactionUri,
        ann
          ? {
              ...baseline,
              collective: ann.tagMap.collective ?? baseline.collective,
              category: ann.tagMap.category ?? baseline.category,
              description: ann.content || baseline.description,
            }
          : baseline
      );
    }
    return map;
  }, [transactions, getAnnotation]);

  const cpMetaMap = useMemo(() => {
    const map = new Map<string, CounterpartyMetadata>();
    for (const tx of transactions) {
      if (!tx.counterpartyId) continue;
      const baseline = tx.counterpartyMetadata;
      const ann = getAnnotation(tx.counterpartyId);
      if (!ann && !baseline) continue;
      map.set(
        tx.counterpartyId,
        ann
          ? ({ ...(baseline ?? {}), ...ann.tagMap } as CounterpartyMetadata)
          : (baseline as CounterpartyMetadata)
      );
    }
    return map;
  }, [transactions, getAnnotation]);

  const getTxMeta = useCallback(
    (tx: EnrichedTransaction): TransactionMetadata =>
      (tx.transactionUri && txMetaMap.get(tx.transactionUri)) ||
      tx.transactionMetadata ||
      DEFAULT_TX_META,
    [txMetaMap]
  );

  const getCpMeta = useCallback(
    (tx: EnrichedTransaction): CounterpartyMetadata | undefined =>
      (tx.counterpartyId && cpMetaMap.get(tx.counterpartyId)) ||
      tx.counterpartyMetadata,
    [cpMetaMap]
  );

  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(
    new Set()
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleExpanded = useCallback((txId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  }, []);
  const [batchCollective, setBatchCollective] = useState("");
  const [batchCategory, setBatchCategory] = useState("");
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [counterpartFilter, setCounterpartFilter] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [collectiveFilter, setCollectiveFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [descriptionFilter, setDescriptionFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  // Pagination — page is 1-indexed in the URL. The filter aggregates
  // (totals, summary cards, dropdown counts) always reflect *all*
  // filtered rows; only the rendered <tbody> uses the paged slice.
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(20);

  // Initialize filters from URL on mount
  useEffect(() => {
    const counterpart = searchParams.get("counterpart");
    const min = searchParams.get("minAmount");
    const max = searchParams.get("maxAmount");
    const collective = searchParams.get("collective");
    const category = searchParams.get("category");
    const description = searchParams.get("description");
    const type = searchParams.get("type");
    const month = searchParams.get("month");
    const week = searchParams.get("week");
    const account = searchParams.get("account");
    const pageParam = searchParams.get("page");
    const perPageParam = searchParams.get("perPage");

    if (counterpart) setCounterpartFilter(counterpart);
    if (min) setMinAmount(min);
    if (max) setMaxAmount(max);
    if (collective) setCollectiveFilter(collective);
    if (category) setCategoryFilter(category);
    if (description) setDescriptionFilter(description);
    if (type) setTypeFilter(type);
    if (month) setMonthFilter(month);
    if (week) setWeekFilter(week);
    if (account) setAccountFilter(account);
    if (pageParam) {
      const p = parseInt(pageParam, 10);
      if (Number.isFinite(p) && p >= 1) setPage(p);
    }
    if (perPageParam) {
      const pp = parseInt(perPageParam, 10);
      if (pp === 20 || pp === 50 || pp === 100) setPerPage(pp);
    }
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

    if (descriptionFilter) {
      params.set("description", descriptionFilter);
    } else {
      params.delete("description");
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

    // Pagination: leave defaults out of the URL so the cleanest URL is
    // also the canonical one (?page=1&perPage=20 == no params).
    if (page !== 1) params.set("page", String(page));
    else params.delete("page");
    if (perPage !== 20) params.set("perPage", String(perPage));
    else params.delete("perPage");

    const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
    router.replace(newUrl, { scroll: false });
  }, [
    counterpartFilter,
    minAmount,
    maxAmount,
    collectiveFilter,
    categoryFilter,
    descriptionFilter,
    typeFilter,
    monthFilter,
    weekFilter,
    accountFilter,
    page,
    perPage,
    router,
  ]);

  // Reset to page 1 whenever a filter changes. Otherwise a user paging
  // through unfiltered results who then applies a filter that yields
  // fewer pages would land on an out-of-range page and see nothing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1);
  }, [
    counterpartFilter,
    minAmount,
    maxAmount,
    collectiveFilter,
    categoryFilter,
    descriptionFilter,
    typeFilter,
    monthFilter,
    weekFilter,
    accountFilter,
    perPage,
  ]);

  // Get collectives and categories from settings
  const collectivesObj = (settings.finance as any).collectives || {};
  const collectives = Object.keys(collectivesObj);
  const categoriesObj = (settings.finance as any).categories || {};

  // Stable options array for the collective LazySelect — recomputed only
  // when settings change (i.e. never at runtime).
  const collectiveOptions = useMemo<LazySelectOption[]>(
    () =>
      collectives.map((slug) => ({
        value: slug,
        label: collectivesObj[slug]?.name || slug,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Stable per-row callbacks. Without these, every render re-creates the
  // arrow functions passed to the memoized row, defeating React.memo.
  const onPublishCollective = useCallback(
    (uri: string, value: string) => {
      publish(uri, { tags: { collective: value } });
    },
    [publish]
  );
  const onPublishCategory = useCallback(
    (uri: string, value: string) => {
      publish(uri, { tags: { category: value } });
    },
    [publish]
  );
  const onPublishDescription = useCallback(
    async (uri: string, value: string) => {
      await publish(uri, { content: value });
    },
    [publish]
  );
  const onPublishCounterpartyName = useCallback(
    async (uri: string, value: string) => {
      await publish(uri, { tags: { name: value } });
    },
    [publish]
  );

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
    if (tx.rawType === "INTERNAL") return EMPTY_CATEGORIES;
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
      months.add(fmtDateYM.format(date));
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
      const monthYear = fmtDateYM.format(date);
      const txCounterpart = counterpartLabelForTx(tx);
      const meta = getTxMeta(tx);
      const txCollective = meta.collective || UNASSIGNED_COLLECTIVE;
      const txCategory = meta.category || "other";
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
        // Description has no dropdown of its own — always apply it.
        if (descriptionFilter) {
          const desc = meta.description || "";
          if (!desc.toLowerCase().includes(descriptionFilter.toLowerCase()))
            return false;
        }
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
    descriptionFilter,
    typeFilter,
    monthFilter,
    accountFilter,
    tokenDecimals,
    accountAddress,
    useNormalizedAmount,
    getTxMeta,
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
        const meta = getTxMeta(tx);
        const txCollective = meta.collective || UNASSIGNED_COLLECTIVE;
        if (txCollective !== collectiveFilter) return false;
      }

      // Filter by category
      if (categoryFilter !== "all") {
        const txCategory = getTxMeta(tx).category || "other";
        if (txCategory !== categoryFilter) return false;
      }

      // Filter by description (case-insensitive substring match).
      if (descriptionFilter) {
        const desc = getTxMeta(tx).description || "";
        if (!desc.toLowerCase().includes(descriptionFilter.toLowerCase()))
          return false;
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
        if (fmtDateYM.format(date) !== monthFilter) return false;
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
    descriptionFilter,
    typeFilter,
    monthFilter,
    weekFilter,
    accountFilter,
    tokenDecimals,
    accountAddress,
    useNormalizedAmount,
    viewScope,
    getTxMeta,
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

  // Pagination — totals above already use the *unpaginated* filtered
  // array, so summary cards/footer always reflect all matching rows.
  // Only the rendered tbody iterates `pagedTransactions`.
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / perPage)
  );
  const clampedPage = Math.min(page, totalPages);
  const pagedTransactions = useMemo(
    () =>
      filteredTransactions.slice(
        (clampedPage - 1) * perPage,
        clampedPage * perPage
      ),
    [filteredTransactions, clampedPage, perPage]
  );

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
      const meta = getTxMeta(tx);
      const collective = meta.collective || UNASSIGNED_COLLECTIVE;
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
        // commonshub first, Unassigned last, the rest alphabetical.
        if (a.collective === "commonshub") return -1;
        if (b.collective === "commonshub") return 1;
        if (a.collective === UNASSIGNED_COLLECTIVE) return 1;
        if (b.collective === UNASSIGNED_COLLECTIVE) return -1;
        return a.collective.localeCompare(b.collective);
      });
  }, [transactions, useNormalizedAmount, accountAddress, tokenSymbol, getTxMeta]);

  const toggleTransaction = useCallback((txId: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  }, []);

  // Header checkbox toggles the current page only (Gmail-style). If the
  // user wants every matching row across pages they click the "select all
  // N matching" link in the selection banner.
  const togglePage = () => {
    const pageIds = pagedTransactions.map((tx) => tx.transactionId);
    const allPageSelected = pageIds.every((id) =>
      selectedTransactions.has(id)
    );
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedTransactions(
      new Set(filteredTransactions.map((tx) => tx.transactionId))
    );
  };

  const clearSelection = () => setSelectedTransactions(new Set());

  const handleBatchUpdate = async () => {
    if (selectedTransactions.size < 1) return;
    if (!batchCollective && !batchCategory) return;

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
          publish(tx.transactionUri!, { tags: tagPatch })
        )
      );
      setBatchDialogOpen(false);
      setBatchCollective("");
      setBatchCategory("");
      clearSelection();
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
      const dateStr = fmtDateGB.format(date);
      const timeStr = fmtTimeGBHM.format(date);
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

      const txMeta = getTxMeta(tx);
      const cpMeta = getCpMeta(tx);
      const collective =
        txMeta.collective === UNASSIGNED_COLLECTIVE || !txMeta.collective
          ? "unassigned"
          : txMeta.collective;
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
    const display = (isEur ? fmtEur : fmtTokenSummary).format(n);
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
              c.collective === UNASSIGNED_COLLECTIVE
                ? "Unassigned"
                : collectivesObj[c.collective]?.name || c.collective;
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
            {canEditRows && (
              <th className="text-left py-2 px-4 font-medium w-8">
                <input
                  type="checkbox"
                  checked={
                    pagedTransactions.length > 0 &&
                    pagedTransactions.every((tx) =>
                      selectedTransactions.has(tx.transactionId)
                    )
                  }
                  onChange={togglePage}
                  className="cursor-pointer"
                  title="Select this page"
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
            {canEditRows && <th className="py-2 px-4"></th>}
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
                  <SelectItem
                    value={UNASSIGNED_COLLECTIVE}
                    className="text-xs"
                  >
                    Unassigned (
                    {filterCounts.collectives.get(UNASSIGNED_COLLECTIVE) || 0})
                  </SelectItem>
                </SelectContent>
              </Select>
            </th>
            <th className="py-2 px-4">
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
            <th className="py-2 px-4">
              <Input
                type="text"
                placeholder="Description"
                value={descriptionFilter}
                onChange={(e) => setDescriptionFilter(e.target.value)}
                className="h-7 text-xs w-full"
              />
            </th>
            {showAccountColumn && (
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
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {pagedTransactions.map((tx) => {
            const isIncoming = useNormalizedAmount
              ? tx.type === "CREDIT"
              : tx.to?.toLowerCase() === accountAddress?.toLowerCase();
            // `transactionId` alone isn't unique: an INTERNAL transfer
            // emits two rows that share the same on-chain tx URI (one
            // per side). Combining with accountId disambiguates them.
            const rowKey = `${tx.transactionId}#${tx.accountId ?? ""}`;
            return (
              <TransactionRow
                key={rowKey}
                tx={tx}
                txMeta={getTxMeta(tx)}
                cpMeta={getCpMeta(tx)}
                isIncoming={isIncoming}
                isAdmin={isAdmin}
                canEditRows={canEditRows}
                isSelected={selectedTransactions.has(tx.transactionId)}
                isExpanded={expandedRows.has(tx.transactionId)}
                chain={chain}
                tokenSymbol={tokenSymbol}
                tokenDecimals={tokenDecimals}
                showAccountColumn={showAccountColumn}
                categories={categoriesForTx(tx)}
                collectiveOptions={collectiveOptions}
                enrichment={enrichments?.[tx.transactionId]}
                onToggleSelect={toggleTransaction}
                onToggleExpand={toggleExpanded}
                onPublishCollective={onPublishCollective}
                onPublishCategory={onPublishCategory}
                onPublishDescription={onPublishDescription}
                onPublishCounterpartyName={onPublishCounterpartyName}
              />
            );
          })}
        </tbody>
        <tfoot className="bg-muted/20 border-t-2 border-gray-300 font-semibold">
          <tr>
            {canEditRows && <td className="py-3 px-4"></td>}
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
                  const fmt = (n: number) =>
                    (isEur ? fmtEur : fmtTokenSummary).format(n);
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

      {/* Pagination controls */}
      {filteredTransactions.length > 0 && (
        <div className="mt-4 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-muted-foreground">
            {(() => {
              const start = (clampedPage - 1) * perPage + 1;
              const end = Math.min(
                clampedPage * perPage,
                filteredTransactions.length
              );
              return `${start}–${end} of ${filteredTransactions.length}`;
            })()}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Per page</span>
              <Select
                value={String(perPage)}
                onValueChange={(v) => setPerPage(parseInt(v, 10))}
              >
                <SelectTrigger className="h-7 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20" className="text-xs">20</SelectItem>
                  <SelectItem value="50" className="text-xs">50</SelectItem>
                  <SelectItem value="100" className="text-xs">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => setPage(1)}
                disabled={clampedPage <= 1}
              >
                «
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={clampedPage <= 1}
              >
                ‹
              </Button>
              <span className="px-2 whitespace-nowrap">
                Page {clampedPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={clampedPage >= totalPages}
              >
                ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => setPage(totalPages)}
                disabled={clampedPage >= totalPages}
              >
                »
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selection banner — appears whenever ≥1 row is checked. */}
      {canEditRows && selectedTransactions.size > 0 && (
        <div className="mt-4 px-4 py-2 bg-muted/30 border-y flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium">
              {selectedTransactions.size} selected
            </span>
            {selectedTransactions.size < filteredTransactions.length && (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-primary hover:underline"
              >
                Select all {filteredTransactions.length} matching
              </button>
            )}
            <button
              type="button"
              onClick={clearSelection}
              className="text-muted-foreground hover:underline"
            >
              Clear
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => setBatchDialogOpen(true)}
          >
            Edit selected…
          </Button>
        </div>
      )}

      {/* Bulk edit modal */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit {selectedTransactions.size} transaction
              {selectedTransactions.size !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Set a collective and/or category. Empty fields leave the
              existing value unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">
                Collective
              </label>
              <Select
                value={batchCollective}
                onValueChange={setBatchCollective}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  {collectives.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {collectivesObj[slug]?.name || slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">
                Category
              </label>
              <Select
                value={batchCategory}
                onValueChange={setBatchCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchDialogOpen(false)}
              disabled={isBatchUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBatchUpdate}
              disabled={
                isBatchUpdating || (!batchCollective && !batchCategory)
              }
            >
              {isBatchUpdating
                ? "Updating…"
                : `Update ${selectedTransactions.size} row${selectedTransactions.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
