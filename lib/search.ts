import { supabase } from "./supabase";

export type Product = {
  id: string;
  name: string;
  brand: string | null;
  price: number | null;
  category: string | null;
  ingredient_list: string | null;
  flagged_ingredients: string | null;
  key_actives: string | null;
};

export type Alternative = {
  id: string;
  western_product_id: string | null;
  name: string;
  brand: string | null;
  price: number | null;
  category: string | null;
  match_score: number | null;
  ingredient_list: string | null;
  flagged_ingredients: string | null;
  key_actives: string | null;
  amazon_url: string | null;
  sephora_url: string | null;
  yesstyle_url: string | null;
};

export type SearchResult = {
  source: "db" | "ai";
  product: Product;
  alternatives: Alternative[];
  // True when the user searched a Korean / K-beauty product. The UI
  // surfaces an "already K-beauty" notice instead of a dupe card.
  is_korean_brand?: boolean;
};

// Look up a Western skincare product by partial name in the DB. If we
// can't find one, fall back to Claude to generate a best-guess product
// + Korean alternative on the fly.
export async function searchProduct(
  rawQuery: string
): Promise<SearchResult | null> {
  const query = rawQuery.trim();
  if (!query) return null;

  // 1) DB lookup
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .ilike("name", `%${query}%`)
    .limit(1);

  if (error) {
    console.error("[search] products lookup error:", error);
  }

  if (products && products.length > 0) {
    const product = products[0] as Product;
    const { data: alternatives } = await supabase
      .from("korean_alternatives")
      .select("*")
      .eq("western_product_id", product.id)
      .order("match_score", { ascending: false });

    return {
      source: "db",
      product,
      alternatives: (alternatives as Alternative[] | null) || [],
    };
  }

  // 2) AI fallback
  return await aiFallback(query);
}

