"use client";

import { useEffect, useState } from "react";
import type { Alternative } from "@/lib/search";

const PINK = "#ff3366";
const GREEN = "#00e676";
const CARD = "#141414";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

const SYNE = "var(--font-syne), system-ui, sans-serif";

const syneStyle = {
  fontFamily: SYNE,
  fontWeight: 700,
  letterSpacing: "-0.02em",
} as const;

const syneDisplay = {
  fontFamily: SYNE,
  fontWeight: 800,
  letterSpacing: "-0.03em",
} as const;

// Server enrichment shape from /api/yesstyle-product. Kept in sync
// with EnrichmentResponse in that route.
type Enrichment = {
  matched: boolean;
  imageUrl: string | null;
  fallbackImageUrl: string | null;
  price: number | null;
  affiliateUrl: string;
  productTitle: string | null;
  productBrand: string | null;
};

export default function KoreanDupeCard({
  alt,
  westernPrice,
}: {
  alt: Alternative;
  westernPrice: number | null;
}) {
  const actives = splitList(alt.key_actives);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [loadingEnrichment, setLoadingEnrichment] = useState(true);
  // Tracks which image source we're currently trying for this card:
  // "primary" = enrichment.imageUrl (aw_image_url), "fallback" =
  // enrichment.fallbackImageUrl (merchant_image_url), "none" = both
  // exhausted, hide the slot.
  const [imageSource, setImageSource] = useState<"primary" | "fallback" | "none">(
    "primary"
  );

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({
      productName: alt.name,
      brand: alt.brand ?? "",
    });
    // Pass the Western product price so the AWIN matcher can
    // penalize feed rows that are more expensive than the original —
    // a "dupe" that costs more than the thing it's duping isn't a
    // dupe.
    if (westernPrice != null && !isNaN(westernPrice)) {
      qs.set("westernPrice", String(westernPrice));
    }
    fetch(`/api/yesstyle-product?${qs.toString()}`)
      .then((r) => r.json())
      .then((data: Enrichment) => {
        if (cancelled) return;
        setEnrichment(data);
        setImageSource(data.imageUrl ? "primary" : data.fallbackImageUrl ? "fallback" : "none");
      })
      .catch((err) => {
        console.error("[KoreanDupeCard] enrichment failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingEnrichment(false);
      });
    return () => {
      cancelled = true;
    };
  }, [alt.name, alt.brand, westernPrice]);

  const displayPrice =
    enrichment?.matched && enrichment.price != null
      ? enrichment.price
      : num(alt.price);

  // When the AWIN feed gives us a real product match, prefer its
  // canonical title/brand over the AI's suggestion — otherwise the
  // card can claim "Some By Mi …" while the Buy button takes the user
  // to a MIZON product, which is misleading.
  const displayName =
    enrichment?.matched && enrichment.productTitle
      ? enrichment.productTitle
      : alt.name;
  const displayBrand =
    enrichment?.matched && enrichment.productBrand
      ? enrichment.productBrand
      : alt.brand;

  const yesstyleUrl =
    enrichment?.affiliateUrl ?? alt.yesstyle_url ?? "";

  const savings =
    westernPrice != null && displayPrice != null
      ? Math.max(0, Math.round(westernPrice - displayPrice))
      : null;

  const activeImageUrl =
    imageSource === "primary"
      ? enrichment?.imageUrl ?? null
      : imageSource === "fallback"
        ? enrichment?.fallbackImageUrl ?? null
        : null;

  const showImageSlot = loadingEnrichment || (enrichment?.matched && activeImageUrl);

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: CARD,
        border: `1px solid ${PINK}`,
        boxShadow:
          "0 0 0 1px rgba(255,51,102,0.15), 0 8px 32px rgba(255,51,102,0.12)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div
          className="text-xs uppercase"
          style={{ color: PINK, fontWeight: 600, letterSpacing: "0.18em" }}
        >
          K-beauty dupe
        </div>
        {alt.match_score != null && (
          <span
            className="rounded-full px-3 py-1 text-xs"
            style={{
              background: "rgba(0, 230, 118, 0.1)",
              color: GREEN,
              border: `1px solid ${GREEN}`,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            {Math.round(Number(alt.match_score))}% match
          </span>
        )}
      </div>

      {showImageSlot && (
        <div
          className="mt-3 mb-4 rounded-lg overflow-hidden"
          style={{
            aspectRatio: "1 / 1",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
            position: "relative",
          }}
        >
          {loadingEnrichment ? (
            <div
              className="absolute inset-0 kdupe-skeleton"
              aria-label="Loading product image"
            />
          ) : activeImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              // Always route through /api/image-proxy so the YesStyle
              // CDN sees a request with the right Referer (set inside
              // the proxy) instead of kdupe.co.
              src={`/api/image-proxy?url=${encodeURIComponent(activeImageUrl)}`}
              alt={enrichment?.productTitle ?? alt.name}
              loading="lazy"
              onError={(e) => {
                const proxied = (e.currentTarget as HTMLImageElement).src;
                console.error("[KoreanDupeCard] image failed to load", {
                  proxied,
                  upstream: activeImageUrl,
                  source: imageSource,
                  productTitle: enrichment?.productTitle,
                  productBrand: enrichment?.productBrand,
                });
                // aw_image_url is broken — try merchant_image_url. If
                // that's also exhausted, hide the slot.
                if (imageSource === "primary" && enrichment?.fallbackImageUrl) {
                  setImageSource("fallback");
                } else {
                  setImageSource("none");
                }
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : null}
        </div>
      )}

      <h2 className="text-2xl sm:text-3xl" style={syneStyle}>
        {displayName}
      </h2>
      {displayBrand && (
        <div
          className="mt-1 text-sm"
          style={{ color: MUTED, fontWeight: 300 }}
        >
          {displayBrand}
        </div>
      )}
      <div className="mt-4 text-3xl" style={{ color: GREEN, ...syneDisplay }}>
        {fmtPrice(displayPrice)}
      </div>

      {actives.length > 0 && (
        <div className="mt-6">
          <div
            className="text-xs uppercase mb-2"
            style={{
              color: MUTED,
              fontWeight: 500,
              letterSpacing: "0.18em",
            }}
          >
            Key actives
          </div>
          <ul className="space-y-1">
            {actives.map((a) => (
              <li
                key={a}
                className="text-sm"
                style={{ color: TEXT, fontWeight: 300 }}
              >
                <span style={{ marginRight: 6, color: GREEN }}>✓</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <BuyButton href={yesstyleUrl} label="Buy on YesStyle" />
      </div>

      {savings != null && savings > 0 && (
        <div
          className="mt-6 pt-4 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span
            className="text-xs uppercase"
            style={{
              color: MUTED,
              fontWeight: 500,
              letterSpacing: "0.18em",
            }}
          >
            You save
          </span>
          <span
            className="text-xl"
            style={{ color: GREEN, ...syneDisplay, fontWeight: 700 }}
          >
            ${savings.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

function BuyButton({
  href,
  label,
}: {
  href: string | null | undefined;
  label: string;
}) {
  if (!href || !href.trim()) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm transition-colors"
      style={{
        background: "transparent",
        border: `1px solid ${PINK}`,
        color: PINK,
        fontWeight: 600,
        letterSpacing: "-0.005em",
      }}
    >
      {label} →
    </a>
  );
}

function splitList(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return `$${Math.round(Number(n))}`;
}

function num(n: number | null | undefined): number | null {
  if (n == null || isNaN(Number(n))) return null;
  return Number(n);
}
