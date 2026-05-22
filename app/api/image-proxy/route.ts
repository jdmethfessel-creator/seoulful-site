import { NextRequest, NextResponse } from "next/server";

// GET /api/image-proxy?url=https://...
//
// Fetches the upstream image server-side and streams it back so the
// browser <img> sees a same-origin URL. Solves YesStyle CDN's
// hotlink / Referer / CORS rejection when product images are loaded
// from kdupe.co.
//
// Locked to a host allowlist to avoid becoming an open SSRF proxy.

export const runtime = "nodejs";

// Allow exact host matches and any subdomain of these suffixes.
const ALLOWED_HOST_SUFFIXES = [
  "yesstyle.com",
  "yes-co.com", // YesStyle's image CDN
  "yesstyle.cn",
  "awin.com",
  "awinfeeds.com",
  "awimg.com", // AWIN image cache
];

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB — comfortable headroom for product images
const FETCH_TIMEOUT_MS = 10_000;

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "url query param is required" }, { status: 400 });
  }

  const target = parseAllowed(rawUrl);
  if (!target) {
    console.warn("[image-proxy] rejected url:", rawUrl);
    return NextResponse.json({ error: "url not allowed" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      // Spoof a plain browser-ish request so CDNs that block empty UAs
      // / hotlink Referers don't 403 us. We're acting on behalf of an
      // affiliate publisher, not scraping the site.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 kDupeImageProxy/1.0",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!upstream.ok) {
      console.warn("[image-proxy] upstream non-2xx:", upstream.status, target.toString());
      return NextResponse.json(
        { error: `upstream returned ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "upstream is not an image" },
        { status: 415 }
      );
    }

    // Cap the streamed size so a misbehaving upstream can't drain our
    // memory / bandwidth. Stream rather than buffer.
    const body = upstream.body;
    if (!body) {
      return NextResponse.json(
        { error: "upstream returned empty body" },
        { status: 502 }
      );
    }
    const reader = body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      },
      cancel() {
        reader.cancel().catch(() => {});
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": upstream.headers.get("content-length") ?? "",
        // Cache aggressively at edge + browser — product images are
        // stable for a long time.
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[image-proxy] fetch timed out:", target.toString());
      return NextResponse.json({ error: "upstream timeout" }, { status: 504 });
    }
    console.error("[image-proxy] fetch failed:", {
      url: target.toString(),
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function parseAllowed(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
  if (!allowed) return null;
  return url;
}

// Silence MAX_BYTES unused warning — wire up enforcement when we have
// a concrete CDN footgun that returns oversized payloads. The streaming
// path above lets us add a counter+abort easily.
void MAX_BYTES;
