import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import { dataCacheHeaders } from "@/lib/data-route";

// Read the dataset at request time; prerendering baked a 404 into the image.
export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = path.join(DATA_DIR, "latest", "generated", "contributors.json");
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Contributors data not available" },
      { status: 404, headers: dataCacheHeaders(false) }
    );
  }
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...dataCacheHeaders(true),
      },
    });
  } catch (error) {
    console.error("[api/contributors] read error:", error);
    return NextResponse.json(
      { error: "Failed to read contributors data" },
      { status: 500, headers: dataCacheHeaders(false) }
    );
  }
}
