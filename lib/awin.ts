// AWIN YesStyle product feed enrichment.
//
// Downloads the classic productdata.awin.com CSV feed (apikey in the
// path, no auth header), keeps the parsed entries in module-level
// memory with a TTL, and exposes a fuzzy brand + title matcher. Used
// by /api/yesstyle-product to enrich the K-beauty dupe card with a
// real image, real price, and a tracked affiliate link.

const ADVERTISER_ID = 63156; // YesStyle on AWIN
const FEED_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

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
  if (!token) {
    throw new Error("AWIN_API_TOKEN env var must be set");
  }

  // Classic productdata CSV endpoint. The Google-format enhanced feed
  // at api.awin.com isn't available on this publisher account, so we
  // pull the comma-delimited CSV instead and parse by column name.
  // The api key is part of the path; delimiter is URL-encoded comma.
  const url = `https://productdata.awin.com/datafeed/download/apikey/${token}/language/en/fid/${ADVERTISER_ID}/format/csv/delimiter/%2C/compression/none/`;
  const redacted = url.replace(token, "***");
  console.log("[awin] downloading feed:", redacted);

  const started = Date.now();
  const res = await fetch(url, {
    headers: {
      // Some CDNs reject empty-UA requests.
      "User-Agent": "kDupe-awin-feed/1.0",
      Accept: "text/csv,text/plain,*/*",
    },
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

  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error("AWIN feed CSV was empty");
  }

  // First row is the column header. Map name → index so we can survive
  // AWIN reordering columns in the feed.
  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const idxName = col("product_name");
  const idxBrand = col("brand_name");
  const idxLink = col("merchant_deep_link");
  const idxAwImage = col("aw_image_url");
  const idxMerchantImage = col("merchant_image_url");
  const idxSearchPrice = col("search_price");
  const idxDisplayPrice = col("display_price");
  const idxStorePrice = col("store_price");

  if (idxName === -1 || idxLink === -1) {
    console.error("[awin] CSV header missing required columns:", header);
    throw new Error("AWIN CSV header missing product_name or merchant_deep_link");
  }

  const cell = (row: string[], i: number): string =>
    i >= 0 && i < row.length ? row[i] : "";

  const entries: FeedEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const title = cell(row, idxName).trim();
    const link = cell(row, idxLink).trim();
    if (!title || !link) continue;

    const priceRaw =
      cell(row, idxSearchPrice) ||
      cell(row, idxDisplayPrice) ||
      cell(row, idxStorePrice);

    entries.push({
      title,
      brand: cell(row, idxBrand).trim(),
      price: toNumber(priceRaw),
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
// AWIN's product descriptions routinely contain commas + newlines, so
// a naive split() can't be used.
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
          i++; // consume the second quote of the escape pair
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
    if (ch === "\r") continue; // ignore; the \n will close the row
    field += ch;
  }
  // Flush trailing field / row.
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
