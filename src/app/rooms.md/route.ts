import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import { dataCacheHeaders } from "@/lib/data-route";

// Read the dataset at request time; prerendering baked the 404 into the image.
export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = path.join(DATA_DIR, "latest", "generated", "rooms.md");

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Rooms markdown not yet generated", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...dataCacheHeaders(false),
      },
    });
  }

  const content = fs.readFileSync(filePath, "utf-8");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      ...dataCacheHeaders(true),
    },
  });
}
