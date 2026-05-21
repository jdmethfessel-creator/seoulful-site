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
  match_score: number | null;
  ingredient_list: string | null;
  key_actives: string | null;
  amazon_url: string | null;
  sephora_url: string | null;
  yesstyle_url: string | null;
};

export type SearchResult = {
  source: "db" | "ai";
  product: Product;
  alternatives: Alternative[];
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

Respond with ONLY a valid JSON object — no markdown, no preamble, no commentary. Use this exact shape:

{
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
    "match_score": <integer 0-100 — how close the active profile matches>,
    "key_actives": "<comma-separated actives in the Korean product>",
    "amazon_asin": "<10-char Amazon ASIN for this product, or empty string if you don't confidently know it>",
    "sephora_url": "",
    "yesstyle_url": "https://www.yesstyle.com/en/search.html?keyword=<SHORT>"
  }
}

For amazon_asin: return the product's 10-character Amazon Standard Identification Number (ASIN) if you confidently know it (e.g., "B07W6BG87X"). Do NOT guess. If you are not sure, return an empty string and we will fall back to an Amazon search URL.

For yesstyle_url specifically: the <SHORT> keyword must be ONLY the Korean brand name + the first three words of the product name. Full long product names cause YesStyle URL errors. Replace spaces with + signs. Examples:
  - "Some By Mi AHA-BHA-PHA 30 Days Miracle Toner" → keyword=Some+By+Mi+AHA-BHA-PHA+30+Days
  - "Beauty of Joseon Glow Serum Propolis Niacinamide" → keyword=Beauty+of+Joseon+Glow+Serum+Propolis
  - "COSRX Advanced Snail 96 Mucin Power Essence" → keyword=COSRX+Advanced+Snail+96

For the Amazon fallback search: when no ASIN is available, our code builds the URL automatically from the Korean brand + product name (brand first), so make sure both the brand and name fields are populated correctly — the keyword is generated as "{brand} {name}".`;

  let text = "";
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
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("[search] Claude error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    text =
      Array.isArray(data.content) && data.content[0]?.type === "text"
        ? data.content[0].text
        : "";
  } catch (err) {
    console.error("[search] Claude fetch failed:", err);
    return null;
  }

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
  let parsed: { product: Product; alternative: ParsedAlt };
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
