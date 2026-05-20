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

Identify the most likely Western skincare product they're referring to, then recommend the single best Korean alternative that has matching key actives at a lower price.

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
    "amazon_url": "https://www.amazon.com/s?k=<URL-encoded Korean product>",
    "sephora_url": "",
    "yesstyle_url": "https://www.yesstyle.com/en/search?queryString=<URL-encoded Korean product>"
  }
}`;

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

  let parsed: { product: Product; alternative: Alternative };
  try {
    parsed = JSON.parse(cleaned.slice(first, last + 1));
  } catch (err) {
    console.error("[search] JSON.parse failed:", err);
    return null;
  }

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
        id: `ai-alt-${stamp}`,
        western_product_id: null,
        ingredient_list: null,
      },
    ],
  };
}