async function aiFallback(query: string): Promise<SearchResult | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your_anthropic_key_here") {
    return null;
  }

  const prompt = `You are a Korean skincare (K-beauty) expert with deep ingredient knowledge.

The user searched for: "${query}"

Identify the most likely Western skincare product they're referring to, then recommend the single best Korean alternative.

KOREAN PRODUCT DETECTION — CHECK FIRST:
- If the user's query is already a Korean / K-beauty brand or product, set "is_korean_brand": true in the response and skip the dupe search.
- Korean brands include (non-exhaustive): COSRX, Some By Mi, Beauty of Joseon, Laneige, Innisfree, Numbuzin, Mediheal, Purito, Anua, Round Lab, Skin1004, Klairs, Missha, Etude House, IOPE, Sulwhasoo, Dr. Jart+, Tony Moly, The Face Shop, Nature Republic, History of Whoo, Hera, Su:m37, AHC, Banila Co, Glow Recipe, Then I Met You, Goodal, Pyunkang Yul, Abib, Torriden, Haruharu Wonder, Make P:rem, By Wishtrend, Dr. Ceuracle, I'm From, Mary&May, Mixsoon — and any other Korean brand you recognize.
- When is_korean_brand is true, you may still fill in the product fields (name, brand, category, price) for the searched product, but set alternative.name to "Already K-beauty" and put a short user-facing explanation in alternative.key_actives like "This product is already Korean skincare — no Western-to-K-beauty dupe needed." Leave amazon_asin and the URL fields empty.
- When is_korean_brand is false, omit it (or set false) and follow the full Western → Korean matching rules below.

PRODUCT FORMAT — HARD REQUIREMENT:
- The Korean alternative MUST be the same product category as the Western product. Category is one of: serum, moisturizer, cleanser, toner, sunscreen, eye cream, essence, exfoliant, mask.
- A serum must match to a serum. A toner must match to a toner. Never match across categories even if actives overlap strongly.
- If no Korean product exists in the same category with 3+ shared actives, pick the closest category-matched product with the highest active overlap and note the lower match score.

ACTIVE INGREDIENT MATCHING — HARD REQUIREMENT:
- The Korean alternative MUST share at least 3 of the same key active ingredients as the Western product. Examples of "key actives" include: niacinamide, vitamin C / ascorbic acid / ascorbyl glucoside, retinol / retinal / retinaldehyde, hyaluronic acid, peptides (matrixyl, copper peptides, etc), AHAs (glycolic, lactic, mandelic), BHA (salicylic acid), PHAs (gluconolactone), centella asiatica / madecassoside, snail mucin, propolis, ceramides, panthenol, azelaic acid, tranexamic acid, alpha-arbutin, beta-glucan, squalane.
- If you cannot find a Korean product that shares at least 3 actives, pick a different Korean product. Do NOT recommend a product that only shares 1-2 actives just because the category matches.
- match_score is calculated ONLY from shared key actives, not overall ingredient list similarity, not category similarity, not texture:
    * Score = round( (shared_actives / total_western_actives) * 100 )
    * Floor at 60 only when all 3+ required actives are present.
    * Cap at 100 (perfect overlap on every active).
    * A product with the same actives in higher concentration scores higher than one with overlapping but weaker formulations.
- The Korean product's key_actives field MUST list the actives that are actually present in that product (verify against your knowledge of the formulation). Do not pad the list to inflate the match.

VALUE & BRAND REQUIREMENTS:
- The alternative MUST be from a Korean brand. Japanese brands (SK-II, Shiseido, Tatcha, etc), French brands, and any non-Korean brand are strictly prohibited.
- Prioritize mid-range Korean brands (COSRX, Some By Mi, Beauty of Joseon, Klairs, Innisfree, Numbuzin, Mediheal, Purito, Anua, Round Lab, Skin1004) over luxury Korean brands when match quality is similar.
- The goal is maximum active ingredient value per dollar — more actives at higher concentrations for less money. A $35 Korean serum with 40% bifida ferment beats a $150 Korean serum with 5% bifida ferment.
- Only recommend luxury Korean brands (Sulwhasoo, History of Whoo) when they are genuinely the best ingredient match and no mid-range alternative exists.

Respond with ONLY a valid JSON object — no markdown, no preamble, no commentary. Use this exact shape:

{
  "is_korean_brand": false,
  "product": {
    "name": "<full canonical Western product name>",
    "brand": "<brand>",
    "price": <number, USD retail, no symbol>,
    "category": "<serum|moisturizer|cleanser|toner|sunscreen|eye cream|essence|exfoliant|mask>",
    "flagged_ingredients": "<comma-separated concerning ingredients (fragrance, denatured alcohol, etc) — empty string if none>",
    "key_actives": "<comma-separated beneficial actives (vitamin C, niacinamide, retinol, etc)>"
  },
  "alternative": {
    "name": "<Korean product name>",
    "brand": "<Korean brand>",
    "price": <number, USD>,
    "category": "<must match the western product's category — serum|moisturizer|cleanser|toner|sunscreen|eye cream|essence|exfoliant|mask>",
    "match_score": <integer 0-100 — how close the active profile matches>,
    "flagged_ingredients": "<comma-separated concerning ingredients in the Korean product (fragrance, denatured alcohol, etc) — empty string if none, which is the common case for K-beauty>",
    "key_actives": "<comma-separated actives in the Korean product>",
    "amazon_asin": "<10-char Amazon ASIN for this product, or empty string if you don't confidently know it>",
    "sephora_url": "",
    "yesstyle_url": "https://www.yesstyle.com/en/list.html?q=<BRAND>+<CATEGORY>"
  }
}

For amazon_asin: return the product's 10-character Amazon Standard Identification Number (ASIN) if you confidently know it (e.g., "B07W6BG87X"). Do NOT guess. If you are not sure, return an empty string and we will fall back to an Amazon search URL.

For yesstyle_url specifically: the path is /en/list.html and the q= value must be the Korean brand name + a single category word (cream, serum, toner, cleanser, sunscreen, essence, mask, exfoliant, eye+cream, moisturizer). No full product names. Replace spaces inside the brand with + signs; join brand and category with a + sign. Full URL pattern: https://www.yesstyle.com/en/list.html?q=<brand>+<category>. Examples:
  - "Some By Mi AHA-BHA-PHA 30 Days Miracle Toner" → q=Some+By+Mi+toner
  - "Beauty of Joseon Glow Serum Propolis Niacinamide" → q=Beauty+of+Joseon+serum
  - "COSRX Advanced Snail 96 Mucin Power Essence" → q=COSRX+essence
  - "Laneige Water Bank Blue Hyaluronic Cream" → q=Laneige+cream
  - "Beauty of Joseon Relief Sun Rice + Probiotics" → q=Beauty+of+Joseon+sunscreen

For the Amazon fallback search: when no ASIN is available, our code builds the URL automatically from the Korean brand + product name (brand first), so make sure both the brand and name fields are populated correctly — the keyword is generated as "{brand} {name}".`;

  const text = await callClaude(prompt, 1024);
  if (!text) return null;

  // Robust JSON extraction — Claude sometimes wraps in ```json fences.
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    console.error("[search] no JSON object in Claude response:", text.slice(0, 200));
    return null;
  }

  type ParsedAlt = Alternative & { amazon_asin?: string };
  let parsed: {
    is_korean_brand?: boolean;
    product: Product;
    alternative: ParsedAlt;
  };
  try {
    parsed = JSON.parse(cleaned.slice(first, last + 1));
  } catch (err) {
    console.error("[search] JSON.parse failed:", err);
    return null;
  }

  const amazonFallbackQuery = [parsed.alternative.brand, parsed.alternative.name]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ");
  const amazonUrl = buildAmazonUrl(
    parsed.alternative.amazon_asin,
    amazonFallbackQuery
  );

  const stamp = Date.now().toString();
  return {
    source: "ai",
    is_korean_brand: parsed.is_korean_brand === true,
    product: {
      ...parsed.product,
      id: `ai-product-${stamp}`,
      ingredient_list: null,
    },
    alternatives: [
      {
        ...parsed.alternative,
        amazon_url: amazonUrl,
        id: `ai-alt-${stamp}`,
        western_product_id: null,
        ingredient_list: null,
      },
    ],
  };
}

