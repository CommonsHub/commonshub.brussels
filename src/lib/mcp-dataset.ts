import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type DatasetName = "transactions" | "contributors" | "events" | "rooms" | "calendars";

type DatasetFileSpec = {
  dataset: DatasetName;
  file: string;
  itemKey?: string;
};

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{2}$/;

const PUBLIC_GENERATED_FILES = new Set([
  "transactions.json",
  "contributors.json",
  "events.json",
  "events.csv",
  "rooms.json",
  "rooms.md",
  "events.md",
  "counterparties.json",
  "images.json",
  "calendars/public.ics",
  "cache/event-og-images.json",
]);

const DATASET_FILES: Record<DatasetName, DatasetFileSpec> = {
  transactions: { dataset: "transactions", file: "transactions.json", itemKey: "transactions" },
  contributors: { dataset: "contributors", file: "contributors.json", itemKey: "contributors" },
  events: { dataset: "events", file: "events.json", itemKey: "events" },
  rooms: { dataset: "rooms", file: "rooms.json", itemKey: "rooms" },
  calendars: { dataset: "calendars", file: "calendars/public.ics" },
};

export function listPublicDatasetFiles(): string[] {
  return Array.from(PUBLIC_GENERATED_FILES).sort();
}

export function listDatasetPeriods() {
  const periods: Array<{ year: string; months: string[] }> = [];
  if (!fs.existsSync(DATA_DIR)) {
    return { dataDir: DATA_DIR, periods, latest: [], generatedFiles: listPublicDatasetFiles() };
  }

  const years = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && YEAR_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  for (const year of years) {
    const yearDir = path.join(DATA_DIR, year);
    const months = fs
      .readdirSync(yearDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && MONTH_RE.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    periods.push({ year, months });
  }

  return {
    dataDir: DATA_DIR,
    periods,
    latest: listExistingGeneratedFiles(path.join(DATA_DIR, "latest", "generated")),
    generatedFiles: listPublicDatasetFiles(),
  };
}

export function listDatasetFiles(input: { year?: string; month?: string; latest?: boolean }) {
  const baseDir = resolveGeneratedDir(input);
  return {
    period: input.latest ? "latest" : [input.year, input.month].filter(Boolean).join("/"),
    files: listExistingGeneratedFiles(baseDir),
    availablePublicFiles: listPublicDatasetFiles(),
  };
}

export function readDatasetFile(input: { year?: string; month?: string; latest?: boolean; file: string }) {
  assertPublicGeneratedFile(input.file);
  const filePath = resolvePublicGeneratedPath(input);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Public dataset file not found: ${input.file}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  if (input.file.endsWith(".json")) {
    return JSON.parse(content) as JsonValue;
  }
  return { file: input.file, content };
}

export function queryDataset(input: {
  dataset: DatasetName;
  year?: string;
  month?: string;
  latest?: boolean;
  limit?: number;
  offset?: number;
}) {
  const spec = DATASET_FILES[input.dataset];
  if (!spec) throw new Error(`Unknown dataset: ${String(input.dataset)}`);
  const data = readDatasetFile({ ...input, file: spec.file });
  const limit = normalizeLimit(input.limit);
  const offset = normalizeOffset(input.offset);

  if (!spec.itemKey) {
    return data;
  }

  const items = extractItems(data, spec.itemKey);
  return {
    dataset: input.dataset,
    total: items.length,
    offset,
    limit,
    items: items.slice(offset, offset + limit),
  };
}

export function summarizeTokens(input: { year?: string; month?: string; latest?: boolean }) {
  const data = readDatasetFile({ ...input, file: "transactions.json" });
  const transactions = extractItems(data, "transactions");
  let minted = 0;
  let burnt = 0;
  let transactionCount = 0;

  for (const tx of transactions) {
    if (!isRecord(tx)) continue;
    const amount = numericAmount(tx);
    if (tx.type === "MINT") {
      minted += amount;
      transactionCount += 1;
    } else if (tx.type === "BURN") {
      burnt += amount;
      transactionCount += 1;
    }
  }

  return { minted, burnt, net: minted - burnt, transactionCount };
}

function resolveGeneratedDir(input: { year?: string; month?: string; latest?: boolean }) {
  if (input.latest) return path.join(DATA_DIR, "latest", "generated");
  const year = requireYear(input.year);
  if (input.month !== undefined) {
    const month = requireMonth(input.month);
    return path.join(DATA_DIR, year, month, "generated");
  }
  return path.join(DATA_DIR, year, "generated");
}

function resolvePublicGeneratedPath(input: { year?: string; month?: string; latest?: boolean; file: string }) {
  assertPublicGeneratedFile(input.file);
  const baseDir = resolveGeneratedDir(input);
  const fullPath = path.resolve(baseDir, input.file);
  const resolvedBase = path.resolve(baseDir);
  if (fullPath !== resolvedBase && !fullPath.startsWith(resolvedBase + path.sep)) {
    throw new Error("Invalid dataset path");
  }
  return fullPath;
}

function requireYear(year: string | undefined) {
  if (!year || !YEAR_RE.test(year)) throw new Error("A four-digit year is required");
  return year;
}

function requireMonth(month: string | undefined) {
  if (!month || !MONTH_RE.test(month)) throw new Error("A two-digit month is required");
  return month;
}

function assertPublicGeneratedFile(file: string) {
  const normalized = file.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized !== file || normalized.includes("..") || normalized.includes("/private/")) {
    throw new Error(`Dataset file is not public: ${file}`);
  }
  if (!PUBLIC_GENERATED_FILES.has(file)) {
    throw new Error(`Dataset file is not public: ${file}`);
  }
}

function listExistingGeneratedFiles(dir: string): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const out: string[] = [];
  const walk = (current: string, prefix: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "private") continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (PUBLIC_GENERATED_FILES.has(rel)) {
        out.push(rel);
      }
    }
  };
  walk(dir, "");
  return out.sort();
}

function extractItems(data: unknown, key: string): JsonValue[] {
  if (isRecord(data)) {
    const value = data[key];
    if (Array.isArray(value)) return value as JsonValue[];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function numericAmount(tx: Record<string, unknown>) {
  const amount = tx.normalizedAmount ?? tx.amount ?? tx.value ?? 0;
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeLimit(limit: number | undefined) {
  if (limit === undefined) return 100;
  if (!Number.isFinite(limit)) return 100;
  return Math.max(1, Math.min(Math.trunc(limit), 500));
}

function normalizeOffset(offset: number | undefined) {
  if (offset === undefined || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset));
}
