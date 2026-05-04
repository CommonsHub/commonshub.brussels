import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { fromZonedTime } from "date-fns-tz";
import { DATA_DIR } from "@/lib/data-paths";

export const revalidate = 300;

interface ExportEvent {
  id?: string;
  name?: string;
  description?: string;
  startAt?: string;
  start_at?: string;
  endAt?: string;
  end_at?: string;
  url?: string;
  coverImage?: string;
  cover_url?: string;
  coverImageLocal?: string;
}

const BRUSSELS_TIME_ZONE = "Europe/Brussels";
const DEFAULT_BASE_URL = "https://commonshub.brussels";

function parseDateParts(value: string | null):
  | { year: number; month: number; day: number }
  | null {
  if (!value || !/^\d{8}$/.test(value)) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function datePartsToParam({
  year,
  month,
  day,
}: {
  year: number;
  month: number;
  day: number;
}): string {
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(
    2,
    "0"
  )}`;
}

function getTodayParam(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRUSSELS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return datePartsToParam({
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  });
}

function addCalendarDays(value: string, days: number): string {
  const parts = parseDateParts(value);
  if (!parts) return value;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);

  return datePartsToParam({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function parseBoundary(
  value: string | null,
  boundary: "start" | "end"
): Date | null {
  const parts = parseDateParts(value);
  if (!parts) return null;

  const time = boundary === "start" ? "00:00:00.000" : "23:59:59.999";

  return fromZonedTime(
    `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(
      2,
      "0"
    )}-${String(parts.day).padStart(2, "0")}T${time}`,
    BRUSSELS_TIME_ZONE
  );
}

function getBaseUrl(request: Request): string {
  const envBaseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;

  if (envBaseUrl) {
    const normalized = envBaseUrl.startsWith("http")
      ? envBaseUrl
      : `https://${envBaseUrl}`;

    try {
      const url = new URL(normalized);
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        return url.origin;
      }
    } catch {
      return DEFAULT_BASE_URL;
    }
  }

  try {
    const requestUrl = new URL(request.url);
    if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
      return DEFAULT_BASE_URL;
    }
    return requestUrl.origin;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function getOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function getDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRUSSELS_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).formatToParts(date);

  return {
    weekday: parts.find((part) => part.type === "weekday")?.value || "",
    month: parts.find((part) => part.type === "month")?.value || "",
    day: Number(parts.find((part) => part.type === "day")?.value || "0"),
  };
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BRUSSELS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatEventDateTime(startAt: string, endAt?: string): string {
  const start = new Date(startAt);
  const { weekday, month, day } = getDateParts(start);
  const startTime = formatTime(start);

  if (!endAt) {
    return `${weekday} ${month} ${getOrdinal(day)}, ${startTime}`;
  }

  return `${weekday} ${month} ${getOrdinal(day)}, ${startTime} - ${formatTime(
    new Date(endAt)
  )}`;
}

function normalizeMarkdownText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function linkifyBareUrls(value: string): string {
  return value.replace(
    /(^|[\s(])(https?:\/\/[^\s)]+)(?=[\s).,!?:;]*|$)/g,
    (match, prefix: string, url: string) => {
      const trailing = url.match(/[.,!?:;]+$/)?.[0] || "";
      const cleanUrl = trailing ? url.slice(0, -trailing.length) : url;
      return `${prefix}[${cleanUrl}](${cleanUrl})${trailing}`;
    }
  );
}

function getCoverImageUrl(event: ExportEvent, baseUrl: string): string {
  if (event.coverImageLocal) {
    return new URL(`/data/${event.coverImageLocal}`, baseUrl).toString();
  }

  const coverImage = event.coverImage || event.cover_url || "";
  if (!coverImage) return "";

  try {
    return new URL(coverImage, baseUrl).toString();
  } catch {
    return "";
  }
}

function eventToMarkdown(event: ExportEvent, baseUrl: string): string {
  const startAt = event.startAt || event.start_at || "";
  const endAt = event.endAt || event.end_at || "";
  const title = normalizeMarkdownText(event.name || "Untitled event");
  const rsvpUrl = event.url || "";
  const coverImage = getCoverImageUrl(event, baseUrl);
  const description = linkifyBareUrls(
    normalizeMarkdownText(event.description || "")
  );
  const dateTime = formatEventDateTime(startAt, endAt);

  const lines = [`## ${title}`];

  if (coverImage) {
    lines.push(`![cover image](${coverImage})`);
  }

  lines.push(
    `**${dateTime}${rsvpUrl ? ` | [RSVP](${rsvpUrl})` : ""}**${
      description ? `  ${description}` : ""
    }`
  );

  return lines.join("\n");
}

