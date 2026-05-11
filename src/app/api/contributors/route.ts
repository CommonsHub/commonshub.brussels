import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";

export const revalidate = 300;

export async function GET() {
  const filePath = path.join(DATA_DIR, "latest", "generated", "contributors.json");
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Contributors data not available" },
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
    console.error("[api/contributors] read error:", error);
    return NextResponse.json(
      { error: "Failed to read contributors data" },
      { status: 500 }
    );
  }
}
