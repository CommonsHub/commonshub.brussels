import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { isAdmin } from "@/lib/admin-check";
import { DATA_DIR } from "@/lib/data-paths";
import type {
  CounterpartiesFile,
  CounterpartyMetadata,
} from "@/types/counterparties";

/**
 * Find the most recent generated/counterparties.json containing the given id.
 */
function findCounterpartyFile(id: string): string | null {
  if (!fs.existsSync(DATA_DIR)) return null;

  const yearDirs = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map((d) => d.name)
    .sort()
    .reverse();

  for (const year of yearDirs) {
    const yearPath = path.join(DATA_DIR, year);
    const monthDirs = fs
      .readdirSync(yearPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{2}$/.test(d.name))
      .map((d) => d.name)
      .sort()
      .reverse();

    for (const month of monthDirs) {
      const filePath = path.join(
        DATA_DIR,
        year,
        month,
        "generated",
        "counterparties.json"
      );
      if (!fs.existsSync(filePath)) continue;
      try {
        const data: CounterpartiesFile = JSON.parse(
          fs.readFileSync(filePath, "utf-8")
        );
        if (data.counterparties && id in data.counterparties) {
          return filePath;
        }
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
      }
    }
  }

  return null;
}

/**
 * PATCH /api/counterparties/[id]
 * Merge the request body into the counterparty's metadata. Admin-only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const decodedId = decodeURIComponent((await params).id);

  let patch: Partial<CounterpartyMetadata>;
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const filePath = findCounterpartyFile(decodedId);
  if (!filePath) {
    return NextResponse.json(
      { error: "Counterparty not found" },
      { status: 404 }
    );
  }

  try {
    const data: CounterpartiesFile = JSON.parse(
      fs.readFileSync(filePath, "utf-8")
    );
    const current = data.counterparties[decodedId];
    if (!current) {
      return NextResponse.json(
        { error: "Counterparty not found" },
        { status: 404 }
      );
    }

    const merged: CounterpartyMetadata = { ...current, ...patch };
    data.counterparties[decodedId] = merged;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    return NextResponse.json({ id: decodedId, metadata: merged });
  } catch (error) {
    console.error("Error updating counterparty:", error);
    return NextResponse.json(
      { error: "Failed to update counterparty" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/counterparties/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const decodedId = decodeURIComponent((await params).id);

  const filePath = findCounterpartyFile(decodedId);
  if (!filePath) {
    return NextResponse.json(
      { error: "Counterparty not found" },
      { status: 404 }
    );
  }

  try {
    const data: CounterpartiesFile = JSON.parse(
      fs.readFileSync(filePath, "utf-8")
    );
    const metadata = data.counterparties[decodedId];
    if (!metadata) {
      return NextResponse.json(
        { error: "Counterparty not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ id: decodedId, metadata });
  } catch (error) {
    console.error("Error reading counterparty:", error);
    return NextResponse.json(
      { error: "Failed to read counterparty" },
      { status: 500 }
    );
  }
}
