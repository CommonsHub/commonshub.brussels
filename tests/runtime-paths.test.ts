/**
 * @jest-environment node
 */

import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

/**
 * RUNTIME_DIR is resolved at module load, so every test sets the env var and
 * then imports the module fresh.
 */
async function loadRuntimePaths(runtimeDir?: string) {
  jest.resetModules();
  if (runtimeDir === undefined) {
    delete process.env.RUNTIME_DIR;
  } else {
    process.env.RUNTIME_DIR = runtimeDir;
  }
  return import("@/lib/runtime-paths");
}

async function loadOverlay(runtimeDir: string) {
  jest.resetModules();
  process.env.RUNTIME_DIR = runtimeDir;
  return import("@/lib/event-metadata-overlay");
}

describe("runtime paths", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chb-runtime-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.RUNTIME_DIR;
    jest.resetModules();
  });

  test("defaults to a directory inside the OS temp dir", async () => {
    const { RUNTIME_DIR } = await loadRuntimePaths(undefined);
    expect(RUNTIME_DIR).toBe(path.join(os.tmpdir(), "commonshub"));
  });

  test("honours the RUNTIME_DIR env var", async () => {
    const { RUNTIME_DIR, runtimePath } = await loadRuntimePaths(tmpDir);
    expect(RUNTIME_DIR).toBe(path.resolve(tmpDir));
    expect(runtimePath("a", "b.json")).toBe(path.join(tmpDir, "a", "b.json"));
  });

  test("never resolves inside DATA_DIR", async () => {
    const { RUNTIME_DIR } = await loadRuntimePaths(undefined);
    const dataDir = path.resolve(process.env.DATA_DIR || "/data");
    expect(RUNTIME_DIR.startsWith(dataDir + path.sep)).toBe(false);
  });

  test("ensureDirFor creates missing parents and reports failure", async () => {
    const { ensureDirFor } = await loadRuntimePaths(tmpDir);

    const target = path.join(tmpDir, "deep", "nested", "file.json");
    expect(ensureDirFor(target)).toBe(true);
    expect(fs.existsSync(path.dirname(target))).toBe(true);

    // A file where a directory should be makes creation impossible.
    const blocker = path.join(tmpDir, "blocker");
    fs.writeFileSync(blocker, "not a directory");
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(ensureDirFor(path.join(blocker, "child.json"))).toBe(false);
    consoleError.mockRestore();
  });
});

describe("event metadata overlay", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chb-overlay-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.RUNTIME_DIR;
    jest.resetModules();
  });

  test("returns an empty overlay when nothing was saved", async () => {
    const { readEventMetadataOverlay } = await loadOverlay(tmpDir);
    expect(readEventMetadataOverlay("2026", "07")).toEqual({});
  });

  test("saves outside DATA_DIR and reads back", async () => {
    const { saveEventMetadataOverlay, readEventMetadataOverlay } =
      await loadOverlay(tmpDir);

    saveEventMetadataOverlay("2026", "07", { "evt-1": { attendance: 42 } });

    expect(readEventMetadataOverlay("2026", "07")).toEqual({
      "evt-1": { attendance: 42 },
    });
    expect(
      fs.existsSync(path.join(tmpDir, "event-metadata", "2026-07.json"))
    ).toBe(true);
  });

  test("shallow-merges repeated edits instead of replacing them", async () => {
    const { saveEventMetadataOverlay, readEventMetadataOverlay } =
      await loadOverlay(tmpDir);

    saveEventMetadataOverlay("2026", "07", {
      "evt-1": { attendance: 42, note: "first" },
    });
    saveEventMetadataOverlay("2026", "07", { "evt-1": { note: "second" } });

    expect(readEventMetadataOverlay("2026", "07")).toEqual({
      "evt-1": { attendance: 42, note: "second" },
    });
  });

  test("keeps months separate", async () => {
    const { saveEventMetadataOverlay, readEventMetadataOverlay } =
      await loadOverlay(tmpDir);

    saveEventMetadataOverlay("2026", "07", { "evt-1": { attendance: 1 } });
    saveEventMetadataOverlay("2026", "08", { "evt-2": { attendance: 2 } });

    expect(readEventMetadataOverlay("2026", "07")).toEqual({
      "evt-1": { attendance: 1 },
    });
    expect(readEventMetadataOverlay("2026", "08")).toEqual({
      "evt-2": { attendance: 2 },
    });
  });

  test("applies over events, leaving unmatched ones untouched", async () => {
    const { saveEventMetadataOverlay, applyEventMetadataOverlay } =
      await loadOverlay(tmpDir);

    saveEventMetadataOverlay("2026", "07", { "evt-1": { attendance: 42 } });

    const events = [
      { id: "evt-1", name: "Edited", metadata: { attendance: 0, note: "keep" } },
      { id: "evt-2", name: "Untouched", metadata: { attendance: 7 } },
    ];
    const merged = applyEventMetadataOverlay(events, "2026", "07");

    // Overlay wins, other metadata keys survive.
    expect(merged[0].metadata).toEqual({ attendance: 42, note: "keep" });
    expect(merged[1]).toBe(events[1]);
    // The input is not mutated.
    expect(events[0].metadata.attendance).toBe(0);
  });

  test("returns events unchanged when there is no overlay", async () => {
    const { applyEventMetadataOverlay } = await loadOverlay(tmpDir);

    const events = [{ id: "evt-1", metadata: { attendance: 1 } }];
    expect(applyEventMetadataOverlay(events, "2026", "07")).toBe(events);
  });

  test("survives a corrupt overlay file", async () => {
    const { readEventMetadataOverlay } = await loadOverlay(tmpDir);

    const target = path.join(tmpDir, "event-metadata", "2026-07.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "{ not json");

    expect(readEventMetadataOverlay("2026", "07")).toEqual({});
  });
});