// Construct an Amazon link with the seoulful-20 affiliate tag.
// Prefers a direct /dp/<ASIN> URL when Claude gave us a confident ASIN;
// falls back to an Amazon search URL otherwise. Affiliate tag is always
// appended.
export function buildAmazonUrl(
  asin: string | null | undefined,
  fallbackQuery: string | null | undefined
): string {
  const tag = "seoulful-20";
  const trimmedAsin = (asin || "").trim();
  if (/^[A-Z0-9]{10}$/i.test(trimmedAsin)) {
    return `https://www.amazon.com/dp/${trimmedAsin.toUpperCase()}?tag=${tag}`;
  }
  const q = (fallbackQuery || "").trim();
  if (!q) return "";
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${tag}`;
}

// =====================================================================
// URL paste / scrape pipeline
// =====================================================================

// Hostnames we'll attempt to fetch + parse. Anything else returns a
// "not supported" error rather than guessing at random Web pages.
const SCRAPE_ALLOWED_HOSTS = ["sephora.com", "ulta.com", "kiehls.com"];

export type ExtractedProduct = {
  name: string;
  brand: string;
  price: number | null;
  category: string | null;
  flagged_ingredients: string;
  key_actives: string;
};

export type ScrapeResult =
  | { ok: true; result: SearchResult }
  | { ok: false; error: string };

export function isUrlInput(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function checkScrapeAllowed(url: string): { ok: boolean; reason?: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: "That doesn't look like a valid URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) URLs are supported." };
  }
  const host = u.hostname.toLowerCase();
  const ok = SCRAPE_ALLOWED_HOSTS.some(
    (h) => host === h || host === `www.${h}` || host.endsWith(`.${h}`)
  );
  if (!ok) {
    return {
      ok: false,
      reason: `URL host not yet supported. Currently we can scrape Sephora, Ulta, and Kiehl's pages. Try copying the product name into the search box instead.`,
    };
  }
  return { ok: true };
}

