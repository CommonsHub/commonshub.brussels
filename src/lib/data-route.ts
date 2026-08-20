/**
 * Caching rules for routes that read the chb dataset.
 *
 * `DATA_DIR` is a volume mounted at runtime. It does not exist during the
 * Docker build, so any route reading it that Next.js prerenders gets its
 * "no data" answer baked into the image — and then serves that to everyone
 * until the first revalidation. That is what put "No upcoming events at the
 * moment" on the homepage after a deploy while /events.md, which already
 * opted out of prerendering, was fine.
 *
 * Two rules follow:
 *
 *   1. Never prerender. Every such route exports `dynamic = "force-dynamic"`
 *      written as a literal — Next.js parses that field at build time and
 *      silently ignores it unless it is a plain string, so it cannot be
 *      shared through a constant.
 *
 *   2. Never cache an absence for long. A good answer is worth caching for
 *      minutes; "I found nothing" is usually a deploy that raced the volume,
 *      or a pipeline that has not run yet, and is worth seconds at most.
 */

/** A real answer stays fresh for this long. */
export const FULL_CACHE_SECONDS = 300;

/** An empty or failed answer is retried almost immediately. */
export const EMPTY_CACHE_SECONDS = 10;

export function cacheSecondsFor(hasContent: boolean): number {
  return hasContent ? FULL_CACHE_SECONDS : EMPTY_CACHE_SECONDS;
}

/**
 * Cache-Control for a dataset response. Pass whether the response actually
 * carries data; an empty or error response gets the short window.
 */
export function dataCacheHeaders(hasContent: boolean): Record<string, string> {
  const seconds = cacheSecondsFor(hasContent);
  return {
    "Cache-Control": `public, max-age=${seconds}, s-maxage=${seconds}`,
  };
}
