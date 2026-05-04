import { NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync, statSync, accessSync, constants } from "fs";
import { join } from "path";
import { DATA_DIR } from "@/lib/data-paths";

// Store when the application started (runtime)
const startTime = new Date();

// Read git info at runtime (file is updated by entrypoint)
function getGitInfoRuntime() {
  const paths = [
    join(process.cwd(), 'git-info.json'),
    '/app/git-info.json',
  ];
  
  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf8');
        return JSON.parse(content);
      } catch { /* ignore */ }
    }
  }
  
  // Fallback to env vars
  return {
    sha: process.env.SOURCE_COMMIT || process.env.NEXT_PUBLIC_GIT_SHA || 'unknown',
    message: process.env.COOLIFY_BRANCH || process.env.NEXT_PUBLIC_GIT_MESSAGE || 'unknown',
    date: process.env.NEXT_PUBLIC_GIT_DATE || new Date().toISOString(),
  };
}

function getDataDirStatus() {
  const raw = process.env.DATA_DIR || null;
  const resolved = DATA_DIR;
  const exists = existsSync(resolved);

  let years: string[] = [];
  let readError: string | null = null;
  if (exists) {
    try {
      years = readdirSync(resolved, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
        .map((entry) => entry.name)
        .sort();
    } catch (error) {
      readError = error instanceof Error ? error.message : "Failed to read data directory";
    }
  }

  let writable = false;
  try {
    accessSync(resolved, constants.W_OK);
    writable = true;
  } catch {}

  const eventsPath = join(resolved, "latest", "generated", "events.json");
  let upcomingEvents = 0;
  let latestEventsUpdatedAt: string | null = null;
  if (existsSync(eventsPath)) {
    try {
      const data = JSON.parse(readFileSync(eventsPath, "utf8"));
      upcomingEvents = Array.isArray(data.events) ? data.events.length : 0;
      latestEventsUpdatedAt = statSync(eventsPath).mtime.toISOString();
    } catch {}
  }

  const syncStatePath = join(resolved, "sync-state.json");
  let lastSync: string | null = null;
  if (existsSync(syncStatePath)) {
    try {
      const syncState = JSON.parse(readFileSync(syncStatePath, "utf8"));
      lastSync = syncState.lastSync || null;
    } catch {}
  }

  return {
    raw,
    resolved,
    exists,
    writable,
    years,
    readError,
    stats: {
      yearCount: years.length,
      upcomingEvents,
      latestEventsUpdatedAt,
      lastSync,
    },
  };
}

function formatInTimezone(date: Date, timezone: string): string | null {
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return date.toLocaleString("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return date.toISOString();
  }
}

/**
 * Status JSON API - Shows application and deployment information
 *
 * GET /status.json
 *
 * Returns:
 * - Latest git commit SHA (captured at build time)
 * - Latest commit message (captured at build time)
 * - Commit datetime (captured at build time)
 * - Build time
 * - Application uptime
 * - Current server time
 *
 * HTML view available at /status
 */
export async function GET() {
  try {
    // Git info is read at runtime from git-info.json (updated by entrypoint)
    const gitInfo = getGitInfoRuntime();
    const sha = gitInfo.sha || "unknown";
    const shortSha = sha !== "unknown" ? sha.substring(0, 7) : "unknown";
    const message = gitInfo.message || "unknown";
    const commitDate = gitInfo.date || "";
    const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || "";
    const dataDir = getDataDirStatus();

    // Calculate uptime
    const now = new Date();
    const uptimeMs = now.getTime() - startTime.getTime();
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);

    // Format uptime as human-readable string
    let uptimeFormatted = "";
    if (uptimeDays > 0) {
      uptimeFormatted += `${uptimeDays}d `;
    }
    if (uptimeHours % 24 > 0 || uptimeDays > 0) {
      uptimeFormatted += `${uptimeHours % 24}h `;
    }
    if (uptimeMinutes % 60 > 0 || uptimeHours > 0) {
      uptimeFormatted += `${uptimeMinutes % 60}m `;
    }
    uptimeFormatted += `${uptimeSeconds % 60}s`;

    // Get timezone from environment or default to Europe/Brussels
    const timezone = process.env.TZ || "Europe/Brussels";

    const response = {
      status: "ok",
      ready: true,
      deployment: {
        sha: sha,
        shortSha: shortSha,
        message: message,
        commitDate: commitDate,
        commitDateFormatted: commitDate ? formatInTimezone(new Date(commitDate), timezone) : null,
      },
      build: {
        time: buildTime,
        timeFormatted: buildTime ? formatInTimezone(new Date(buildTime), timezone) : null,
      },
      uptime: {
        started: startTime.toISOString(),
        startedFormatted: formatInTimezone(startTime, timezone),
        uptime: uptimeFormatted,
        uptimeSeconds: uptimeSeconds,
      },
      server: {
        time: now.toISOString(),
        timeFormatted: formatInTimezone(now, timezone),
        timezone: timezone,
      },
      environment: process.env.NODE_ENV || "development",
      dataDir,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Status] Error generating status:", error);

    return NextResponse.json(
      {
        status: "degraded",
        ready: true,
        error: errorMessage,
        uptime: {
          started: startTime.toISOString(),
          uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
