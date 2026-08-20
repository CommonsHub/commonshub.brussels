import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import { applyEventMetadataOverlay } from "@/lib/event-metadata-overlay";

export const revalidate = 300;

/**
 * GET /api/events/[year]/[month] → DATA_DIR/[year]/[month]/generated/events.json
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year, month } = await params;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const filePath = path.join(DATA_DIR, year, month, "generated", "events.json");
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Events data not available for that month" },
      { status: 404 }
    );
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    // Merge any admin metadata edits, which live outside the read-only DATA_DIR.
    if (Array.isArray(data?.events)) {
      data.events = applyEventMetadataOverlay(data.events, year, month);
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    console.error(`[api/events/${year}/${month}] read error:`, error);
    return NextResponse.json(
      { error: "Failed to read events data" },
      { status: 500 }
    );
  }
}
