/**
 * @jest-environment node
 *
 * The website is a read-only view of the dataset the chb pipeline generates.
 * It may cache things for speed, and nothing else — anything it wants to
 * record has to go out over nostr, where chb picks it up.
 *
 * This test pins that down. If it fails, you added a filesystem write: either
 * it is a cache (put it under RUNTIME_DIR and add the module below), or it is
 * data, and it belongs on nostr rather than on disk.
 */

import fs from "fs";
import path from "path";
import { describe, expect, test } from "@jest/globals";

const SRC = path.join(__dirname, "..", "src");

/** Modules allowed to write, all of them caches rooted at RUNTIME_DIR. */
const CACHE_MODULES = [
  "lib/runtime-paths.ts", // the helper that creates RUNTIME_DIR itself
  "lib/discord-cache.ts", // Discord messages fetched at runtime
  "lib/wallet-address-cache.ts", // resolved wallet addresses
  "lib/image-proxy-server.ts", // resized images
].sort();

const WRITE_CALLS = [
  "writeFileSync",
  "appendFileSync",
  "mkdirSync",
  "rmSync",
  "unlinkSync",
  "renameSync",
  "copyFileSync",
  "createWriteStream",
  "promises.writeFile",
  "fs.writeFile(",
];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, found);
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

describe("the website never writes outside its caches", () => {
  test("only cache modules touch the filesystem", () => {
    const writers = sourceFiles(SRC)
      .filter((file) => {
        const source = fs.readFileSync(file, "utf-8");
        return WRITE_CALLS.some((call) => source.includes(call));
      })
      .map((file) => path.relative(SRC, file).split(path.sep).join("/"))
      .sort();

    expect(writers).toEqual(CACHE_MODULES);
  });

  test("no module builds a write path out of DATA_DIR", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const source = fs.readFileSync(file, "utf-8");
      if (!WRITE_CALLS.some((call) => source.includes(call))) continue;

      // A cache module may still READ from DATA_DIR (the Discord cache does),
      // so flag only a write call taking a DATA_DIR-derived path.
      for (const call of WRITE_CALLS) {
        const pattern = new RegExp(
          `${call.replace(/[.()]/g, "\\$&")}\\s*\\(\\s*[^,)]*DATA_DIR`
        );
        if (pattern.test(source)) {
          offenders.push(path.relative(SRC, file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
