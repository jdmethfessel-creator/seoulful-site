// AWIN YesStyle product search.
//
// Uses the publisher /products/?search= endpoint to look up matching
// YesStyle products by keyword. Each dupe card fires one small JSON
// request rather than downloading the 283 MB bulk feed (which the
// classic CSV endpoint can't reliably stream on a serverless
// function timeout anyway). Results are cached in module memory by
// (productName, brand) for an hour so repeat queries are free.

const ADVERTISER_ID = 63156; // YesStyle on AWIN

// Floor on the title-overlap score (fraction of query tokens that
// appear in the result's title). Below this we treat the API match
// as unrelated and fall back to a YesStyle search link.
const MATCH_THRESHOLD = 0.4;

const QUERY_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

export type AwinMatch = {
  title: string;
  brand: string;
  price: number | null;
  imageUrl: string;
  productUrl: string;
};

type CachedQuery = { value: AwinMatch | null; at: number };
const queryCache = new Map<string, CachedQuery>();

export async function findYesStyleProduct(
  productName: string,
  brand: string
): Promise<AwinMatch | null> {
  const key = `${(productName || "").toLowerCase()}|${(brand || "").toLowerCase()}`;
  const hit = queryCache.get(key);
  if (hit && Date.now() - hit.at < QUERY_CACHE_TTL_MS) {
    return hit.value;
  }

  const value = await searchAndMatch(productName, brand);
  queryCache.set(key, { value, at: Date.now() });
  return value;
}

export function buildAffiliateLink(productUrl: string): string {
  const publisherId = process.env.AWIN_PUBLISHER_ID;
  return `https://www.awin1.com/cread.php?awinmid=${ADVERTISER_ID}&awinaffid=${publisherId}&ued=${encodeURIComponent(
    productUrl
  )}`;
}

export function buildSearchAffiliateLink(productName: string): string {
  const search = `https://www.yesstyle.com/en/list.html?q=${encodeURIComponent(
    productName
  )}`;
  return buildAffiliateLink(search);
}

// ---------- internals ----------

async function searchAndMatch(
  productName: string,
  brand: string
): Promise<AwinMatch | null> {
  const token = process.env.AWIN_API_TOKEN;
  const publisherId = process.env.AWIN_PUBLISHER_ID;
  if (!token || !publisherId) {
    throw new Error(
      "AWIN_API_TOKEN and AWIN_PUBLISHER_ID env vars must be set"
    );
  }

  // Brand + product name gives the API a stronger keyword signal than
  // product name alone, and AWIN's relevance ranking does most of the
  // filtering for us.
  const searchQuery = [brand, productName]
    .filter((s) => s && s.trim())
    .join(" ")
    .trim();
  if (!searchQuery) return null;

  const params = new URLSearchParams({
    advertiserId: String(ADVERTISER_ID),
    search: searchQuery,
    accessToken: token,
  });
  const url = `https://api.awin.com/publishers/${publisherId}/products/?${params.toString()}`;
  console.log("[awin] searching:", url.replace(token, "***"));

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `AWIN search failed: ${res.status} ${res.statusText} — ${body.slice(0, 400)}`
    );
  }

  const data: unknown = await res.json();
  const products = extractProducts(data);
  if (products.length === 0) {
    console.log("[awin] zero products returned for:", searchQuery);
    return null;
  }
  // First-result key list helps us notice if AWIN renames a field.
  console.log("[awin] sample product keys:", Object.keys(products[0]));

  const queryTokens = tokenize(productName);
  if (queryTokens.length === 0) return null;

  let best: { product: Record<string, unknown>; score: number } | null = null;
  for (const p of products) {
    const title = extractTitle(p);
    if (!title) continue;
    const titleTokens = new Set(tokenize(title));
    let matched = 0;
    for (const t of queryTokens) {
      if (titleTokens.has(t)) matched++;
    }
    const score = matched / queryTokens.length;
    if (score === 0) continue;
    if (!best || score > best.score) best = { product: p, score };
  }

  if (!best || best.score < MATCH_THRESHOLD) {
    console.log("[awin] best below threshold:", {
      score: best?.score,
      searchQuery,
    });
    return null;
  }

  const match = extractMatch(best.product);
  if (!match.productUrl) {
    console.log("[awin] best product has no URL");
    return null;
  }
  return match;
}

function extractProducts(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["products", "data", "results", "items"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

function extractTitle(p: Record<string, unknown>): string {
  return (
    strField(p, "productName") ||
    strField(p, "title") ||
    strField(p, "name")
  );
}

function extractMatch(p: Record<string, unknown>): AwinMatch {
  return {
    title: extractTitle(p),
    brand:
      strField(p, "brandName") ||
      strField(p, "brand") ||
      strField(p, "merchantName"),
    price: extractPrice(p),
    imageUrl:
      strField(p, "imageUrl") ||
      strField(p, "productImage") ||
      strField(p, "aw_image_url") ||
      strField(p, "merchantImageUrl") ||
      strField(p, "image_link"),
    productUrl:
      strField(p, "merchantProductUrl") ||
      strField(p, "merchant_deep_link") ||
      strField(p, "productUrl") ||
      strField(p, "url"),
  };
}

function extractPrice(p: Record<string, unknown>): number | null {
  // Try flat-number fields first.
  const flat =
    toNumber(p.price) ??
    toNumber(p.displayPrice) ??
    toNumber(p.searchPrice) ??
    toNumber(p.storePrice);
  if (flat !== null) return flat;

  // Nested { amount } / { value } shapes — common for currency-aware
  // price objects in AWIN responses.
  const priceObj = p.price;
  if (priceObj && typeof priceObj === "object") {
    const o = priceObj as Record<string, unknown>;
    return (
      toNumber(o.amount) ??
      toNumber(o.value) ??
      toNumber(o.searchPrice) ??
      toNumber(o.displayPrice)
    );
  }
  return null;
}

function strField(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v : "";
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    if (!isNaN(n)) return n;
  }
  return null;
}
