/**
 * The debt token ledger.
 *
 * Commons Hub issues interest-free debt tokens: people and companies lend the
 * hub money (or work, or rent) and hold a token they can redeem later against
 * the space and what the community offers. MINT issues debt, BURN settles it.
 *
 * The book of record is a Google Sheet the stewards keep by hand, so this
 * module reads it straight from the sheet's CSV export once a day rather than
 * copying the numbers into the repo where they would quietly go stale. Every
 * figure shown on the site is recomputed here from the transaction amounts —
 * the sheet's own running-balance column is rounded in places and is not used.
 */


/** The sheet, and the tab within it, that holds the ledger. */
export const DEBT_SHEET_ID = "1FG1a11UdJP6GpV8n3J1xEiYxmulHgcR3AOHudjkw4Q4";
const DEBT_SHEET_GID = "0";

export const DEBT_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEBT_SHEET_ID}/edit?gid=${DEBT_SHEET_GID}`;
export const DEBT_CSV_URL = `https://docs.google.com/spreadsheets/d/${DEBT_SHEET_ID}/export?format=csv&gid=${DEBT_SHEET_GID}`;

/** Once a day is plenty: the ledger moves a few times a month at most. */
export const DEBT_REVALIDATE_SECONDS = 86_400;

export interface DebtTransaction {
  /** ISO date, so sorting and formatting are unambiguous. */
  date: string;
  type: "MINT" | "BURN";
  name: string;
  /** Positive for a mint, negative for a burn. */
  amount: number;
  /** Recomputed here, per holder, in date order — never read from the sheet. */
  balance: number;
  comment: string;
  /** On-chain record of the transaction, when there is one. */
  txUrl: string | null;
  /** Where the decision behind it was taken (Discord, a document). */
  referenceUrl: string | null;
}

export interface DebtHolder {
  name: string;
  firstAt: string;
  lastAt: string;
  minted: number;
  burned: number;
  balance: number;
  transactions: number;
}

export interface DebtLedger {
  transactions: DebtTransaction[];
  holders: DebtHolder[];
  totals: {
    outstanding: number;
    minted: number;
    burned: number;
    holders: number;
    settledHolders: number;
    firstAt: string | null;
    lastAt: string | null;
  };
  /** When the sheet was last read successfully. */
  fetchedAt: string;
  /** True when the live sheet could not be reached and this is the last copy. */
  stale: boolean;
}

// ── parsing ────────────────────────────────────────────────────────────────

/** RFC4180-ish: quoted fields may hold commas, newlines and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * "10 000 €", "2 416,11 €", "-896 €" → a number. The sheet uses non-breaking
 * spaces for thousands and a comma for the decimal, both of which have to go
 * before Number() will look at it.
 */
