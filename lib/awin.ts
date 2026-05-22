// AWIN YesStyle product feed enrichment.
//
// Downloads a gzip-compressed CSV from AWIN's classic productdata
// endpoint. The full URL (apikey + fid + columns + format) is
// configured via AWIN_FEED_URL so it can be rotated / re-pointed
// without touching code. The feed is decompressed with the Web
// Streams DecompressionStream (no Node-specific zlib import needed),
// parsed by column name, and cached in module memory with a TTL so
// only cold starts pay the download cost.

const ADVERTISER_ID = 63156; // YesStyle on AWIN
const FEED_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Floor on the title-overlap score (fraction of query tokens that
// appear in the candidate's title). Below this we return null and
// the client falls back to a tracked YesStyle search link.
const MATCH_THRESHOLD = 0.4;

export type AwinMatch = {
  title: string;
  brand: string;
  price: number | null;
  imageUrl: string;
  productUrl: string;
};

type FeedEntry = {
  title: string;
  brand: string;
  price: number | null;
  imageLink: string;
  link: string;
};

let cache: { entries: FeedEntry[]; builtAt: number } | null = null;
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

// Tracked YesStyle search URL using only the brand + the first 2–3
// meaningful words from the product name. This is the "we couldn't
// pin the exact product, but at least send a clean search" fallback.
export function buildCleanSearchAffiliateLink(
  brand: string,
  productName: string
): string {
  return buildSearchAffiliateLink(pickKeyTerms(brand, productName));
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "your", "you",
  "our", "this", "that", "these", "those", "are", "was", "have",
  "has", "ml", "oz", "fl", "pcs", "set",
]);

function pickKeyTerms(brand: string, productName: string): string {
  const tokens = productName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
  const keyWords = tokens.slice(0, 3);
  const cleanBrand = (brand || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [cleanBrand, ...keyWords].filter(Boolean).join(" ").trim();
}

// ---------- internals ----------

async function getFeed(): Promise<FeedEntry[]> {
  const now = Date.now();
  if (cache && now - cache.builtAt < FEED_TTL_MS) return cache.entries;
  if (inflight) return inflight;

  inflight = downloadAndParse()
    .then((entries) => {
      cache = { entries, builtAt: Date.now() };
      inflight = null;
      return entries;
    })
    .catch((err) => {
      inflight = null;
      if (cache) {
        console.error("[awin] refresh failed, serving stale:", err);
        return cache.entries;
      }
      throw err;
    });
  return inflight;
}

async function downloadAndParse(): Promise<FeedEntry[]> {
  const feedUrl = process.env.AWIN_FEED_URL;
  if (!feedUrl) {
    throw new Error("AWIN_FEED_URL env var must be set");
  }
  console.log("[awin] downloading feed:", redactUrl(feedUrl));

  const started = Date.now();
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": "kDupe-awin-feed/1.0",
      Accept: "*/*",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `AWIN feed download failed: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`
    );
  }
  if (!res.body) {
    throw new Error("AWIN feed response had no body");
  }

  // Stream the gzip body through DecompressionStream, then read to
  // text. Faster than buffering compressed bytes and gunzipping all
  // at once, and avoids importing node:zlib.
  const decompressed = res.body.pipeThrough(
    new DecompressionStream("gzip")
  );
  const text = await new Response(decompressed).text();
  console.log(
    "[awin] downloaded + decompressed:",
    `${(text.length / 1024 / 1024).toFixed(1)} MB in ${Date.now() - started} ms`
  );

  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error("AWIN feed CSV was empty");
  }

  const header = rows[0].map((h) => h.trim());
  const idxName = header.indexOf("product_name");
  const idxBrand = header.indexOf("brand_name");
  const idxLink = header.indexOf("merchant_deep_link");
  const idxAwImage = header.indexOf("aw_image_url");
  const idxMerchantImage = header.indexOf("merchant_image_url");
  const idxSearchPrice = header.indexOf("search_price");
  const idxDisplayPrice = header.indexOf("display_price");
  const idxStorePrice = header.indexOf("store_price");

  if (idxName === -1 || idxLink === -1) {
    console.error("[awin] CSV header missing required columns:", header);
    throw new Error(
      "AWIN CSV header missing product_name or merchant_deep_link"
    );
  }

  const cell = (row: string[], i: number): string =>
    i >= 0 && i < row.length ? row[i] : "";

  const entries: FeedEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const title = cell(row, idxName).trim();
    const link = cell(row, idxLink).trim();
    if (!title || !link) continue;
    entries.push({
      title,
      brand: cell(row, idxBrand).trim(),
      price: toNumber(
        cell(row, idxSearchPrice) ||
          cell(row, idxDisplayPrice) ||
          cell(row, idxStorePrice)
      ),
      imageLink:
        cell(row, idxAwImage).trim() ||
        cell(row, idxMerchantImage).trim(),
      link,
    });
  }
  console.log("[awin] parsed entries:", entries.length);
  return entries;
}

// CSV state machine — handles double-quote escaping (""), embedded
// commas / newlines inside quoted fields, and \r\n / \n line endings.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }
    if (ch === "\r") continue;
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
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

function redactUrl(url: string): string {
  return url.replace(/apikey\/[^/]+/, "apikey/***");
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