async function fetchHtml(
  url: string
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        // Browser-like UA — Sephora/Ulta WAFs sometimes 403 default fetch UAs.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Page returned HTTP ${res.status}. Some retailers (especially Sephora) block server-side fetches — try pasting the product name instead.`,
      };
    }
    const text = await res.text();
    if (!text || text.length < 200) {
      return { ok: false, error: "Page returned no content." };
    }
    return { ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Could not fetch URL: ${msg}. The retailer may be blocking server-side requests.`,
    };
  }
}

function stripHtmlForExtraction(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractProductFromHtml(
  rawHtml: string,
  sourceUrl: string
): Promise<ExtractedProduct | null> {
  const cleaned = stripHtmlForExtraction(rawHtml).slice(0, 40000);

  const prompt = `You are an HTML extraction agent. Given the stripped HTML of a skincare product detail page, identify the single product on the page and return ONLY a JSON object with these fields:

{
  "name": "<full product name as listed on the page, no brand prefix duplication>",
  "brand": "<brand>",
  "price": <number in USD, no currency symbol, or null if not found>,
  "category": "<one of: serum|moisturizer|cleanser|toner|sunscreen|eye cream|essence|exfoliant|mask>",
  "flagged_ingredients": "<comma-separated concerning ingredients from the ingredient list (fragrance, denatured alcohol, parabens, formaldehyde releasers, etc) — empty string if none or unknown>",
  "key_actives": "<comma-separated beneficial actives present in the ingredient list (niacinamide, vitamin C / ascorbic acid, retinol, peptides, hyaluronic acid, salicylic acid, glycolic acid, ceramides, panthenol, etc) — empty string if not found>"
}

Source URL (use for brand/category hints if the visible HTML is ambiguous): ${sourceUrl}

Stripped HTML (truncated to 40 KB):
${cleaned}

Return ONLY the JSON object. No preamble, no markdown fences.`;

  const text = await callClaude(prompt, 1024);
  if (!text) return null;

  const cleanedJson = text.replace(/```(?:json)?/g, "").trim();
  const first = cleanedJson.indexOf("{");
  const last = cleanedJson.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    console.error("[scrape] no JSON in Claude extraction:", text.slice(0, 200));
    return null;
  }
  try {
    const parsed = JSON.parse(cleanedJson.slice(first, last + 1)) as Partial<ExtractedProduct>;
    if (!parsed.name || !parsed.brand) return null;
    return {
      name: parsed.name,
      brand: parsed.brand,
      price: typeof parsed.price === "number" ? parsed.price : null,
      category: parsed.category || null,
      flagged_ingredients: parsed.flagged_ingredients || "",
      key_actives: parsed.key_actives || "",
    };
  } catch (err) {
    console.error("[scrape] JSON.parse failed:", err);
    return null;
  }
}

// Scrape a retailer product page, extract the Western product details,
// then run those through the existing AI-fallback flow to find the
// Korean alternative. Returns a ScrapeResult with either the joined
// SearchResult or a human-readable error string.
export async function searchFromUrl(url: string): Promise<ScrapeResult> {
  const gate = checkScrapeAllowed(url);
  if (!gate.ok) return { ok: false, error: gate.reason || "URL not allowed" };

  const html = await fetchHtml(url);
  if (!html.ok) return { ok: false, error: html.error };

  const extracted = await extractProductFromHtml(html.text, url);
  if (!extracted) {
    return {
      ok: false,
      error:
        "Couldn't extract product info from that page. Try pasting the product name directly into the search box.",
    };
  }

  const query = [extracted.brand, extracted.name]
    .filter((s) => s && s.trim().length > 0)
    .join(" ");

  const aiResult = await aiFallback(query);
  if (!aiResult) {
    return {
      ok: false,
      error:
        "Couldn't find a K-beauty dupe for that product. Either the AI fallback is offline or no close match exists yet.",
    };
  }

  // Overlay the scraped Western details onto the AI's product card —
  // the page is more authoritative than Claude's recall for price,
  // ingredients, and exact product name.
  const product: Product = {
    ...aiResult.product,
    name: extracted.name || aiResult.product.name,
    brand: extracted.brand || aiResult.product.brand,
    price: extracted.price ?? aiResult.product.price,
    category: extracted.category || aiResult.product.category,
    flagged_ingredients:
      extracted.flagged_ingredients || aiResult.product.flagged_ingredients,
    key_actives: extracted.key_actives || aiResult.product.key_actives,
  };

  return { ok: true, result: { ...aiResult, product } };
}

