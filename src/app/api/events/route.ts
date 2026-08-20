import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import {
  EMPTY_CACHE_SECONDS,
  FULL_CACHE_SECONDS,
  dataCacheHeaders,
} from "@/lib/data-route";

// Read the dataset at request time. Prerendering this baked an empty
// {"events":[]} into the image and served it after every deploy.
export const dynamic = "force-dynamic";

// Cache for 5 minutes (data files are already pre-generated hourly), but hold
// on to an empty result for seconds only — it usually means the dataset was
// not readable yet, and that should not survive on the homepage.
let cachedData: {
  events: HomepageEvent[];
  timestamp: number;
} | null = null;

const CACHE_DURATION = FULL_CACHE_SECONDS * 1000;
const EMPTY_CACHE_DURATION = EMPTY_CACHE_SECONDS * 1000;

function cacheDurationFor(events: HomepageEvent[]): number {
  return events.length > 0 ? CACHE_DURATION : EMPTY_CACHE_DURATION;
}

interface EventTag {
  name: string;
  color: string;
}

interface HomepageEvent {
  id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  cover_url: string;
  url: string;
  location?: string;
  isExternal: boolean;
  externalPlatform?: string;
  externalUrl?: string;
  tags?: EventTag[];
  isFeatured?: boolean;
}

/**
 * Load upcoming events from the pre-generated latest events file.
 * This is populated by the chb CLI pipeline (runs hourly).
 */
function loadUpcomingEvents(): HomepageEvent[] {
  const now = new Date();
  const eventsPath = path.join(DATA_DIR, "latest", "generated", "events.json");

  if (!fs.existsSync(eventsPath)) {
    console.log("[events] Events file not found:", eventsPath);
    return [];
  }

  try {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data = JSON.parse(content);
    const allEvents = data.events || [];
    const events: HomepageEvent[] = [];

    for (const event of allEvents) {
      const startAt = event.startAt || event.start_at || "";

      // Only include future events
      if (startAt && new Date(startAt) < now) continue;

      // Determine if external (non-Luma source without a lu.ma URL)
      const eventUrl = event.url || "";
      const isLuma = eventUrl.includes("lu.ma") || eventUrl.includes("luma.com");
      const isExternal = !isLuma && !!eventUrl;

      // Detect external platform
      let externalPlatform = "";
      if (isExternal) {
        if (eventUrl.includes("eventbrite")) externalPlatform = "Eventbrite";
        else if (eventUrl.includes("meetup")) externalPlatform = "Meetup";
        else if (eventUrl.includes("facebook")) externalPlatform = "Facebook";
        else externalPlatform = "Event Page";
      }

      // Normalize location — hide "Commons Hub" since it's implied
      let location = event.location || "";
      if (location.toLowerCase().includes("commons hub")) {
        location = "";
      }

      // Get tags from event or from nested lumaData
      const tags: EventTag[] = event.tags || (event.lumaData?.tags
        ? (event.lumaData.tags as any[]).map((t: any) =>
            typeof t === "string" ? { name: t, color: "#6b7280" } : { name: t.name, color: t.color || "#6b7280" }
          )
        : []);

      const isFeatured = tags.some(
        (t) => t.name.toLowerCase() === "featured"
      );

      // Prefer local cover image path (served via image proxy with caching/resizing)
      let coverUrl = "";
      if (event.coverImageLocal) {
        coverUrl = `/data/${event.coverImageLocal}`;
      } else {
        coverUrl = event.coverImage || event.cover_url || "";
      }

      events.push({
        id: event.id || "",
        name: event.name || "",
        description: event.description || "",
        start_at: startAt,
        end_at: event.endAt || event.end_at || "",
        cover_url: coverUrl,
        url: eventUrl,
        location,
        isExternal,
        externalPlatform: isExternal ? externalPlatform : undefined,
        externalUrl: isExternal ? eventUrl : undefined,
        tags,
        isFeatured,
      });
    }

    // Sort by date
    events.sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    return events;
  } catch (error) {
    console.error(`[events] Error reading ${eventsPath}:`, error);
    return [];
  }
}

export async function GET() {
  // Serve from cache, which expires quickly when it holds nothing.
  if (
    cachedData &&
    Date.now() - cachedData.timestamp < cacheDurationFor(cachedData.events)
  ) {
    return NextResponse.json(
      {
        events: cachedData.events,
        cached: true,
        cachedAt: new Date(cachedData.timestamp).toISOString(),
      },
      { headers: dataCacheHeaders(cachedData.events.length > 0) }
    );
  }

  try {
    const events = loadUpcomingEvents();

    cachedData = {
      events,
      timestamp: Date.now(),
    };

    return NextResponse.json(
      { events, cached: false },
      { headers: dataCacheHeaders(events.length > 0) }
    );
  } catch (error) {
    console.error("[events] Failed to load events:", error);

    // Prefer stale events over none, but do not let a failure be cached.
    if (cachedData && cachedData.events.length > 0) {
      return NextResponse.json(
        {
          events: cachedData.events,
          cached: true,
          stale: true,
          error: "Failed to refresh, serving stale cache",
        },
        { headers: dataCacheHeaders(false) }
      );
    }

    return NextResponse.json(
      { error: "Failed to load events", events: [] },
      { status: 500, headers: dataCacheHeaders(false) }
    );
  }
}
