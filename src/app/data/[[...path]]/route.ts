import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { timingSafeEqual } from "crypto";
import { DATA_DIR } from "@/lib/data-paths";

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{2}$/;

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
};

type ListEntry = { name: string; href: string; size: string };

type Resolved =
  | { kind: "root" }
  | { kind: "year"; year: string }
  | { kind: "deep"; fsPath: string };

function resolve(segments: string[]): Resolved | null {
  if (segments.some((s) => s === "private" || s === "generated" || s === "..")) {
    return null;
  }

  if (segments.length === 0) return { kind: "root" };

  const [first, second, ...rest] = segments;

  if (first === "latest") {
    return {
      kind: "deep",
      fsPath: path.join(DATA_DIR, "latest", "generated", ...segments.slice(1)),
    };
  }

  if (YEAR_RE.test(first)) {
    if (segments.length === 1) return { kind: "year", year: first };
    if (MONTH_RE.test(second)) {
      return {
        kind: "deep",
        fsPath: path.join(DATA_DIR, first, second, "generated", ...rest),
      };
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const authResult = checkBasicAuth(request);
    if (authResult) return authResult;

    const segments = (await params).path ?? [];
    const resolved = resolve(segments);
    if (!resolved) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (resolved.kind === "root") return renderRoot();
    if (resolved.kind === "year") return renderYear(resolved.year);
    return renderDeep(request, resolved.fsPath, segments);
  } catch (error) {
    console.error("Error serving data file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Gate every /data/* response behind HTTP Basic Auth. Returns a response to
 * short-circuit the handler when auth is missing/invalid, or null to continue.
 */
function checkBasicAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new NextResponse(
      "ADMIN_PASSWORD environment variable is not set on the server. " +
        "Set it (e.g. in .env) to enable access to /data/*.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6).trim(), "base64").toString(
        "utf-8"
      );
      const sepIndex = decoded.indexOf(":");
      const user = sepIndex >= 0 ? decoded.slice(0, sepIndex) : decoded;
      const pass = sepIndex >= 0 ? decoded.slice(sepIndex + 1) : "";
      if (user === "admin" && constantTimeEqual(pass, expected)) {
        return null;
      }
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="commonshub-data", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ab.length !== bb.length) {
    // still spend the comparison cost to avoid leaking length via timing
    const max = Math.max(ab.length, bb.length);
    const padA = Buffer.alloc(max);
    const padB = Buffer.alloc(max);
    ab.copy(padA);
    bb.copy(padB);
    timingSafeEqual(padA, padB);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function renderRoot(): NextResponse {
  if (!fs.existsSync(DATA_DIR)) {
    return renderListing("/data", null, []);
  }
  const names = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter(
      (e) => e.isDirectory() && (e.name === "latest" || YEAR_RE.test(e.name))
    )
    .map((e) => e.name)
    .sort((a, b) =>
      a === "latest" ? -1 : b === "latest" ? 1 : a.localeCompare(b)
    );
  const entries: ListEntry[] = names.map((n) => ({
    name: `${n}/`,
    href: `/data/${encodeURIComponent(n)}`,
    size: "",
  }));
  return renderListing("/data", null, entries);
}

function renderYear(year: string): NextResponse {
  const yearDir = path.join(DATA_DIR, year);
  if (!fs.existsSync(yearDir) || !fs.statSync(yearDir).isDirectory()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const months = fs
    .readdirSync(yearDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && MONTH_RE.test(e.name))
    .map((e) => e.name)
    .sort();
  const url = `/data/${year}`;
  const entries: ListEntry[] = months.map((m) => ({
    name: `${m}/`,
    href: `${url}/${m}`,
    size: "",
  }));
  return renderListing(url, "/data", entries);
}

function renderDeep(
  request: NextRequest,
  fsPath: string,
  urlSegments: string[]
): NextResponse {
  const resolvedFsPath = path.resolve(fsPath);
  const resolvedDataDir = path.resolve(DATA_DIR);
  if (
    resolvedFsPath !== resolvedDataDir &&
    !resolvedFsPath.startsWith(resolvedDataDir + path.sep)
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  if (!fs.existsSync(fsPath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stats = fs.statSync(fsPath);
  if (stats.isDirectory()) {
    const url = "/data/" + urlSegments.map(encodeURIComponent).join("/");
    const parentUrl =
      urlSegments.length > 1
        ? "/data/" + urlSegments.slice(0, -1).map(encodeURIComponent).join("/")
        : "/data";
    const entries: ListEntry[] = fs
      .readdirSync(fsPath, { withFileTypes: true })
      .filter((e) => !e.name.startsWith(".") && e.name !== "private")
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((e) => {
        const isDir = e.isDirectory();
        return {
          name: e.name + (isDir ? "/" : ""),
          href: `${url}/${encodeURIComponent(e.name)}`,
          size: isDir ? "" : safeFormatSize(path.join(fsPath, e.name)),
        };
      });
    return renderListing(url, parentUrl, entries);
  }

  const fileContent = fs.readFileSync(fsPath);
  const ext = path.extname(fsPath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const isLocalDev =
    process.env.NODE_ENV !== "production" ||
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";
  return new NextResponse(fileContent, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": isLocalDev ? "no-store, max-age=0" : "public, max-age=3600",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function safeFormatSize(filePath: string): string {
  try {
    return formatSize(fs.statSync(filePath).size);
  } catch {
    return "";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
      ? "&lt;"
      : c === ">"
      ? "&gt;"
      : c === "\""
      ? "&quot;"
      : "&#39;"
  );
}

function renderListing(
  url: string,
  parentUrl: string | null,
  entries: ListEntry[]
): NextResponse {
  const rows = entries
    .map(
      (e) =>
        `<tr><td><a href="${escapeHtml(e.href)}">${escapeHtml(e.name)}</a></td><td class="size">${e.size}</td></tr>`
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Index of ${escapeHtml(url)}</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 2rem; max-width: 60rem; margin: auto; }
  h1 { font-size: 1.1rem; font-weight: 600; margin: 0 0 1rem; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0.25rem 0.5rem; border-bottom: 1px solid #eee; }
  td.size { text-align: right; color: #888; width: 8rem; }
  a { text-decoration: none; color: #0366d6; }
  a:hover { text-decoration: underline; }
  .up { margin-bottom: 0.5rem; display: inline-block; }
  .empty { color: #888; font-style: italic; }
</style>
</head>
<body>
<h1>Index of ${escapeHtml(url)}</h1>
${parentUrl ? `<a class="up" href="${escapeHtml(parentUrl)}">../</a>` : ""}
${entries.length === 0 ? '<p class="empty">(empty)</p>' : `<table>${rows}</table>`}
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
