import { notFound, redirect } from "next/navigation";

// URL-prefix dupe lookup. Two paste shapes are supported:
//
//   1. Full URL with scheme:
//        kdupe.co/https://www.amazon.com/gp/aw/d/B0CB9D3Y2Q/...
//      Next.js splits the path on "/" and collapses the "//" in the
//      scheme separator, so the slug arrives as
//        ['https:', 'www.amazon.com', 'gp', 'aw', 'd', 'B0CB9D3Y2Q', ...]
//      We re-join the segments with "/", re-insert the lost slash
//      after the scheme, and feed the result to the URL constructor.
//
//   2. Bare host + path (no scheme):
//        kdupe.co/sephora.com/product/tatcha-water-cream-p420652
//      Treated as [host, ...path] directly.
//
// Amazon URLs of either shape are handled with an extra pre-check:
// the ASIN is pulled from the path and used to fetch the canonical
// product title so we don't redirect to /search with garbage like
// "B0CB9D3Y2Q".

// amazon.com, .co.uk, .ca, .de, .fr, .it, .es, .co.jp, .com.au, .in, etc.
const AMAZON_HOST_RE =
  /(^|\.)amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in|com\.mx|com\.br|nl|se|pl|sg|ae|sa)$/i;

export default async function UrlPrefixPage(
  props: PageProps<"/[...slug]">
) {
  const { slug } = await props.params;

  // Sanitize once so a stray undefined never reaches downstream
  // helpers (catch-all routes always provide a string[], but guard
  // anyway).
  const safeSlug = Array.isArray(slug)
    ? slug.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];

  if (safeSlug.length === 0) notFound();

  // Path A: the user pasted a full URL with scheme. Reconstruct +
  // parse with URL, then run the Amazon pre-check + last-segment
  // product-name extraction on the parsed pathname.
  const pasted = reconstructPastedUrl(safeSlug);
  if (pasted) {
    const host = pasted.hostname.toLowerCase().replace(/^www\./, "");

    if (AMAZON_HOST_RE.test(host)) {
      const asin = extractAsinFromPath(pasted.pathname);
      if (asin) {
        const title = await fetchAmazonTitleFromAsin(asin);
        if (typeof title === "string" && title.length > 0) {
          redirect(`/search?q=${encodeURIComponent(title)}`);
        }
      }
    }

    const productName = extractProductNameFromPath(pasted.pathname);
    if (typeof productName === "string" && productName.length > 0) {
      redirect(`/search?q=${encodeURIComponent(productName)}`);
    }

    notFound();
  }

  // Path B: bare host + path with no scheme. Use the original
  // slug-as-[host, ...path] extractor.
  const productName = extractProductName(safeSlug);
  if (typeof productName !== "string" || productName.length === 0) {
    notFound();
  }

  redirect(`/search?q=${encodeURIComponent(productName)}`);
}

// ---------- URL reconstruction ----------

