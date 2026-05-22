import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No platform-level redirects.
  //
  // We previously had a "/:protocol(https?:)/:rest*" → "/:rest*" rule
  // to handle paste-the-full-URL prefixes like kdupe.co/https://www.sephora.com/...
  // but the App Router catch-all in app/[...slug]/page.tsx already
  // normalizes those by filtering empty segments and the leading
  // "http:" / "https:" token. Keeping a path-to-regexp redirect here
  // is a footgun for any path that could accidentally match — e.g.
  // /api/webhook returned 307 in prod, which silently broke Stripe
  // delivery (Stripe does not follow redirects).
};

export default nextConfig;
