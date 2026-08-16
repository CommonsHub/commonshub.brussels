import { NextResponse } from "next/server";
import { currentCaller } from "@/modules/identity/server";
import { signerFor } from "@/modules/identity/service";
import { MAX_UPLOAD_BYTES, uploadToBlossom } from "@/modules/tasks/blossom";

/** Upload a photo for a comment. Returns where it landed. */
export async function POST(request: Request) {
  const caller = await currentCaller();
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file to upload." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That file is too big — 10 MB is the limit." }, { status: 413 });
  }

  try {
    const uploaded = await uploadToBlossom(
      {
        bytes: new Uint8Array(await file.arrayBuffer()),
        mime: file.type,
        name: file.name,
      },
      signerFor(caller.account),
    );
    return NextResponse.json({ attachment: uploaded });
  } catch (error) {
    console.error("[proposals] photo upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "That photo did not upload." },
      { status: 502 },
    );
  }
}
