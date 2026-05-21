import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  listDatasetFiles,
  listDatasetPeriods,
  queryDataset,
  readDatasetFile,
  summarizeTokens,
} from "@/lib/mcp-dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const SERVER_INFO = {
  name: "commonshub-public-dataset",
  version: "0.1.0",
};

const TOOL_DEFINITIONS: McpTool[] = [
  {
    name: "list_periods",
    description: "List available public dataset years/months and public generated file types.",
    inputSchema: objectSchema({}),
  },
  {
    name: "list_dataset_files",
    description: "List public generated files available for a year, month, or latest snapshot.",
    inputSchema: periodSchema(),
  },
  {
    name: "read_dataset_file",
    description: "Read an allowlisted public generated dataset file such as transactions.json, contributors.json, events.json, rooms.json, or calendars/public.ics.",
    inputSchema: objectSchema({
      ...periodProperties(),
      file: { type: "string", description: "Public generated file path, e.g. transactions.json or calendars/public.ics" },
    }, ["file"]),
  },
  {
    name: "query_dataset",
    description: "Query first-class public datasets: transactions, contributors, events, rooms, or calendars. JSON arrays are paginated with limit/offset.",
    inputSchema: objectSchema({
      ...periodProperties(),
      dataset: { type: "string", enum: ["transactions", "contributors", "events", "rooms", "calendars"] },
      limit: { type: "number", minimum: 1, maximum: 500 },
      offset: { type: "number", minimum: 0 },
    }, ["dataset"]),
  },
  {
    name: "summarize_tokens",
    description: "Summarize issued and burnt tokens from public MINT/BURN transactions for a period.",
    inputSchema: periodSchema(),
  },
];

export async function POST(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;

  let payload: JsonRpcRequest;
  try {
    payload = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Parse error", 400);
  }

  const id = payload.id ?? null;
  try {
    switch (payload.method) {
      case "initialize":
        return jsonRpcResult(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });
      case "tools/list":
        return jsonRpcResult(id, { tools: TOOL_DEFINITIONS });
      case "tools/call":
        return handleToolCall(id, payload.params ?? {});
      case "notifications/initialized":
        return new NextResponse(null, { status: 202 });
      default:
        return jsonRpcError(id, -32601, `Method not found: ${payload.method ?? ""}`);
    }
  } catch (error) {
    return jsonRpcError(id, -32000, error instanceof Error ? error.message : "Tool execution failed");
  }
}

export async function GET(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;
  return NextResponse.json({
    name: SERVER_INFO.name,
    description:
      "MCP JSON-RPC endpoint for the Commons Hub Brussels public dataset. POST JSON-RPC requests to /mcp with a bearer token.",
    tools: TOOL_DEFINITIONS.map((tool) => ({ name: tool.name, description: tool.description })),
  });
}

function handleToolCall(id: string | number | null, params: Record<string, unknown>) {
  const name = typeof params.name === "string" ? params.name : "";
  const args = isRecord(params.arguments) ? params.arguments : {};

  switch (name) {
    case "list_periods":
      return toolResult(id, listDatasetPeriods());
    case "list_dataset_files":
      return toolResult(id, listDatasetFiles(args));
    case "read_dataset_file":
      return toolResult(id, readDatasetFile(requireFileArgs(args)));
    case "query_dataset":
      return toolResult(id, queryDataset(requireQueryArgs(args)));
    case "summarize_tokens":
      return toolResult(id, summarizeTokens(args));
    default:
      return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
  }
}

function toolResult(id: string | number | null, data: unknown) {
  return jsonRpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  });
}

function jsonRpcResult(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: string | number | null, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

function authorize(request: NextRequest): NextResponse | null {
  const expected = process.env.MCP_API_KEY;
  if (!expected) {
    return jsonRpcError(null, -32000, "MCP_API_KEY environment variable is not configured", 500);
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (constantTimeEqual(token, expected)) return null;

  return jsonRpcError(null, -32001, "Unauthorized", 401);
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ab.length !== bb.length) {
    const max = Math.max(ab.length, bb.length);
    const padA = Buffer.alloc(max);
    const padB = Buffer.alloc(max);
    ab.copy(padA);
    bb.copy(padB);
    timingSafeEqual(padA, padB);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function requireFileArgs(args: Record<string, unknown>) {
  if (typeof args.file !== "string") throw new Error("file is required");
  return { ...args, file: args.file };
}

function requireQueryArgs(args: Record<string, unknown>) {
  if (typeof args.dataset !== "string") throw new Error("dataset is required");
  if (!["transactions", "contributors", "events", "rooms", "calendars"].includes(args.dataset)) {
    throw new Error(`Unknown dataset: ${args.dataset}`);
  }
  return {
    ...args,
    dataset: args.dataset as "transactions" | "contributors" | "events" | "rooms" | "calendars",
    limit: typeof args.limit === "number" ? args.limit : undefined,
    offset: typeof args.offset === "number" ? args.offset : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function periodProperties() {
  return {
    year: { type: "string", pattern: "^\\d{4}$", description: "Dataset year, e.g. 2026" },
    month: { type: "string", pattern: "^\\d{2}$", description: "Dataset month, e.g. 05" },
    latest: { type: "boolean", description: "Use /data/latest/generated instead of a year/month period" },
  };
}

function periodSchema() {
  return objectSchema(periodProperties());
}

function objectSchema(properties: Record<string, unknown>, required: string[] = []) {
  return { type: "object", properties, required, additionalProperties: false };
}
