import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-check";

export async function GET() {
  try {
    return NextResponse.json(
      { isAdmin: await isAdmin() },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[Status Admin] Failed to check admin status:", error);
    return NextResponse.json(
      { isAdmin: false },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
