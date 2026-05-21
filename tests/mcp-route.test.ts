/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function loadRoute(dataDir: string, apiKey?: string) {
  jest.resetModules();
  process.env.DATA_DIR = dataDir;
  if (apiKey === undefined) {
    delete process.env.MCP_API_KEY;
  } else {
    process.env.MCP_API_KEY = apiKey;
  }
  return import("@/app/mcp/route");
}

function mcpRequest(body: unknown, apiKey?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (apiKey) headers.set("authorization", `Bearer ${apiKey}`);
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("/mcp route", () => {
  let tmpDir: string;
  const previousDataDir = process.env.DATA_DIR;
  const previousApiKey = process.env.MCP_API_KEY;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chb-mcp-"));
    writeJson(path.join(tmpDir, "2026", "05", "generated", "transactions.json"), {
      year: "2026",
      month: "05",
      transactions: [
        { id: "tx-1", type: "MINT", amount: 100, timestamp: 1770000000 },
        { id: "tx-2", type: "BURN", amount: 25, timestamp: 1770000010 },
      ],
    });
    writeJson(path.join(tmpDir, "2026", "05", "generated", "contributors.json"), {
      year: "2026",
      month: "05",
      summary: { totalContributors: 1 },
      contributors: [{ id: "alice" }],
    });
    writeJson(path.join(tmpDir, "2026", "05", "generated", "events.json"), {
      month: "05",
      events: [{ id: "evt-1", name: "Assembly", source: "luma" }],
    });
    writeJson(path.join(tmpDir, "2026", "05", "generated", "calendars", "public.ics"), "BEGIN:VCALENDAR");
    writeJson(path.join(tmpDir, "latest", "generated", "rooms.json"), {
      rooms: [{ id: "main", name: "Main room" }],
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.resetModules();
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    if (previousApiKey === undefined) delete process.env.MCP_API_KEY;
    else process.env.MCP_API_KEY = previousApiKey;
  });

  it("requires MCP_API_KEY to be configured", async () => {
    const { POST } = await loadRoute(tmpDir);
    const response = await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "secret") as any);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).toContain("MCP_API_KEY");
  });

  it("rejects requests without the bearer API key", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const response = await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }) as any);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.message).toBe("Unauthorized");
  });

  it("lists MCP tools for navigating the public dataset", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const response = await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "secret") as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "list_periods",
      "list_dataset_files",
      "read_dataset_file",
      "query_dataset",
      "summarize_tokens",
    ]);
  });

  it("summarizes public periods and generated dataset files", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const response = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_periods", arguments: {} },
    }, "secret") as any);

    const body = await response.json();
    const data = JSON.parse(body.result.content[0].text);
    expect(data.periods).toEqual([{ year: "2026", months: ["05"] }]);
    expect(data.latest).toContain("rooms.json");
    expect(data.generatedFiles).toEqual(expect.arrayContaining([
      "transactions.json",
      "contributors.json",
      "events.json",
      "calendars/public.ics",
    ]));
  });

  it("reads only allowlisted public generated files", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const response = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "read_dataset_file",
        arguments: { year: "2026", month: "05", file: "transactions.json" },
      },
    }, "secret") as any);

    const body = await response.json();
    const data = JSON.parse(body.result.content[0].text);
    expect(data.transactions).toHaveLength(2);

    const privateResponse = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "read_dataset_file",
        arguments: { year: "2026", month: "05", file: "private/enrichment.json" },
      },
    }, "secret") as any);
    const privateBody = await privateResponse.json();
    expect(privateBody.error.message).toContain("not public");
  });

  it("queries first-class datasets and summarizes issued/burnt tokens", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const queryResponse = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "query_dataset",
        arguments: { dataset: "transactions", year: "2026", month: "05", limit: 1 },
      },
    }, "secret") as any);
    const queryBody = await queryResponse.json();
    const queryData = JSON.parse(queryBody.result.content[0].text);
    expect(queryData.items).toEqual([{ id: "tx-1", type: "MINT", amount: 100, timestamp: 1770000000 }]);
    expect(queryData.total).toBe(2);

    const tokenResponse = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "summarize_tokens", arguments: { year: "2026", month: "05" } },
    }, "secret") as any);
    const tokenBody = await tokenResponse.json();
    const tokenData = JSON.parse(tokenBody.result.content[0].text);
    expect(tokenData).toMatchObject({ minted: 100, burnt: 25, net: 75, transactionCount: 2 });
  });
});
