import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const requestedPath = pathSegments.join("/");

    // Security: Block access to private paths (any segment named "private")
    if (pathSegments.some((seg) => seg === "private")) {
      return NextResponse.json(
        { error: "Access to private data is not allowed" },
        { status: 403 }
      );
    }

    // Construct the full file path
    const filePath = path.join(DATA_DIR, requestedPath);

    // Security: Ensure the resolved path is within DATA_DIR
    const resolvedPath = path.resolve(filePath);
    const resolvedDataDir = path.resolve(DATA_DIR);
    if (!resolvedPath.startsWith(resolvedDataDir)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // If it's a directory, render a browsable index of its public entries.
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      return renderDirectoryListing(filePath, pathSegments);
    }

    // Read the file
    const fileContent = fs.readFileSync(filePath);

    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      ".json": "application/json",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".txt": "text/plain",
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
    };
    const contentType = contentTypeMap[ext] || "application/octet-stream";
    const isLocalDev =
      process.env.NODE_ENV !== "production" ||
      request.nextUrl.hostname === "localhost" ||
      request.nextUrl.hostname === "127.0.0.1";
    const cacheControl = isLocalDev
      ? "no-store, max-age=0"
      : "public, max-age=3600";

    // Return the file with appropriate headers
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    console.error("Error serving data file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === "\"" ? "&quot;" : "&#39;"
  );
}

function renderDirectoryListing(dirPath: string, pathSegments: string[]): NextResponse {
  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => !e.name.startsWith(".") && e.name !== "private")
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const urlPrefix = "/data/" + pathSegments.map(encodeURIComponent).join("/");
  const parentUrl =
    pathSegments.length > 1
      ? "/data/" + pathSegments.slice(0, -1).map(encodeURIComponent).join("/")
      : null;

  const rows = entries.map((entry) => {
    const isDir = entry.isDirectory();
    const name = entry.name + (isDir ? "/" : "");
    const href = `${urlPrefix}/${encodeURIComponent(entry.name)}`;
    let size = "";
    if (!isDir) {
      try {
        size = formatSize(fs.statSync(path.join(dirPath, entry.name)).size);
      } catch {
        size = "";
      }
    }
    return `<tr><td><a href="${escapeHtml(href)}">${escapeHtml(name)}</a></td><td class="size">${size}</td></tr>`;
  });

  const title = `/data/${pathSegments.join("/")}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Index of ${escapeHtml(title)}</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 2rem; max-width: 60rem; margin: auto; }
  h1 { font-size: 1.1rem; font-weight: 600; margin: 0 0 1rem; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0.25rem 0.5rem; border-bottom: 1px solid #eee; }
  td.size { text-align: right; color: #888; width: 8rem; }
  a { text-decoration: none; color: #0366d6; }
  a:hover { text-decoration: underline; }
  .up { margin-bottom: 0.5rem; display: inline-block; }
</style>
</head>
<body>
<h1>Index of ${escapeHtml(title)}</h1>
${parentUrl ? `<a class="up" href="${escapeHtml(parentUrl)}">../</a>` : ""}
<table>
${rows.join("\n")}
</table>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
