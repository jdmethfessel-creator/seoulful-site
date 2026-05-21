import { NextRequest, NextResponse } from "next/server";
import type { Routine } from "@/lib/routine";

// Build-My-Routine endpoint. Accepts a list of Western skincare product
// strings and asks Claude for a full K-beauty morning/evening routine,
// with cross-step ingredient conflict checking and a savings summary.

export const runtime = "nodejs";
// Sonnet-4 with max_tokens=2000 frequently runs 15–25s. The default
// serverless function timeout (10s on Vercel Hobby) is the most common
// cause of a silent failure for this endpoint, so bump it explicitly.
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 2000;
const AFFILIATE_TAG = "seoulful-20";

export async function POST(req: NextRequest) {
  let products: string[] = [];
  try {
    const body = await req.json();
    const raw = Array.isArray(body?.products) ? body.products : [];
    products = raw
      .map((p: unknown) => (typeof p === "string" ? p.trim() : ""))
      .filter((p: string) => p.length > 0);
  } catch (err) {
    console.error("[routine] body parse failed:", err);
    return NextResponse.json(
      { error: "Invalid JSON body. Expected { products: string[] }." },
      { status: 400 }
    );
  }

  if (products.length < 1) {
    return NextResponse.json(
      { error: "Add at least one product to build a routine." },
      { status: 400 }
    );
  }
  if (products.length > 12) products = products.slice(0, 12);

  const key = process.env.ANTHROPIC_API_KEY;
  console.log("[routine] env check:", {
    keyPresent: !!key,
    keyLength: key?.length ?? 0,
    keyIsPlaceholder: key === "your_anthropic_key_here",
    model: MODEL,
    productCount: products.length,
  });

  if (!key || key === "your_anthropic_key_here") {
    return NextResponse.json(
      {
        error:
          "Routine builder is offline — ANTHROPIC_API_KEY isn't set in this environment.",
      },
      { status: 503 }
    );
  }

  const prompt = buildPrompt(products);

  let raw: string;
  try {
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const elapsed = Date.now() - t0;

    if (!res.ok) {
      const text = await res.text();
      console.error("[routine] anthropic non-2xx:", {
        status: res.status,
        statusText: res.statusText,
        elapsedMs: elapsed,
        model: MODEL,
        body: text.slice(0, 2000),
      });
      // Surface a sanitized hint so callers can see what went wrong
      // without needing access to the server logs.
      let hint = `AI service returned ${res.status}.`;
      try {
        const parsed = JSON.parse(text);
        const apiMsg =
          parsed?.error?.message ||
          parsed?.message ||
          parsed?.error?.type;
        if (typeof apiMsg === "string" && apiMsg.length < 240) {
          hint = `AI service returned ${res.status}: ${apiMsg}`;
        }
      } catch {
        // body wasn't JSON — keep generic hint
      }
      return NextResponse.json({ error: hint }, { status: 502 });
    }

    const data = await res.json();
    console.log("[routine] anthropic ok:", {
      elapsedMs: elapsed,
      stopReason: data?.stop_reason,
      usage: data?.usage,
      contentLen: Array.isArray(data?.content) ? data.content.length : 0,
    });

    if (!Array.isArray(data.content) || data.content[0]?.type !== "text") {
      console.error("[routine] unexpected response shape:", data);
      return NextResponse.json(
        { error: "AI service returned an unexpected response shape." },
        { status: 502 }
      );
    }
    raw = data.content[0].text as string;
  } catch (err) {
    console.error("[routine] fetch failed:", {
      name: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      cause:
        err instanceof Error && "cause" in err
          ? (err as { cause?: unknown }).cause
          : undefined,
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Couldn't reach the AI service: ${err.message}`
            : "Couldn't reach the AI service.",
      },
      { status: 502 }
    );
  }

  const parsed = parseRoutineJson(raw);
  if (!parsed) {
    console.error(
      "[routine] failed to parse routine JSON. raw output (first 2k):",
      raw.slice(0, 2000)
    );
    return NextResponse.json(
      { error: "AI returned a routine we couldn't parse. Try again." },
      { status: 502 }
    );
  }

  const routine = normalizeRoutine(parsed);
  return NextResponse.json({ routine });
}

