/**
 * API route to get membership data
 *
 * Reads pre-generated data from data/{year}/{month}/generated/members.json
 * Use /api/sync to refresh data on demand.
 *
 * GET /api/members              → current month
 * GET /api/members?year=2026&month=01 → specific month
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { MembersFile } from "@/types/members";
import { DATA_DIR } from "@/lib/data-paths";

function findLatestMembersPath(): string | null {
  try {
    const years = fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();

    for (const year of years) {
      const yearPath = path.join(DATA_DIR, year);
      const months = fs
        .readdirSync(yearPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d{2}$/.test(entry.name))
        .map((entry) => entry.name)
        .sort()
        .reverse();

      for (const month of months) {
        const membersPath = path.join(yearPath, month, "generated", "members.json");
        if (fs.existsSync(membersPath)) {
          return membersPath;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const membersPath =
    year && month
      ? path.join(DATA_DIR, year, month.padStart(2, "0"), "generated", "members.json")
      : findLatestMembersPath();

  if (!membersPath || !fs.existsSync(membersPath)) {
    return NextResponse.json(
      { error: "Members data not found. Try generating members data first." },
      { status: 404 }
    );
  }

  try {
    const data: MembersFile = JSON.parse(fs.readFileSync(membersPath, "utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to read members data" }, { status: 500 });
  }
}
