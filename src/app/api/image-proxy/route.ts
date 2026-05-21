import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import {
  fetchAndProcessExternalImage,
  resizeAndCacheImage,
  type ImageSize,
  SIZE_CONFIG,
  CACHE_DURATION,
  resolveRequestedImageSize,
} from "@/lib/image-proxy-server";

function getCacheControl(request: NextRequest, localFile: boolean): string {
  const isLocalDev =
    process.env.NODE_ENV !== "production" ||
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";

  if (isLocalDev) return "no-store, max-age=0";
  const maxAge = localFile ? CACHE_DURATION * 7 : CACHE_DURATION;
  return `public, max-age=${maxAge}, s-maxage=${maxAge}`;
}

/**
 * Image Proxy API - Handles both local data paths and external image URLs
 *
 * Query parameters:
 * - url: Image URL or local path (e.g., /data/2025/11/channels/discord/images/123.jpg or /images/foo.jpg) (required)
 * - size: Optional size parameter (xs|sm|md|lg) for resizing
 *
 * Example: /api/image-proxy?url=/data/2025/11/channels/discord/images/123.jpg&size=sm
 * Example: /api/image-proxy?url=/images/chb-facade.avif&size=md
 * Example: /api/image-proxy?url=https://example.com/image.jpg&size=md
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const sizeParam = resolveRequestedImageSize(
    searchParams.get("size"),
    searchParams.get("w")
  );

  console.log("[image-proxy] Request - url:", url, "size:", sizeParam);

  if (!url) {
    return NextResponse.json(
      { error: "Missing required parameter: url" },
      { status: 400 }
    );
  }

  // Prevent recursive proxying - reject if URL is already a proxy URL
  if (url.includes("/api/image-proxy")) {
    console.log("[image-proxy] Rejected recursive proxy attempt:", url);
    return NextResponse.json(
      { error: "Cannot proxy a proxy URL" },
      { status: 400 }
    );
  }

  // Check if this is a local data path
  if (url.startsWith("/data/")) {
    return handleLocalPath(request, url, sizeParam, {
      rootDir: DATA_DIR,
      urlPrefix: "/data/",
    });
  }

  if (url.startsWith("/images/")) {
    return handleLocalPath(request, url, sizeParam, {
      rootDir: path.join(process.cwd(), "public"),
      urlPrefix: "/",
    });
  }

  // Otherwise, handle as external URL
  const response = await fetchAndProcessExternalImage(url, sizeParam);
  response.headers.set("Cache-Control", getCacheControl(request, false));
  return response;
}

/**
 * Handle local file paths rooted in a specific directory
 */
async function handleLocalPath(
  request: NextRequest,
  localPath: string,
  sizeParam: ImageSize | null,
  options: {
    rootDir: string;
    urlPrefix: string;
  }
): Promise<NextResponse> {
  try {
    const { rootDir, urlPrefix } = options;
    const normalizedPrefix = urlPrefix.endsWith("/") ? urlPrefix : `${urlPrefix}/`;
    const relativePath = localPath.replace(new RegExp(`^${normalizedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "");
    const absolutePath = path.join(rootDir, relativePath);

    console.log("[image-proxy] Serving local file:", absolutePath);

    // Security check - ensure path is within the configured root directory
    const resolvedRootDir = path.resolve(rootDir);
    const resolvedPath = path.resolve(absolutePath);
    if (!resolvedPath.startsWith(resolvedRootDir)) {
      console.log("[image-proxy] Security: Path outside data directory:", resolvedPath);
      console.log("[image-proxy] Expected to be within:", resolvedRootDir);
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.log("[image-proxy] File not found:", resolvedPath);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read the file
    let buffer: Buffer = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".avif": "image/avif",
    };
    let contentType = contentTypeMap[ext] || "image/jpeg";

    // Apply resizing if size parameter is provided
    if (sizeParam && SIZE_CONFIG[sizeParam]) {
      // Use filename without extension as imageId
      const imageId = path.basename(resolvedPath, ext);
      buffer = await resizeAndCacheImage(buffer, imageId, sizeParam);
      contentType = "image/jpeg"; // Resized images are always JPEG
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": getCacheControl(request, true),
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[image-proxy] Error serving local file:", error);
    return NextResponse.json(
      { error: "Failed to serve local file" },
      { status: 500 }
    );
  }
}
