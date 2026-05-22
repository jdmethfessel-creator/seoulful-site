// AWIN YesStyle product feed enrichment — streaming edition.
//
// Buffering 56k parsed CSV rows into memory blew the Vercel function
// (~280 MB peak), so we instead stream the gzip feed through a CSV
// parser and score each row as it arrives. The moment a row clears
// MATCH_THRESHOLD we abort the upstream socket and return. Per-query
// results are cached in module memory for an hour so repeat dupe
// cards for the same (productName, brand) skip the round trip.

import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import csv from "csv-parser";

const ADVERTISER_ID = 63156; // YesStyle on AWIN

// Floor on the title-overlap score (fraction of query tokens that
// appear in the row's title). At-or-above this, we accept the row.
const MATCH_THRESHOLD = 0.4;

const QUERY_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

export type AwinMatch = {
  title: string;
  brand: string;
  price: number | null;
  imageUrl: string;
  productUrl: string;
};

type FeedRow = Record<string, string | undefined>;

type CachedMatch = { value: AwinMatch | null; at: number };
const queryCache = new Map<string, CachedMatch>();

export async function findYesStyleProduct(
  productName: string,
  brand: string
): Promise<AwinMatch | null> {
  const key = `${(productName || "").toLowerCase()}|${(brand || "").toLowerCase()}`;
  const hit = queryCache.get(key);
  if (hit && Date.now() - hit.at < QUERY_CACHE_TTL_MS) return hit.value;

  const value = await streamAndMatch(productName, brand);
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

// Tracked YesStyle search URL using only the brand + first 2–3
// meaningful words from the product name. Used as the soft fallback
// when no row clears the match threshold.
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

// ---------- streaming match ----------

async function streamAndMatch(
  productName: string,
  brand: string
): Promise<AwinMatch | null> {
  const feedUrl = process.env.AWIN_FEED_URL;
  if (!feedUrl) {
    throw new Error("AWIN_FEED_URL env var must be set");
  }

  const queryTokens = tokenize(productName);
  if (queryTokens.length === 0) return null;
  const brandTokens = tokenize(brand);

  console.log("[awin] streaming feed:", redactUrl(feedUrl));
  const started = Date.now();

  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "kDupe-awin-feed/1.0", Accept: "*/*" },
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

  // Bridge the Web ReadableStream from fetch into the Node stream
  // world so we can pipe through zlib + csv-parser.
  const nodeStream = Readable.fromWeb(res.body as never);
  const gunzip = createGunzip();
  const parser = csv();
  const pipeline = nodeStream.pipe(gunzip).pipe(parser);

  return await new Promise<AwinMatch | null>((resolve) => {
    let best: { row: FeedRow; score: number } | null = null;
    let resolved = false;
    let rowCount = 0;

    const finish = (value: AwinMatch | null, reason: string) => {
      if (resolved) return;
      resolved = true;
      // Tear down upstream so AWIN closes the socket and we stop
      // transferring bytes we'll never use.
      try {
        pipeline.destroy();
        gunzip.destroy();
        nodeStream.destroy();
      } catch {
        // best-effort
      }
      console.log(
        `[awin] ${reason} after ${rowCount} rows in ${Date.now() - started}ms`,
        value ? { title: value.title, brand: value.brand } : "(no match)"
      );
      resolve(value);
    };

    pipeline.on("data", (row: FeedRow) => {
      if (resolved) return;
      rowCount++;

      const title = (row.product_name ?? "").trim();
      if (!title) return;
      const titleLower = title.toLowerCase();
      const brandLower = (row.brand_name ?? "").toLowerCase();

      if (brandTokens.length > 0) {
        const brandHit = brandTokens.some(
          (t) => brandLower.includes(t) || titleLower.includes(t)
        );
        if (!brandHit) return;
      }

      const titleTokens = new Set(tokenize(title));
      let matched = 0;
      for (const t of queryTokens) {
        if (titleTokens.has(t)) matched++;
      }
      const score = matched / queryTokens.length;
      if (score === 0) return;

      if (!best || score > best.score) best = { row, score };

      if (score >= MATCH_THRESHOLD) {
        finish(rowToMatch(row), `matched (score ${score.toFixed(2)})`);
      }
    });

    pipeline.on("end", () => {
      if (resolved) return;
      // Stream completed with no row at-or-above threshold. Per spec,
      // surface the best candidate we found so the card still has
      // something useful — caller treats anything non-null as
      // matched.
      if (best) {
        finish(
          rowToMatch(best.row),
          `best below threshold (score ${best.score.toFixed(2)})`
        );
      } else {
        finish(null, "no candidates");
      }
    });

    pipeline.on("error", (err: Error) => {
      // Destroying the pipeline on early abort emits an error
      // ("premature close") that we can safely ignore.
      if (resolved) return;
      console.error("[awin] stream error:", err.message);
      // If we have a best candidate from before the error, return it
      // rather than failing the whole enrichment.
      if (best) {
        finish(
          rowToMatch(best.row),
          `error after partial scan (${err.message})`
        );
      } else {
        finish(null, `error before any match (${err.message})`);
      }
    });
  });
}

function rowToMatch(row: FeedRow): AwinMatch {
  return {
    title: (row.product_name ?? "").trim(),
    brand: (row.brand_name ?? "").trim(),
    price: toNumber(
      row.search_price ?? row.display_price ?? row.store_price ?? ""
    ),
    imageUrl: (row.aw_image_url ?? row.merchant_image_url ?? "").trim(),
    productUrl: (row.merchant_deep_link ?? "").trim(),
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
