import { notFound, redirect } from "next/navigation";

// URL-prefix dupe lookup. When a user pastes a retailer URL after the
// kDupe domain (e.g. kdupe.co/sephora.com/product/tatcha-water-cream-p420652),
// the slug segments arrive here as ['sephora.com', 'product', 'tatcha-...'].
// We pull the product name out of the last path segment and redirect to
// /search.
//
// Amazon URLs are handled separately: mobile / short Amazon URLs
// (kdupe.co/https://www.amazon.com/gp/aw/d/B0CB9D3Y2Q/...) carry only
// an ASIN, no readable product name. We resolve the ASIN to the real
// product title server-side before redirecting.

// amazon.com, .co.uk, .ca, .de, .fr, .it, .es, .co.jp, .com.au, .in, etc.
const AMAZON_HOST_RE =
  /(^|\.)amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in|com\.mx|com\.br|nl|se|pl|sg|ae|sa)$/i;

export default async function UrlPrefixPage(
  props: PageProps<"/[...slug]">
) {
  const { slug } = await props.params;

  const parts = normalizeSlug(slug);
  if (!parts) notFound();

  // Amazon special-case — ASIN lookup beats slug parsing because the
  // path usually has no human-readable name. If we can't resolve the
  // ASIN, fall through to the generic extractor.
  if (AMAZON_HOST_RE.test(parts[0])) {
    const asin = extractAsin(parts);
    if (asin) {
      const title = await fetchAmazonTitleFromAsin(asin);
      if (title) {
        redirect(`/search?q=${encodeURIComponent(title)}`);
      }
    }
  }

  const productName = extractProductNameFromParts(parts);
  if (!productName) notFound();

  redirect(`/search?q=${encodeURIComponent(productName)}`);
}

function normalizeSlug(slug: string[] | undefined): string[] | null {
  if (!slug || slug.length === 0) return null;

  // Drop empty segments (the "//" in https:// produces one) and strip a
  // leading "http:" / "https:" so a pasted full URL is normalized down
  // to [host, ...path].
  let parts = slug.filter((s) => s && s.length > 0);
  if (parts.length > 0 && /^https?:$/i.test(parts[0])) {
    parts = parts.slice(1);
  }
  if (parts.length === 0) return null;

  // Normalize the host: lowercase and strip an optional "www." prefix.
  parts[0] = parts[0].toLowerCase().replace(/^www\./, "");

  // First segment must look like a domain (contains a dot).
  if (!parts[0].includes(".")) return null;

  // Need at least one path segment after the domain.
  if (parts.length < 2) return null;

  return parts;
}

function extractAsin(parts: string[]): string | null {
  // ASINs are exactly 10 chars, uppercase letters + digits. They sit
  // after /dp/, /gp/product/, /gp/aw/d/, /exec/obidos/ASIN/, or as a
  // segment inside a /Product-Name/dp/ASIN path. Walk every path
  // segment and pick the first one that matches.
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    if (/^[A-Z0-9]{10}$/i.test(seg) && /\d/.test(seg)) {
      return seg.toUpperCase();
    }
  }
  return null;
}

async function fetchAmazonTitleFromAsin(asin: string): Promise<string | null> {
  // Amazon will sometimes return a CAPTCHA or robot-check page to
  // server fetches. We pass a real browser UA + Accept headers; if the
  // response still doesn't have a parseable productTitle / <title>,
  // we give up and let the caller fall back to slug-based extraction.
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

    // Canonical product title span — present on most product pages.
    const titleSpan = html.match(
      /<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i
    );
    if (titleSpan && titleSpan[1]) {
      const cleaned = cleanHtmlText(titleSpan[1]);
      if (cleaned) return cleaned;
    }

    // Fallback: <title>Amazon.com: <product>: Category</title>.
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTag && titleTag[1]) {
      const raw = cleanHtmlText(titleTag[1]);
      const stripped = raw
        .replace(/^Amazon[^:]*:\s*/i, "") // "Amazon.com:" / "Amazon.co.uk:"
        .replace(/\s*:\s*[^:]+$/i, "") // trailing ": Beauty & Personal Care"
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
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x?[0-9a-f]+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProductNameFromParts(parts: string[]): string | null {
  // Take the last non-empty path segment as the product candidate.
  let last = "";
  for (let i = parts.length - 1; i >= 1; i--) {
    if (parts[i] && parts[i].trim()) {
      last = parts[i];
      break;
    }
  }
  if (!last) return null;

  // Strip a trailing file extension (.html, .htm, .aspx, .php, .jsp).
  last = last.replace(/\.(html?|aspx?|php|jsp)$/i, "");

  // Normalize separators to spaces.
  const words = last
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  // Drop trailing SKU-ish tokens: p420652, 420652, sku123, 123abc.
  while (words.length > 1 && isIdToken(words[words.length - 1])) {
    words.pop();
  }

  const name = words.join(" ").trim();
  if (!name) return null;

  return titleCase(name);
}

function isIdToken(token: string): boolean {
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
  return s
    .split(" ")
    .map((w) =>
      w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w
    )
    .join(" ");
}
