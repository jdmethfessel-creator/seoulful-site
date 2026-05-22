import { NextRequest, NextResponse } from "next/server";
import {
  buildAffiliateLink,
  buildCleanSearchAffiliateLink,
  findYesStyleProduct,
} from "@/lib/awin";

// GET /api/yesstyle-product?productName=...&brand=...
//
// Returns enrichment data for a K-beauty dupe card from the YesStyle
// AWIN product feed:
//   { matched, imageUrl, price, affiliateUrl, productTitle, productBrand }
//
// On no match / failure, matched=false and affiliateUrl is a tracked
// YesStyle search URL so the "Buy on YesStyle" button still works.

export const runtime = "nodejs";
// Cold-start cost on a fresh serverless instance: download the
// gzipped feed (~20–40 MB compressed), decompress with the Web
// Streams DecompressionStream, parse the CSV. 60s is the Vercel Pro
// ceiling; the in-memory cache means warm hits return in ms.
export const maxDuration = 60;

type EnrichmentResponse = {
  matched: boolean;
  imageUrl: string | null;
  fallbackImageUrl: string | null;
  price: number | null;
  affiliateUrl: string;
  productTitle: string | null;
  productBrand: string | null;
};

export async function GET(req: NextRequest) {
  const productName = (req.nextUrl.searchParams.get("productName") || "").trim();
  const brand = (req.nextUrl.searchParams.get("brand") || "").trim();

  if (!productName) {
    return NextResponse.json(
      { error: "productName query param is required" },
      { status: 400 }
    );
  }

  // If env isn't configured, fail soft to a tracked search URL so the
  // dupe card still has a working Buy button.
  if (!process.env.AWIN_FEED_URL || !process.env.AWIN_PUBLISHER_ID) {
    console.error("[yesstyle] AWIN env vars missing");
    return NextResponse.json<EnrichmentResponse>({
      matched: false,
      imageUrl: null,
      fallbackImageUrl: null,
      price: null,
      affiliateUrl: buildCleanSearchAffiliateLink(brand, productName),
      productTitle: null,
      productBrand: null,
    });
  }

  try {
    const match = await findYesStyleProduct(productName, brand);

    if (!match) {
      console.log("[yesstyle] no match:", { productName, brand });
      return NextResponse.json<EnrichmentResponse>({
        matched: false,
        imageUrl: null,
        fallbackImageUrl: null,
        price: null,
        affiliateUrl: buildCleanSearchAffiliateLink(brand, productName),
        productTitle: null,
        productBrand: null,
      });
    }

    console.log("[yesstyle] match:", {
      query: { productName, brand },
      matchedTitle: match.title,
      matchedBrand: match.brand,
      price: match.price,
      imageLink: match.imageUrl,
      fallbackImageLink: match.fallbackImageUrl,
      productUrl: match.productUrl,
    });

    return NextResponse.json<EnrichmentResponse>({
      matched: true,
      imageUrl: match.imageUrl || null,
      fallbackImageUrl: match.fallbackImageUrl || null,
      price: match.price,
      affiliateUrl: buildAffiliateLink(match.productUrl),
      productTitle: match.title,
      productBrand: match.brand,
    });
  } catch (err) {
    console.error("[yesstyle] enrichment failed:", err);
    // Soft-fail: keep the card useful by handing back the search
    // affiliate link rather than 500ing the request.
    return NextResponse.json<EnrichmentResponse>({
      matched: false,
      imageUrl: null,
      fallbackImageUrl: null,
      price: null,
      affiliateUrl: buildCleanSearchAffiliateLink(brand, productName),
      productTitle: null,
      productBrand: null,
    });
  }
}
