/**
 * Event metadata overlay.
 *
 * The events pages let an admin record attendance, income and notes against an
 * event. That used to be written straight back into the pipeline-generated
 * `events.json` inside DATA_DIR, which no longer works (and never really did):
 *
 *  - DATA_DIR is mounted read-only, since it is a bind mount of the directory
 *    the chb pipeline owns on the host.
 *  - The next `chb generate` regenerates those files and drops in-place edits.
 *  - The writers targeted `{year}/{month}/events.json` while the year page
 *    reads `{year}/{month}/generated/events.json`, so some edits were already
 *    invisible.
 *
 * So the edits live in their own overlay file, keyed by event id, and are
 * merged over whichever events file is read. One file per month, mirroring how
 * the dataset is laid out.
 *
 * Durability: the overlay lives under RUNTIME_DIR, which defaults to a
 * directory in the OS temp dir and is therefore cleared on restart. Point
 * RUNTIME_DIR at a real volume to keep this metadata, or promote the values
 * into the chb pipeline, which is their long-term home.
 */

import * as fs from "fs";
import { ensureDirFor, runtimePath } from "@/lib/runtime-paths";

export type EventMetadata = Record<string, unknown>;

export type EventMetadataOverlay = Record<string, EventMetadata>;

/**
 * Deliberately loose: callers have their own richer `Event` types, and an
 * index signature here would make those concrete interfaces incompatible.
 */
interface EventLike {
  id: string;
  metadata?: unknown;
}

function overlayPath(year: string, month: string): string {
  return runtimePath("event-metadata", `${year}-${month}.json`);
}

/** Read the overlay for a month. Returns {} when there is none. */
export function readEventMetadataOverlay(
  year: string,
  month: string
): EventMetadataOverlay {
  try {
    const raw = fs.readFileSync(overlayPath(year, month), "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as EventMetadataOverlay;
    }
  } catch {
    // No overlay yet, or it is unreadable/corrupt — fall through to empty.
  }
  return {};
}

/**
 * Merge `updates` into the month's overlay and persist it.
 * Per-event metadata is shallow-merged, matching the previous in-place edit.
 * Returns the merged overlay, or null if it could not be written.
 */
export function saveEventMetadataOverlay(
  year: string,
  month: string,
  updates: EventMetadataOverlay
): EventMetadataOverlay | null {
  const existing = readEventMetadataOverlay(year, month);

  const merged: EventMetadataOverlay = { ...existing };
  for (const [eventId, metadata] of Object.entries(updates)) {
    merged[eventId] = { ...(existing[eventId] || {}), ...metadata };
  }

  const target = overlayPath(year, month);
  if (!ensureDirFor(target)) return null;

  try {
    fs.writeFileSync(target, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  } catch (error) {
    console.error(`[event-metadata] Failed to write overlay for ${year}-${month}:`, error);
    return null;
  }
}

/**
 * Apply a month's overlay over events read from DATA_DIR. Events without an
 * overlay entry are returned untouched.
 */
export function applyEventMetadataOverlay<T extends EventLike>(
  events: T[],
  year: string,
  month: string
): T[] {
  const overlay = readEventMetadataOverlay(year, month);
  if (Object.keys(overlay).length === 0) return events;

  return events.map((event) => {
    const patch = overlay[event.id];
    if (!patch) return event;
    return {
      ...event,
      metadata: { ...((event.metadata as EventMetadata) || {}), ...patch },
    } as T;
  });
}
