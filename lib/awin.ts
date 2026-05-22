// AWIN YesStyle product feed enrichment.
//
// Downloads the JSONL feed from AWIN (auth: Bearer AWIN_API_TOKEN),
// keeps it in module-level memory with a TTL, and exposes a fuzzy
// brand + title matcher. Used by /api/yesstyle-product to enrich the
// K-beauty dupe card with a real image, real price, and a tracked
// affiliate link.

const ADVERTISER_ID = 63156; // YesStyle on AWIN
const FEED_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FEED_REGION = "retail-en_US.jsonl";

// Minimum score to count a match (fraction of query tokens that
// appear in the candidate's title). Below this we return null and
// the client falls back to a YesStyle search link.
const MATCH_THRESHOLD = 0.4;

export type FeedEntry = {
  title: string;
  brand: string;
  price: number | null;
  imageLink: string;
  link: string;
};

export type AwinMatch = {
  title: string;
  brand: string;
  price: number | null;
  imageUrl: string;
  productUrl: string;
};

type Cache = {
  entries: FeedEntry[];
  builtAt: number;
};

let cache: Cache | null = null;
let inflight: Promise<FeedEntry[]> | null = null;

export async function findYesStyleProduct(
  productName: string,
  brand: string
): Promise<AwinMatch | null> {
  const entries = await getFeed();
  return findBestMatch(entries, brand, productName);
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

async function getFeed(): Promise<FeedEntry[]> {
  const now = Date.now();
  if (cache && now - cache.builtAt < FEED_TTL_MS) {
    return cache.entries;
  }
  if (inflight) return inflight;

  inflight = downloadAndParse()
    .then((entries) => {
      cache = { entries, builtAt: Date.now() };
      inflight = null;
      return entries;
    })
    .catch((err) => {
      inflight = null;
      // If we have a stale cache, keep serving it on failure rather
      // than blowing up every dupe card.
      if (cache) {
        console.error("[awin] refresh failed, serving stale:", err);
        return cache.entries;
      }
      throw err;
    });
  return inflight;
}

async function downloadAndParse(): Promise<FeedEntry[]> {
  const token = process.env.AWIN_API_TOKEN;
  const publisherId = process.env.AWIN_PUBLISHER_ID;
  if (!token || !publisherId) {
    throw new Error(
      "AWIN_API_TOKEN and AWIN_PUBLISHER_ID env vars must be set"
    );
  }

  const url = `https://api.awin.com/publishers/${publisherId}/awinfeeds/download/${ADVERTISER_ID}-${FEED_REGION}`;
  const started = Date.now();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `AWIN feed download failed: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`
    );
  }
  const text = await res.text();
  console.log(
    "[awin] downloaded feed:",
    `${(text.length / 1024 / 1024).toFixed(1)} MB in ${Date.now() - started} ms`
  );

  const entries: FeedEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const title = stringField(obj, "title");
      const link = stringField(obj, "link");
      if (!title || !link) continue;
      entries.push({
        title,
        brand: stringField(obj, "brand"),
        price: toNumber(obj.price),
        imageLink: stringField(obj, "image_link"),
        link,
      });
    } catch {
      // Skip malformed lines; the feed has been observed to include
      // the occasional stray line break inside a value.
    }
  }
  console.log("[awin] parsed entries:", entries.length);
  return entries;
}

function findBestMatch(
  entries: FeedEntry[],
  brand: string,
  productName: string
): AwinMatch | null {
  const queryTokens = tokenize(productName);
  if (queryTokens.length === 0) return null;
  const brandTokens = tokenize(brand);

  let best: { entry: FeedEntry; score: number } | null = null;

  for (const entry of entries) {
    const titleLower = entry.title.toLowerCase();
    const brandLower = entry.brand.toLowerCase();

    // Require some brand overlap to avoid matching a coincidentally
    // similar title from a different brand. A brand token has to
    // appear in either the entry's brand field or the title.
    if (brandTokens.length > 0) {
      const brandHit = brandTokens.some(
        (t) => brandLower.includes(t) || titleLower.includes(t)
      );
      if (!brandHit) continue;
    }

    const titleTokens = new Set(tokenize(entry.title));
    let matched = 0;
    for (const t of queryTokens) {
      if (titleTokens.has(t)) matched++;
    }
    const score = matched / queryTokens.length;
    if (score === 0) continue;
    if (!best || score > best.score) best = { entry, score };
  }

  if (!best || best.score < MATCH_THRESHOLD) return null;

  return {
    title: best.entry.title,
    brand: best.entry.brand,
    price: best.entry.price,
    imageUrl: best.entry.imageLink,
    productUrl: best.entry.link,
  };
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function stringField(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v : "";
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