function buildPrompt(products: string[]): string {
  return `You are a K-beauty expert and cosmetic chemist. The user currently uses these Western skincare products: ${JSON.stringify(
    products
  )}.

Build them a complete K-beauty morning and evening routine by finding the best Korean alternative for each product.

Requirements:
- Match each Western product to a Korean alternative in the same category with the same key actives
- Check for ingredient conflicts across the full routine (e.g. do not recommend retinol and AHA in the same routine step, flag vitamin C and niacinamide interactions)
- Do not repeat the same active ingredient excessively across multiple products
- Fill any gaps in their routine (if they have no SPF, recommend one)
- For each Korean alternative include: name, brand, price, key actives, match score, amazon_url with tag=${AFFILIATE_TAG}, yesstyle_url using list.html?q=brand+category format
- Calculate total cost of their current routine vs total cost of K-beauty routine
- Calculate annual savings ((current_total - kdupe_total) * 12)

Return ONLY valid JSON in this exact shape — no markdown, no preamble, no commentary:
{
  "summary": {
    "current_total": 0,
    "kdupe_total": 0,
    "annual_savings": 0,
    "conflicts_detected": ["<conflict description>"]
  },
  "morning": [
    {
      "step": "Cleanser|Toner|Serum|Moisturizer|SPF",
      "western": { "name": "", "brand": "", "price": 0 },
      "korean": { "name": "", "brand": "", "price": 0, "match_score": 0, "key_actives": [], "amazon_url": "", "yesstyle_url": "" }
    }
  ],
  "evening": [
    {
      "step": "Cleanser|Toner|Serum|Moisturizer|Eye Cream",
      "western": { "name": "", "brand": "", "price": 0 },
      "korean": { "name": "", "brand": "", "price": 0, "match_score": 0, "key_actives": [], "amazon_url": "", "yesstyle_url": "" }
    }
  ]
}`;
}

function tryParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Try several strategies in order: direct parse, markdown code fence
// extraction (anywhere in the string), then the largest {...} block.
function parseRoutineJson(text: string): unknown {
  if (!text) return null;
  const trimmed = text.trim();

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fence = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence && fence[1]) {
    const fenced = tryParse(fence[1].trim());
    if (fenced) return fenced;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const block = tryParse(trimmed.slice(start, end + 1));
    if (block) return block;
  }

  return null;
}

function normalizeRoutine(input: unknown): Routine {
  const obj = (input ?? {}) as Record<string, unknown>;
  const summaryIn = (obj.summary ?? {}) as Record<string, unknown>;
  const morningIn = Array.isArray(obj.morning) ? obj.morning : [];
  const eveningIn = Array.isArray(obj.evening) ? obj.evening : [];

  const morning = morningIn
    .map(normalizeStep)
    .filter((s): s is NonNullable<ReturnType<typeof normalizeStep>> => !!s);
  const evening = eveningIn
    .map(normalizeStep)
    .filter((s): s is NonNullable<ReturnType<typeof normalizeStep>> => !!s);

  const conflicts = Array.isArray(summaryIn.conflicts_detected)
    ? (summaryIn.conflicts_detected as unknown[])
        .filter((c) => typeof c === "string" && c.trim().length > 0)
        .map((c) => c as string)
    : [];

  return {
    summary: {
      current_total: toNumber(summaryIn.current_total) ?? 0,
      kdupe_total: toNumber(summaryIn.kdupe_total) ?? 0,
      annual_savings: toNumber(summaryIn.annual_savings) ?? 0,
      conflicts_detected: conflicts,
    },
    morning,
    evening,
  };
}

function normalizeStep(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const western = (row.western ?? {}) as Record<string, unknown>;
  const korean = (row.korean ?? {}) as Record<string, unknown>;
  return {
    step: typeof row.step === "string" ? row.step : "",
    western: {
      name: stringOr(western.name),
      brand: stringOr(western.brand),
      price: toNumber(western.price) ?? 0,
    },
    korean: {
      name: stringOr(korean.name),
      brand: stringOr(korean.brand),
      price: toNumber(korean.price) ?? 0,
      match_score: toNumber(korean.match_score) ?? 0,
      key_actives: Array.isArray(korean.key_actives)
        ? (korean.key_actives as unknown[])
            .filter((a) => typeof a === "string")
            .map((a) => a as string)
        : [],
      amazon_url: stringOr(korean.amazon_url),
      yesstyle_url: stringOr(korean.yesstyle_url),
    },
  };
}

function stringOr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!isNaN(n)) return n;
  }
  return null;
}