function loadEvents(): ExportEvent[] {
  const eventsPath = path.join(DATA_DIR, "latest", "generated", "events.json");
  const content = fs.readFileSync(eventsPath, "utf-8");
  const data = JSON.parse(content);
  return Array.isArray(data.events) ? data.events : [];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdownToHtml(markdown: string, since: string, until: string): string {
  const body = markdown
    .split(/\n{3,}/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      const renderedLines = lines
        .map((line) => {
          const heading = line.match(/^##\s+(.+)$/);
          if (heading) {
            return `<h2>${renderInlineMarkdown(heading[1])}</h2>`;
          }

          const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
          if (image) {
            const alt = escapeHtml(image[1] || "cover image");
            const src = escapeHtml(image[2]);
            return `<img src="${src}" alt="${alt}" loading="lazy" />`;
          }

          return `<p>${renderInlineMarkdown(line)}</p>`;
        })
        .join("\n");

      return `<article>${renderedLines}</article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Events export ${since} - ${until}</title>
  <style>
    :root {
      color-scheme: light;
      --background: #FAF4EF;
      --foreground: #2B1E1C;
      --muted: #60514F;
      --border: #E2D5CB;
      --card: #FFFFFF;
      --primary: #FF4C02;
    }
    body {
      margin: 0;
      background: var(--background);
      color: var(--foreground);
      font-family: "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
    }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 48px 20px;
    }
    header {
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 32px;
      line-height: 1.15;
    }
    .meta {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }
    article {
      margin: 0 0 40px;
      padding: 0 0 36px;
      border-bottom: 1px solid var(--border);
    }
    article:last-child {
      border-bottom: 0;
    }
    h2 {
      margin: 0 0 14px;
      font-size: 26px;
      line-height: 1.2;
    }
    img {
      display: block;
      width: 100%;
      max-height: 380px;
      object-fit: cover;
      margin: 0 0 16px;
      border-radius: 8px;
      background: var(--card);
      border: 1px solid var(--border);
    }
    p {
      margin: 0;
      font-size: 17px;
    }
    strong {
      font-weight: 700;
    }
    a {
      color: var(--primary);
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Events export</h1>
      <p class="meta">Since ${escapeHtml(since)} until ${escapeHtml(until)}</p>
    </header>
    ${body || "<p>No events found for this date range.</p>"}
  </main>
</body>
</html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since") || getTodayParam();
  const untilParam = searchParams.get("until") || addCalendarDays(sinceParam, 30);
  const since = parseBoundary(sinceParam, "start");
  const until = parseBoundary(untilParam, "end");
  const format = searchParams.get("format") || "md";

  if (format !== "md" && format !== "html") {
    return NextResponse.json(
      { error: "Unsupported format. Use format=md or format=html." },
      { status: 400 }
    );
  }

  if (!since) {
    return NextResponse.json(
      { error: "Invalid since. Expected YYYYMMDD." },
      { status: 400 }
    );
  }

  if (!until) {
    return NextResponse.json(
      { error: "Invalid until. Expected YYYYMMDD." },
      { status: 400 }
    );
  }

  if (since > until) {
    return NextResponse.json(
      { error: "Invalid date range. since must be before or equal to until." },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl(request);
    const events = loadEvents()
      .filter((event) => {
        const startAt = event.startAt || event.start_at;
        if (!startAt) return false;

        const startDate = new Date(startAt);
        return startDate >= since && startDate <= until;
      })
      .sort((a, b) => {
        const aStart = new Date(a.startAt || a.start_at || "").getTime();
        const bStart = new Date(b.startAt || b.start_at || "").getTime();
        return aStart - bStart;
      });

    const markdown = events
      .map((event) => eventToMarkdown(event, baseUrl))
      .join("\n\n\n");

    if (format === "html") {
      return new NextResponse(
        renderMarkdownToHtml(markdown, sinceParam, untilParam),
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `inline; filename="events-since-${sinceParam}-until-${untilParam}.html"`,
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return new NextResponse(markdown ? `${markdown}\n` : "", {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `inline; filename="events-since-${sinceParam}-until-${untilParam}.md"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[events/export] Failed to export events:", error);
    return NextResponse.json(
      { error: "Failed to export events." },
      { status: 500 }
    );
  }
}
