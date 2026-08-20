/**
 * GET /api/sync — Returns sync status + per-month data overview
 * All data comes from the CHB CLI (single source of truth for data dir)
 * Accepts ?year=2025 to filter months by year
 */
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import { runtimePath } from "@/lib/runtime-paths";

interface StatsMonth {
  month: string;
  count: number;
  accounts?: string[];
  rooms?: string[];
  channels?: string[];
}

interface StatsResult {
  total: number;
  upcoming?: number;
  months: StatsMonth[];
}

interface MonthData {
  month: string;
  events: number;
  bookings: number;
  transactions: number;
  messages: number;
}

function chbBinary(): string {
  const candidates = ["/usr/local/bin/chb"];
  for (const p of candidates) {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch {}
  }
  throw new Error("CHB is not installed in the web container. Run sync from the dedicated CHB service that shares this DATA_DIR.");
}

function runCliStats(bin: string, resource: string): StatsResult {
  const output = execSync(`${bin} ${resource} stats --format json`, {
    env: { ...process.env, DATA_DIR },
    timeout: 10000,
    encoding: "utf-8",
  });
  return JSON.parse(output);
}

function getSyncState(): { lastSync: string | null; duration: string | null } {
  // Written by /api/sync/[command]; lives under RUNTIME_DIR because DATA_DIR
  // is read-only. Fall back to the legacy DATA_DIR location so state written
  // before this moved is still picked up.
  const candidates = [
    runtimePath("sync-state.json"),
    path.join(DATA_DIR, "sync-state.json"),
  ];
  for (const stateFile of candidates) {
    try {
      return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    } catch {
      // try the next candidate
    }
  }
  return { lastSync: null, duration: null };
}

function buildMonthsFromStats(
  events: StatsResult,
  transactions: StatsResult,
  bookings: StatsResult,
  messages: StatsResult,
  yearFilter?: string
): MonthData[] {
  const monthSet = new Set<string>();
  for (const stats of [events, transactions, bookings, messages]) {
    for (const m of stats.months) {
      monthSet.add(m.month);
    }
  }

  const eventsMap = new Map(events.months.map((m) => [m.month, m.count]));
  const txMap = new Map(transactions.months.map((m) => [m.month, m.count]));
  const bookingsMap = new Map(bookings.months.map((m) => [m.month, m.count]));
  const messagesMap = new Map(messages.months.map((m) => [m.month, m.count]));

  let months = Array.from(monthSet)
    .sort()
    .reverse()
    .map((month) => ({
      month,
      events: eventsMap.get(month) || 0,
      bookings: bookingsMap.get(month) || 0,
      transactions: txMap.get(month) || 0,
      messages: messagesMap.get(month) || 0,
    }));

  if (yearFilter) {
    months = months.filter((m) => m.month.startsWith(yearFilter));
  }

  return months;
}

export async function GET(request: NextRequest) {
  const yearFilter = request.nextUrl.searchParams.get("year") || undefined;
  const syncState = getSyncState();

  try {
    const bin = chbBinary();

    const eventsStats = runCliStats(bin, "events");
    const transactionsStats = runCliStats(bin, "transactions");
    const bookingsStats = runCliStats(bin, "bookings");
    const messagesStats = runCliStats(bin, "messages");

    const months = buildMonthsFromStats(
      eventsStats,
      transactionsStats,
      bookingsStats,
      messagesStats,
      yearFilter
    );

    return NextResponse.json({
      lastSync: syncState.lastSync,
      duration: syncState.duration,
      dataDir: DATA_DIR,
      totals: {
        events: eventsStats.total,
        upcoming: eventsStats.upcoming,
        transactions: transactionsStats.total,
        bookings: bookingsStats.total,
        messages: messagesStats.total,
      },
      months,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message,
        lastSync: syncState.lastSync,
        duration: syncState.duration,
        dataDir: DATA_DIR,
        totals: { events: 0, upcoming: 0, transactions: 0, bookings: 0, messages: 0 },
        months: [],
      },
      { status: 500 }
    );
  }
}