function reconstructPastedUrl(slug: string[]): URL | null {
  if (!Array.isArray(slug) || slug.length === 0) return null;

  // Join all segments back together; Next.js split them on "/" and
  // dropped the empty piece that "//" produces, so we have
  // 'https:/www.amazon.com/...' with one slash after the scheme.
  let joined = slug.join("/");
  if (typeof joined !== "string" || joined.length === 0) return null;

  // Re-expand the scheme separator (https:/ → https://).
  joined = joined.replace(/^(https?:)\/(?!\/)/i, "$1//");

  if (!/^https?:\/\//i.test(joined)) return null;

  try {
    return new URL(joined);
  } catch {
    return null;
  }
}

// ---------- URL-pathname extractors ----------

function extractAsinFromPath(pathname: string): string | null {
  if (typeof pathname !== "string" || pathname.length === 0) return null;
  const segments = pathname
    .split("/")
    .filter((s) => typeof s === "string" && s.length > 0);
  for (const seg of segments) {
    if (/^[A-Z0-9]{10}$/i.test(seg) && /\d/.test(seg)) {
      return seg.toUpperCase();
    }
  }
  return null;
}

function extractProductNameFromPath(pathname: string): string | null {
  if (typeof pathname !== "string" || pathname.length === 0) return null;
  const segments = pathname
    .split("/")
    .filter((s) => typeof s === "string" && s.length > 0);
  if (segments.length === 0) return null;
  return productNameFromSegment(segments[segments.length - 1]);
}

// ---------- Bare slug extractor (Path B) ----------

function extractProductName(slug: string[]): string | null {
  if (!Array.isArray(slug) || slug.length === 0) return null;

  let parts = slug.filter(
    (s): s is string => typeof s === "string" && s.length > 0
  );
  // Drop a stray scheme segment in case reconstruction fell through
  // (e.g. someone pasted "http:" with no host after).
  if (parts.length > 0 && /^https?:$/i.test(parts[0])) {
    parts = parts.slice(1);
  }
  if (parts.length === 0) return null;

  const host0 = parts[0];
  if (typeof host0 !== "string") return null;
  parts[0] = host0.toLowerCase().replace(/^www\./, "");

  // First segment must look like a domain (contains a dot).
  if (!parts[0].includes(".")) return null;

  // Need at least one path segment after the domain.
  if (parts.length < 2) return null;

  // Take the last non-empty path segment as the product candidate.
  let last = "";
  for (let i = parts.length - 1; i >= 1; i--) {
    const seg = parts[i];
    if (typeof seg === "string" && seg.trim()) {
      last = seg;
      break;
    }
  }
  if (!last) return null;

  return productNameFromSegment(last);
}

// ---------- Shared: turn a path segment into a product name ----------

function productNameFromSegment(segIn: string): string | null {
  if (typeof segIn !== "string" || segIn.length === 0) return null;

  // Strip a trailing file extension (.html, .htm, .aspx, .php, .jsp).
  let seg = segIn.replace(/\.(html?|aspx?|php|jsp)$/i, "");

  // Decode percent-encoded characters so "tatcha%20water" → "tatcha water".
  try {
    seg = decodeURIComponent(seg);
  } catch {
    // leave as-is on malformed sequences
  }

  // Normalize separators to spaces.
  const words = seg
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  // Drop trailing SKU-ish tokens: p420652, 420652, sku123, 123abc.
  while (words.length > 1 && isIdToken(words[words.length - 1] ?? "")) {
    words.pop();
  }

  const name = words.join(" ").trim();
  if (!name) return null;

  return titleCase(name);
}

function isIdToken(token: string): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  // Pure digits, an optional single-letter prefix + digits (p420652, i123),
  // or digits with a short alpha suffix (12345a). Plain words (no digits)
  // are never IDs.
  if (!/\d/.test(token)) return false;
  return (
    /^[a-z]?\d{2,}$/i.test(token) ||
    /^\d{2,}[a-z]?$/i.test(token) ||
    /^sku-?\d+$/i.test(token)
  );
}

function titleCase(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .split(" ")
    .map((w) =>
      w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w
    )
    .join(" ");
}

// ---------- Amazon title resolver ----------

async function fetchAmazonTitleFromAsin(asin: string): Promise<string | null> {
  if (typeof asin !== "string" || !/^[A-Z0-9]{10}$/.test(asin)) {
    return null;
  }
  // Amazon sometimes returns a CAPTCHA or robot-check page to server
  // fetches. We pass a real browser UA + Accept headers; if the
  // response doesn't carry a parseable productTitle / <title>, we
  // give up and let the caller fall back to slug-based extraction.
  try {
    const url = `https://www.amazon.com/dp/${asin}`;
    console.log("[url-prefix] fetching amazon title:", url);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn("[url-prefix] amazon non-2xx:", res.status, asin);
      return null;
    }
    const html = await res.text();
    if (typeof html !== "string" || html.length === 0) return null;

    const titleSpan = html.match(
      /<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i
    );
    if (titleSpan && typeof titleSpan[1] === "string") {
      const cleaned = cleanHtmlText(titleSpan[1]);
      if (cleaned) return cleaned;
    }

    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTag && typeof titleTag[1] === "string") {
      const raw = cleanHtmlText(titleTag[1]);
      const stripped = raw
        .replace(/^Amazon[^:]*:\s*/i, "")
        .replace(/\s*:\s*[^:]+$/i, "")
        .trim();
      if (stripped) return stripped;
    }

    console.warn("[url-prefix] amazon page had no title selector:", asin);
    return null;
  } catch (err) {
    console.warn(
      "[url-prefix] amazon fetch failed:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

function cleanHtmlText(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x?[0-9a-f]+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