export function parseAmount(raw: string): number {
  const cleaned = raw
    .replace(/[\s  ]/g, "")
    .replace(/€/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/** "16/05/2024" and "6/6/2024" are both day-first. Returns an ISO date. */
export function parseDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const firstUrl = (...cells: Array<string | undefined>): string | null => {
  for (const cell of cells) {
    const match = cell?.match(/https?:\/\/\S+/);
    if (match) return match[0];
  }
  return null;
};

/**
 * Turn the sheet's CSV into a ledger. Pure, so the arithmetic can be tested
 * without reaching for the network.
 */
export function parseLedger(csv: string, fetchedAt: string, stale = false): DebtLedger {
  const rows = parseCsv(csv);
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (name: string) => header.indexOf(name);

  const iDate = col("date");
  const iType = col("type");
  const iName = col("name");
  const iAmount = col("amount");
  const iComment = col("comment");
  // The reference link lands in whichever of these columns had room that day,
  // so all three are searched rather than trusting one position.
  const iVat = col("vat");
  const iLink = col("link");
  const iTx = col("tx hash");

  const parsed = rows
    .slice(1)
    .map((row) => {
      const date = parseDate(row[iDate] ?? "");
      const name = (row[iName] ?? "").trim();
      const type = (row[iType] ?? "").trim().toUpperCase();
      if (!date || !name || (type !== "MINT" && type !== "BURN")) return null;

      const amount = parseAmount(row[iAmount] ?? "");
      // A burn settles debt whichever way the sheet wrote the sign.
      const signed = type === "BURN" ? -Math.abs(amount) : Math.abs(amount);

      const links = [row[iVat], row[iLink], row[iTx]];
      const txUrl = firstUrl(...links.filter((c) => c?.includes("txinfo.xyz")));
      const referenceUrl = firstUrl(...links.filter((c) => !c?.includes("txinfo.xyz")));

      return {
        date,
        type: type as "MINT" | "BURN",
        name,
        amount: signed,
        balance: 0,
        comment: (row[iComment] ?? "").trim(),
        txUrl,
        referenceUrl,
      };
    })
    .filter((t): t is DebtTransaction => t !== null)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  // Running balance per holder, in date order.
  const running = new Map<string, number>();
  for (const transaction of parsed) {
    const next = round((running.get(transaction.name) ?? 0) + transaction.amount);
    running.set(transaction.name, next);
    transaction.balance = next;
  }

  const byHolder = new Map<string, DebtHolder>();
  for (const transaction of parsed) {
    const holder = byHolder.get(transaction.name) ?? {
      name: transaction.name,
      firstAt: transaction.date,
      lastAt: transaction.date,
      minted: 0,
      burned: 0,
      balance: 0,
      transactions: 0,
    };
    holder.lastAt = transaction.date;
    if (transaction.amount >= 0) holder.minted = round(holder.minted + transaction.amount);
    else holder.burned = round(holder.burned - transaction.amount);
    holder.balance = round(holder.balance + transaction.amount);
    holder.transactions += 1;
    byHolder.set(transaction.name, holder);
  }

  const holders = [...byHolder.values()].sort(
    (a, b) => b.balance - a.balance || a.name.localeCompare(b.name),
  );

  const minted = round(holders.reduce((sum, h) => sum + h.minted, 0));
  const burned = round(holders.reduce((sum, h) => sum + h.burned, 0));

  return {
    transactions: parsed,
    holders,
    totals: {
      // Outstanding is minted minus burned by construction, so the summary
      // and the per-holder table can never disagree.
      outstanding: round(minted - burned),
      minted,
      burned,
      holders: holders.filter((h) => h.balance > 0).length,
      settledHolders: holders.filter((h) => h.balance <= 0).length,
      firstAt: parsed[0]?.date ?? null,
      lastAt: parsed[parsed.length - 1]?.date ?? null,
    },
    fetchedAt,
    stale,
  };
}

/** Cents, not floats: 2 416,11 + 74,60 must stay exact. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── reading the sheet ──────────────────────────────────────────────────────

/**
 * The last ledger this process read. The site writes nothing to disk — the
 * daily fetch cache does the real caching — but holding the last good copy in
 * memory means a Google outage shows yesterday's figures with a note instead
 * of an error page.
 */
let lastGood: DebtLedger | null = null;

/** Read the ledger. The sheet is fetched at most once a day. */
export async function loadDebtLedger(): Promise<DebtLedger> {
  try {
    const response = await fetch(DEBT_CSV_URL, {
      next: { revalidate: DEBT_REVALIDATE_SECONDS },
      headers: { "User-Agent": "commonshub.brussels" },
    });
    if (!response.ok) throw new Error(`sheet responded ${response.status}`);
    const csv = await response.text();
    if (!csv.toLowerCase().includes("running balance")) {
      throw new Error("that does not look like the ledger — is the sheet still shared?");
    }

    lastGood = parseLedger(csv, new Date().toISOString());
    return lastGood;
  } catch (error) {
    console.error("[debt] could not read the sheet:", error);
    if (lastGood) return { ...lastGood, stale: true };
    throw error;
  }
}

// ── formatting ─────────────────────────────────────────────────────────────

export function formatEuro(n: number, options?: { sign?: boolean }): string {
  const formatted = new Intl.NumberFormat("en-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  if (!options?.sign) return n < 0 ? `−${formatted}` : formatted;
  return n < 0 ? `−${formatted}` : `+${formatted}`;
}

export function formatDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-BE", { day: "numeric", month: "short", year: "numeric" });
}
