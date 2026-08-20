/**
 * @jest-environment node
 *
 * DATA_DIR is a volume mounted at runtime — it does not exist during the
 * Docker build. Any route that reads it and lets Next.js prerender gets its
 * "no data" answer baked into the image and serves that to every visitor
 * until the first revalidation.
 *
 * That is not hypothetical: it put "No upcoming events at the moment" on the
 * homepage after a deploy, with `{"events":[],"cached":false}` sitting in
 * .next/server/app/api/events.body, while /events.md — which already opted
 * out — was fine.
 *
 * So: every route reading DATA_DIR must opt out of prerendering.
 */

import fs from "fs";
import path from "path";
import { describe, expect, test } from "@jest/globals";

const APP = path.join(__dirname, "..", "src", "app");

function routeFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(full, found);
    else if (/^(route|page)\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

/** Routes that reach the dataset, directly or through a helper. */
function readsDataset(source: string): boolean {
  return (
    source.includes("DATA_DIR") ||
    source.includes("@/lib/data-paths") ||
    source.includes("./data-paths")
  );
}

describe("routes that read the dataset are never prerendered", () => {
  /**
   * `export const revalidate` is what opts a route handler into static
   * generation. On a route that reads DATA_DIR that means Next.js calls it at
   * build time, when the volume is not mounted, and freezes the empty answer
   * into the image. Caching for these routes belongs in Cache-Control headers
   * (see src/lib/data-route.ts), which apply at request time and can react to
   * whether anything was actually found.
   */
  test("no route reading DATA_DIR exports revalidate", () => {
    const offenders = routeFiles(APP)
      .filter((file) => {
        const source = fs.readFileSync(file, "utf-8");
        return readsDataset(source) && /export\s+const\s+revalidate\s*=/.test(source);
      })
      .map((file) => path.relative(APP, file).split(path.sep).join("/"))
      .sort();

    expect(offenders).toEqual([]);
  });

  /**
   * The four routes that were actually prerendered before this was fixed.
   * They have no dynamic segment and take no request input, so nothing else
   * forces them dynamic — the directive is the only thing keeping them honest.
   */
  test("the routes that were baked into the image stay dynamic", () => {
    const mustBeDynamic = [
      "api/events/route.ts",
      "api/contributors/route.ts",
      "api/activitygrid/route.ts",
      "rooms.md/route.ts",
    ];

    for (const rel of mustBeDynamic) {
      const source = fs.readFileSync(path.join(APP, rel), "utf-8");
      // Must be a string literal: Next.js ignores anything else, silently.
      const dynamic = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(
        source
      );
      expect({ route: rel, dynamic }).toEqual({ route: rel, dynamic: true });
    }
  });
});

describe("an absence is never cached for long", () => {
  test("a real answer is cached for minutes, an empty one for seconds", async () => {
    const { cacheSecondsFor, FULL_CACHE_SECONDS, EMPTY_CACHE_SECONDS } =
      await import("@/lib/data-route");

    expect(cacheSecondsFor(true)).toBe(FULL_CACHE_SECONDS);
    expect(cacheSecondsFor(false)).toBe(EMPTY_CACHE_SECONDS);
    expect(EMPTY_CACHE_SECONDS).toBeLessThanOrEqual(10);
    expect(FULL_CACHE_SECONDS).toBeGreaterThan(EMPTY_CACHE_SECONDS);
  });

  test("Cache-Control reflects whether anything was found", async () => {
    const { dataCacheHeaders } = await import("@/lib/data-route");

    expect(dataCacheHeaders(true)["Cache-Control"]).toBe(
      "public, max-age=300, s-maxage=300"
    );
    expect(dataCacheHeaders(false)["Cache-Control"]).toBe(
      "public, max-age=10, s-maxage=10"
    );
  });

  test("the events route shortens its own cache when it finds nothing", () => {
    const source = fs.readFileSync(
      path.join(APP, "api", "events", "route.ts"),
      "utf-8"
    );
    // The in-process cache is a second layer: without this it would hold an
    // empty list for the full five minutes.
    expect(source).toMatch(/EMPTY_CACHE_DURATION/);
    expect(source).toMatch(/events\.length > 0 \? CACHE_DURATION : EMPTY_CACHE_DURATION/);
  });
});
