import { NextRequest, NextResponse } from "next/server";
import { searchFromUrl } from "@/lib/search";

// POST /api/scrape with body { url: string }.
// Server-side fetches the page, asks Claude to extract product details,
// then runs the extracted product through the existing AI fallback to
// find a Korean alternative. Returns the full SearchResult or an error.
export async function POST(req: NextRequest) {
  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with a `url` field." },
      { status: 400 }
    );
  }

  const url = (body.url || "").trim();
  if (!url) {
    return NextResponse.json({ error: "Missing `url` in body." }, { status: 400 });
  }

  const result = await searchFromUrl(url);
  if (!result.ok) {
    // 400 covers the human-fixable errors (unsupported host, retailer
    // 403, scrape miss). The error string is already user-friendly.
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.result);
}
