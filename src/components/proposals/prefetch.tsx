"use client";

/**
 * Warm the routes someone is most likely to open next — the latest proposals —
 * so tapping one feels instant instead of waiting on a server render.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PrefetchProposals({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();

  useEffect(() => {
    for (const href of hrefs) router.prefetch(href);
  }, [router, hrefs]);

  return null;
}
