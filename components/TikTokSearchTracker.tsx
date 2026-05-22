"use client";

import { useEffect } from "react";

// Renders nothing — exists only to fire a TikTok Pixel "Search" event
// once on mount with the user's query. Mounted by the server-rendered
// /search page only when a real dupe result is returned, so we don't
// log searches that 404 or land on the "already K-beauty" notice.
export default function TikTokSearchTracker({ query }: { query: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ttq = (
      window as unknown as {
        ttq?: { track?: (event: string, params?: Record<string, unknown>) => void };
      }
    ).ttq;
    if (typeof ttq?.track === "function") {
      ttq.track("Search", { query });
    }
  }, [query]);
  return null;
}
