import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { DATA_DIR } from "./data-paths";
import { NextResponse } from "next/server";
import {
  SIZE_CONFIG,
  type ImageSize,
  resolveRequestedImageSize,
} from "./image-size";
export { SIZE_CONFIG, type ImageSize, resolveRequestedImageSize } from "./image-size";

// Cache images for 30 days
export const CACHE_DURATION = 60 * 60 * 24 * 30;

let resolvedCacheDir: string | null | undefined;
let loggedCacheDir: string | null = null;

function ensureWritableDirectory(dir: string): boolean {
  try {
    if (fs.existsSync(dir)) {
      if (!fs.statSync(dir).isDirectory()) {
        return false;
      }
    } else {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function getImageCacheDir(): string | null {
  if (resolvedCacheDir !== undefined) {
    return resolvedCacheDir;
  }

  const preferredDataDir = path.join(DATA_DIR, "tmp");
  const candidates = [
    process.env.IMAGE_PROXY_CACHE_DIR,
    preferredDataDir,
    path.join(os.tmpdir(), "commonshub-image-proxy"),
  ].filter(Boolean) as string[];

  const seen = new Set<string>();

  for (const candidate of candidates) {
    const resolvedCandidate = path.resolve(candidate);
    if (seen.has(resolvedCandidate)) continue;
    seen.add(resolvedCandidate);

    if (!ensureWritableDirectory(resolvedCandidate)) {
      continue;
    }

    resolvedCacheDir = resolvedCandidate;

    if (loggedCacheDir !== resolvedCandidate) {
      if (resolvedCandidate === path.resolve(preferredDataDir)) {
        console.log(`[resize] Using cache dir: ${resolvedCandidate}`);
      } else {
        console.warn(
          `[resize] DATA_DIR/tmp is not writable, using fallback cache dir: ${resolvedCandidate}`
        );
      }
      loggedCacheDir = resolvedCandidate;
    }

    return resolvedCacheDir;
  }

  resolvedCacheDir = null;
  if (loggedCacheDir !== "__disabled__") {
    console.warn(
      `[resize] No writable image cache directory available. Resized images will be served without disk caching.`
    );
    loggedCacheDir = "__disabled__";
  }
  return null;
}

/**
 * Resize an image and cache it
 * @param sourceBuffer - Source image buffer
 * @param imageId - Unique identifier for the image (attachmentId or hash of URL)
 * @param size - Target size (xs, sm, md, lg)
 * @returns Buffer of resized image
 */
export async function resizeAndCacheImage(
  sourceBuffer: Buffer,
  imageId: string,
  size: ImageSize
): Promise<Buffer> {
  const cacheDir = getImageCacheDir();
  const cachedPath = cacheDir ? path.join(cacheDir, `${imageId}-${size}.jpg`) : null;

  // Check if cached version exists
  if (cachedPath && fs.existsSync(cachedPath)) {
    console.log(`[resize] Serving cached ${size} image:`, cachedPath);
    return fs.readFileSync(cachedPath);
  }

  // Resize the image
  const maxWidth = SIZE_CONFIG[size];
  console.log(`[resize] Resizing image to ${size} (maxWidth: ${maxWidth}px)`);

  const resizedBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize(maxWidth, undefined, {
      width: maxWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Cache the resized image
  if (cachedPath) {
    try {
      fs.writeFileSync(cachedPath, resizedBuffer);
      console.log(`[resize] Cached ${size} image:`, cachedPath);
    } catch (error) {
      console.warn(`[resize] Failed to cache ${size} image at ${cachedPath}:`, error);
    }
  }

  return resizedBuffer;
}

/**
 * Fetch and process an external image
 * @param url - Image URL to fetch
 * @param sizeParam - Optional size parameter for resizing
 * @returns NextResponse with image data
 */
export async function fetchAndProcessExternalImage(
  url: string,
  sizeParam: ImageSize | null
): Promise<NextResponse> {
  // Allowed domains for external image proxying
  const allowedDomains = [
    "framerusercontent.com",
    "framer.com",
    "commonshub.brussels",
    "cdn.discordapp.com",
    "media.discordapp.net",
    "images.lumacdn.com",
    "lumacdn.com",
    "og.luma.com",
    "cdn.lu.ma",
    "lu.ma",
    "luma.com",
    "img.evbuc.com",
    "eventbrite.com",
    "cdn.evbuc.com",
    "evbuc.com",
    "secure.meetupstatic.com",
    "meetupstatic.com",
    "meetup.com",
    "images.unsplash.com",
    "unsplash.com",
    "pbs.twimg.com",
    "twimg.com",
    "twitter.com",
    "x.com",
    // Additional common image CDNs
    "res.cloudinary.com",
    "cloudinary.com",
    "imgix.net",
    "amazonaws.com",
    "googleusercontent.com",
    "storage.googleapis.com",
  ];

  try {
    const parsedUrl = new URL(url);

    const isAllowed = allowedDomains.some((domain) =>
      parsedUrl.hostname.endsWith(domain)
    );

    if (!isAllowed) {
      console.log("[image-proxy] Domain not allowed:", parsedUrl.hostname);
      return NextResponse.json(
        { error: "Domain not allowed" },
        { status: 403 }
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CommonsHubBot/1.0)",
      },
    });

    if (!response.ok) {
      console.log("[image-proxy] Failed to fetch image, status:", response.status);
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: response.status }
      );
    }

    let contentType = response.headers.get("content-type") || "image/png";
    let buffer: Buffer = Buffer.from(await response.arrayBuffer());

    // Apply resizing if size parameter is provided
    if (sizeParam && SIZE_CONFIG[sizeParam]) {
      // Create a hash of the URL to use as imageId
      const imageId = crypto.createHash("md5").update(url).digest("hex");
      buffer = await resizeAndCacheImage(buffer, imageId, sizeParam);
      contentType = "image/jpeg"; // Resized images are always JPEG
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[image-proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy image" },
      { status: 500 }
    );
  }
}
