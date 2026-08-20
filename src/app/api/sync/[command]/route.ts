/**
 * POST /api/sync/[command] — Triggers a sync command and streams output via SSE
 *
 * Commands: events, transactions, messages, bookings, all
 *
 * Query params:
 *   months=2025-01,2025-02  — sync specific months (runs per-month with --force)
 */
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import { ensureDirFor, runtimePath } from "@/lib/runtime-paths";

export const maxDuration = 300;

function getChbPath(): string {
  for (const p of ["/usr/local/bin/chb"]) {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch {}
  }
  throw new Error("CHB is not installed in the web container. Run sync from the dedicated CHB service that shares this DATA_DIR.");
}

const VALID_COMMANDS: Record<string, string[][]> = {
  events: [["events", "sync"]],
  transactions: [["transactions", "sync"]],
  messages: [["messages", "sync"]],
  bookings: [["bookings", "sync"]],
  all: [
    ["events", "sync"],
    ["transactions", "sync"],
    ["messages", "sync"],
    ["bookings", "sync"],
  ],
};

function updateSyncState(duration: string) {
  // DATA_DIR is read-only, so sync state lives under RUNTIME_DIR.
  const stateFile = runtimePath("sync-state.json");
  if (!ensureDirFor(stateFile)) return;
  try {
    fs.writeFileSync(
      stateFile,
      JSON.stringify(
        { lastSync: new Date().toISOString(), duration },
        null,
        2
      )
    );
  } catch (err) {
    console.error("Failed to update sync state:", err);
  }
}

function runCommand(
  chbPath: string,
  args: string[],
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(chbPath, args, {
      env: { ...process.env, DATA_DIR, FORCE_COLOR: "0" },
      cwd: process.cwd(),
    });

    const send = (data: string, stream: string) => {
      const lines = data.split("\n");
      for (const line of lines) {
        if (line) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ stream, text: line })}\n\n`
              )
            );
          } catch {}
        }
      }
    };

    proc.stdout.on("data", (chunk: Buffer) => send(chunk.toString(), "stdout"));
    proc.stderr.on("data", (chunk: Buffer) => send(chunk.toString(), "stderr"));
    proc.on("close", (code) => resolve(code ?? 1));
    proc.on("error", (err) => {
      send(`Error: ${err.message}`, "stderr");
      resolve(1);
    });
  });
}

/**
 * Convert "2025-01" to "2025/01" for CLI positional arg
 */
function monthToCliArg(month: string): string {
  return month.replace("-", "/");
}

/**
 * Build command arrays for specific months.
 * For each base command and each month, produce: [...baseCmd, "YYYY/MM", "--force"]
 */
function buildMonthCommands(
  baseCommands: string[][],
  months: string[]
): string[][] {
  const result: string[][] = [];
  for (const baseCmd of baseCommands) {
    for (const month of months) {
      result.push([...baseCmd, monthToCliArg(month), "--force"]);
    }
  }
  return result;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ command: string }> }
) {
  const { command } = await params;

  if (!VALID_COMMANDS[command]) {
    return new Response(JSON.stringify({ error: "Invalid command" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const monthsParam = request.nextUrl.searchParams.get("months");
  const specificMonths = monthsParam
    ? monthsParam.split(",").filter((m) => /^\d{4}-\d{2}$/.test(m))
    : [];

  let chbPath: string;
  try {
    chbPath = getChbPath();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const baseCommands = VALID_COMMANDS[command];

  // If specific months requested, run per-month with --force
  const commands =
    specificMonths.length > 0
      ? buildMonthCommands(baseCommands, specificMonths)
      : baseCommands;

  const startTime = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        let allSuccess = true;

        for (const args of commands) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ stream: "system", text: `▶ Running: chb ${args.join(" ")}` })}\n\n`
            )
          );

          const code = await runCommand(chbPath, args, controller, encoder);

          if (code !== 0) {
            allSuccess = false;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ stream: "system", text: `✗ chb ${args.join(" ")} exited with code ${code}` })}\n\n`
              )
            );
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ stream: "system", text: `✓ chb ${args.join(" ")} completed` })}\n\n`
              )
            );
          }
        }

        const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
        updateSyncState(duration);

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ stream: "done", success: allSuccess, duration })}\n\n`
          )
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ stream: "error", text: message })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