// =====================================================================
// Ingredient summaries — short plain-English paragraphs that replace
// the flagged-ingredient tags and key-actives bullets on the product
// cards. One Claude call generates both summaries (western + dupe) in
// a single JSON blob.
// =====================================================================

export type IngredientSummaries = {
  western: string | null;
  dupe: string | null;
};

export async function generateIngredientSummaries(
  product: Product,
  alternative: Alternative | undefined
): Promise<IngredientSummaries> {
  if (!alternative) return { western: null, dupe: null };

  const prompt = `You are writing two short ingredient summaries for a skincare comparison card. Use plain English a normal shopper can follow. Each summary is 2 sentences MAX — these complement a visual ingredient breakdown (flagged ingredients and key actives are already shown as icons/tags), so do NOT re-list the actives or flagged ingredients. Focus on the takeaway.

WESTERN PRODUCT
- Name: ${product.name}
- Brand: ${product.brand || "unknown"}
- Price: ${product.price != null ? `$${product.price}` : "unknown"}
- Category: ${product.category || "skincare"}
- Key actives: ${product.key_actives || "(none listed)"}
- Flagged ingredients: ${product.flagged_ingredients || "(none listed)"}

K-BEAUTY DUPE
- Name: ${alternative.name}
- Brand: ${alternative.brand || "unknown"}
- Price: ${alternative.price != null ? `$${alternative.price}` : "unknown"}
- Key actives: ${alternative.key_actives || "(none listed)"}
- Flagged ingredients: ${alternative.flagged_ingredients || "(none listed)"}

WESTERN SUMMARY (2 sentences max)
- Briefly describe what the formula does for skin and, if relevant, why the flagged ingredients matter (irritation, hormone disruption, dryness, etc.).
- Call out the brand-markup angle when the price gap with the dupe is meaningful (e.g. "you're paying ~3x more for similar actives").

DUPE SUMMARY (2 sentences max)
- Briefly describe what the formula does for skin and what makes it a cleaner/smarter swap (skips fragrance, denatured alcohol, parabens, dyes — or, if the western has no flags, why this formulation is more thoughtful).

Respond with ONLY a JSON object — no markdown, no preamble, no commentary:

{
  "western": "<2 sentence paragraph>",
  "dupe": "<2 sentence paragraph>"
}`;

  const text = await callClaude(prompt, 512);
  if (!text) return { western: null, dupe: null };

  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    console.error(
      "[summaries] no JSON object in Claude response:",
      text.slice(0, 200)
    );
    return { western: null, dupe: null };
  }

  try {
    const parsed = JSON.parse(cleaned.slice(first, last + 1)) as Partial<IngredientSummaries>;
    return {
      western:
        typeof parsed.western === "string" && parsed.western.trim().length > 0
          ? parsed.western.trim()
          : null,
      dupe:
        typeof parsed.dupe === "string" && parsed.dupe.trim().length > 0
          ? parsed.dupe.trim()
          : null,
    };
  } catch (err) {
    console.error("[summaries] JSON.parse failed:", err);
    return { western: null, dupe: null };
  }
}

// Shared Anthropic call. Returns the text body of the first text block,
// or null on any error (network, non-2xx, missing content).
async function callClaude(prompt: string, maxTokens: number): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your_anthropic_key_here") return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("[claude] non-2xx:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    if (Array.isArray(data.content) && data.content[0]?.type === "text") {
      return data.content[0].text as string;
    }
    return null;
  } catch (err) {
    console.error("[claude] fetch failed:", err);
    return null;
  }
}
