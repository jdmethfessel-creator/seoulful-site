import { NextRequest, NextResponse } from "next/server";
import { searchProduct } from "@/lib/search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ error: "Missing q query param" }, { status: 400 });
  }
  const result = await searchProduct(q);
  if (!result) {
    return NextResponse.json(
      {
        error: "No match found",
        message:
          "We couldn't find a K-beauty dupe for this product. Either the product isn't in our database yet or our AI fallback is offline.",
      },
      { status: 404 }
    );
  }
  return NextResponse.json(result);
}
