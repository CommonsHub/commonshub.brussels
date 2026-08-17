import { NextResponse } from "next/server";

/**
 * Read the public face of an event page — og:title, og:description, and the
 * start date when the page carries one (Luma, Eventbrite and Meetup all put
 * the event in JSON-LD). Not being able to read a page is a normal outcome,
 * not an error: the response just says so and the person types it themselves.
 */

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 600_000;

function blocked(hostname: string): boolean {
  // No fetching ourselves into private space.
  if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname)) return true;
  if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return true;
  return false;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, key: string): string | null {
  // property/name before content, and the other way around — pages do both.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return null;
}

interface LdEvent {
  startDate?: string;
  endDate?: string;
  name?: string;
  description?: string;
}

function eventFromJsonLd(html: string): LdEvent | null {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] ?? [])];
      for (const node of candidates) {
        const type = node?.["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t) => typeof t === "string" && /event/i.test(t))) {
          return node as LdEvent;
        }
      }
    } catch {
      /* malformed blocks are common; keep looking */
    }
  }
  return null;
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return NextResponse.json({ found: false, reason: "not-a-url" });
  }
  if (!/^https?:$/.test(target.protocol) || blocked(target.hostname)) {
    return NextResponse.json({ found: false, reason: "not-a-url" });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some event platforms answer bots with a stub; a browser UA gets the real page.
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        Accept: "text/html",
      },
    });
    clearTimeout(timer);

    if (!response.ok) return NextResponse.json({ found: false, reason: "unreachable" });
    const html = (await response.text()).slice(0, MAX_BYTES);

    const ld = eventFromJsonLd(html);
    const title =
      ld?.name ??
      metaContent(html, "og:title") ??
      decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "");
    const description =
      ld?.description ?? metaContent(html, "og:description") ?? metaContent(html, "description");

    let start: string | null = null;
    let end: string | null = null;
    const startRaw = ld?.startDate ?? metaContent(html, "event:start_time");
    const endRaw = ld?.endDate ?? metaContent(html, "event:end_time");
    if (startRaw && !Number.isNaN(new Date(startRaw).getTime())) {
      start = new Date(startRaw).toISOString();
    }
    if (endRaw && !Number.isNaN(new Date(endRaw).getTime())) {
      end = new Date(endRaw).toISOString();
    }

    if (!title && !description && !start) {
      return NextResponse.json({ found: false, reason: "nothing-readable" });
    }

    return NextResponse.json({
      found: true,
      source: target.hostname.replace(/^www\./, ""),
      title: title || null,
      description: description || null,
      start,
      end,
    });
  } catch {
    return NextResponse.json({ found: false, reason: "unreachable" });
  }
}
