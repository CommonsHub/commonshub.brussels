import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";

export const revalidate = 300;

/**
 * GET /api/images                    → DATA_DIR/latest/generated/images.json
 * GET /api/images?year=YYYY&month=MM → DATA_DIR/YYYY/MM/generated/images.json
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  let filePath: string;
  if (year && month) {
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
    }
    filePath = path.join(DATA_DIR, year, month, "generated", "images.json");
  } else {
    filePath = path.join(DATA_DIR, "latest", "generated", "images.json");
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Images data not available" },
      { status: 404 }
    );
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    console.error("[api/images] read error:", error);
    return NextResponse.json(
      { error: "Failed to read images data" },
      { status: 500 }
    );
  }
}
