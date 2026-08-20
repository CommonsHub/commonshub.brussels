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
