/**
 * Best-effort avatars for thread authors: hub accounts only store a display
 * name, but most people here are also Discord members, and the contributors
 * dataset has their picture. Names that match get the picture; the rest get
 * their initial.
 */

import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";

let cache: { at: number; map: Map<string, string> } | null = null;

function contributorAvatars(): Map<string, string> {
  if (cache && Date.now() - cache.at < 300_000) return cache.map;
  const map = new Map<string, string>();
  try {
    const file = path.join(DATA_DIR, "latest", "generated", "contributors.json");
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as {
      contributors?: Array<{ username?: string; displayName?: string; avatar?: string }>;
    };
    for (const contributor of data.contributors ?? []) {
      if (!contributor.avatar) continue;
      if (contributor.username) map.set(contributor.username.toLowerCase(), contributor.avatar);
      if (contributor.displayName) map.set(contributor.displayName.toLowerCase(), contributor.avatar);
    }
  } catch {
    /* no dataset, no pictures — initials still work */
  }
  cache = { at: Date.now(), map };
  return map;
}

export function avatarFor(name: string): string | null {
  return contributorAvatars().get(name.trim().toLowerCase()) ?? null;
}
