import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";

export const revalidate = 300;

export async function GET() {
  const filePath = path.join(DATA_DIR, "latest", "generated", "events.md");

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Events markdown not yet generated", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const content = fs.readFileSync(filePath, "utf-8");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
