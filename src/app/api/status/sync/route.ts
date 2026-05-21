import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-check";
import { DATA_DIR } from "@/lib/data-paths";

export const maxDuration = 300;

function getChbPath(): string {
  for (const candidate of ["/usr/local/bin/chb", "chb"]) {
    if (candidate === "chb") return candidate;
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }

  return "chb";
}

function sendEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: Record<string, unknown>
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

function streamLines(
  data: string,
  stream: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  for (const line of data.split("\n")) {
    if (line) {
      sendEvent(controller, encoder, { stream, text: line });
    }
  }
}

function updateSyncState(duration: string) {
  const stateFile = path.join(DATA_DIR, "sync-state.json");

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      stateFile,
      JSON.stringify({ lastSync: new Date().toISOString(), duration }, null, 2)
    );
  } catch (error) {
    console.error("[Status Sync] Failed to update sync state:", error);
  }
}

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const chbPath = getChbPath();
  const startTime = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let settled = false;

      const finish = (success: boolean, duration: string) => {
        if (settled) return;
        settled = true;
        sendEvent(controller, encoder, {
          stream: "done",
          success,
          duration,
        });
        controller.close();
      };

      sendEvent(controller, encoder, {
        stream: "system",
        text: `▶ Running: chb sync (DATA_DIR=${DATA_DIR})`,
      });

      const proc = spawn(chbPath, ["sync"], {
        env: { ...process.env, DATA_DIR, FORCE_COLOR: "0" },
        cwd: process.cwd(),
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        streamLines(chunk.toString(), "stdout", controller, encoder);
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        streamLines(chunk.toString(), "stderr", controller, encoder);
      });

      proc.on("error", (error) => {
        const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
        sendEvent(controller, encoder, {
          stream: "error",
          text: `Failed to start chb sync: ${error.message}`,
        });
        finish(false, duration);
      });

      proc.on("close", (code) => {
        const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
        const success = code === 0;

        if (success) {
          updateSyncState(duration);
          sendEvent(controller, encoder, {
            stream: "system",
            text: "✓ chb sync completed",
          });
        } else {
          sendEvent(controller, encoder, {
            stream: "system",
            text: `✗ chb sync exited with code ${code ?? 1}`,
          });
        }

        finish(success, duration);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
