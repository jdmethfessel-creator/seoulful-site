import { notFound, redirect } from "next/navigation";

// URL-prefix dupe lookup. When a user pastes a retailer URL after the
// kDupe domain (e.g. kdupe.co/sephora.com/product/tatcha-water-cream-p420652),
// the slug segments arrive here as ['sephora.com', 'product', 'tatcha-...'].
// We pull the product name out of the last path segment and redirect to
// /search.

export default async function UrlPrefixPage(
  props: PageProps<"/[...slug]">
) {
  const { slug } = await props.params;

  const productName = extractProductName(slug);
  if (!productName) notFound();

  redirect(`/search?q=${encodeURIComponent(productName)}`);
}

function extractProductName(slug: string[] | undefined): string | null {
  if (!slug || slug.length === 0) return null;

  // First segment must look like a domain (contains a dot). Strip an
  // optional "www." prefix; anything else without a dot isn't a URL.
  const first = slug[0].toLowerCase().replace(/^www\./, "");
  if (!first.includes(".")) return null;

  // Need at least one path segment after the domain to have a product.
  if (slug.length < 2) return null;

  // Take the last non-empty path segment as the product candidate.
  let last = "";
  for (let i = slug.length - 1; i >= 1; i--) {
    if (slug[i] && slug[i].trim()) {
      last = slug[i];
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
