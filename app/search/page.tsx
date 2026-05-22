import Link from "next/link";
import {
  generateIngredientSummaries,
  isUrlInput,
  searchFromUrl,
  searchProduct,
  type Alternative,
  type IngredientSummaries,
  type Product,
  type SearchResult,
} from "@/lib/search";
import KoreanDupeCard from "@/components/KoreanDupeCard";
import TikTokSearchTracker from "@/components/TikTokSearchTracker";

const PINK = "#ff3366";
const GREEN = "#00e676";
const AMBER = "#ffb74d";
const BG = "#0a0a0a";
const CARD = "#141414";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

type Params = { q?: string };

function fmtPrice(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return `$${Math.round(Number(n))}`;
}

function num(n: number | null | undefined): number | null {
  if (n == null || isNaN(Number(n))) return null;
  return Number(n);
}

const syneStyle = {
  fontFamily: "var(--font-syne), system-ui, sans-serif",
  fontWeight: 700,
  letterSpacing: "-0.02em",
} as const;

const syneDisplay = {
  fontFamily: "var(--font-syne), system-ui, sans-serif",
  fontWeight: 800,
  letterSpacing: "-0.03em",
} as const;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const urlMode = query && isUrlInput(query);

  let result: SearchResult | null = null;
  let scrapeError: string | null = null;
  if (query) {
    if (urlMode) {
      const r = await searchFromUrl(query);
      if (r.ok) result = r.result;
      else scrapeError = r.error;
    } else {
      result = await searchProduct(query);
    }
  }

  // Generate plain-English summaries to replace the tag/bullet
  // ingredient lists on both cards. Skip for the "already K-beauty"
  // notice path since there's no comparison to make.
  let summaries: IngredientSummaries = { western: null, dupe: null };
  if (result && !result.is_korean_brand && result.alternatives[0]) {
    summaries = await generateIngredientSummaries(
      result.product,
      result.alternatives[0]
    );
  }

  return (
    <main
      className="min-h-screen px-6 pt-10 pb-20"
      style={{ background: BG, color: TEXT }}
    >
      <div className="max-w-5xl mx-auto">
        <form action="/search" className="flex flex-col sm:flex-row gap-3 mb-10">
          <input
            type="text"
            name="q"
            defaultValue={query}
            required
            placeholder="Drunk Elephant, La Mer, SkinCeuticals..."
            className="flex-1 rounded-lg px-5 py-3 text-base outline-none"
            style={{
              background: CARD,
              border: "1px solid rgba(255,255,255,0.08)",
              color: TEXT,
              fontWeight: 300,
            }}
          />
          <button
            type="submit"
            className="rounded-lg px-6 py-3 text-base whitespace-nowrap"
            style={{ background: PINK, color: "#fff", ...syneStyle }}
          >
            Find your dupe
          </button>
        </form>

        {!query && (
          <EmptyState
            heading="Enter a product"
            body="Type any Western skincare product name — or paste a product URL — to find its K-beauty dupe."
          />
        )}

        {query && scrapeError && <ScrapeError query={query} error={scrapeError} />}

        {query && !scrapeError && !result && <NotFound query={query} />}

        {query && result && (
          <>
            {!result.is_korean_brand && result.alternatives[0] && (
              <TikTokSearchTracker query={query} />
            )}
            {result.source === "ai" && !result.is_korean_brand && (
              <div
                className="rounded-lg px-4 py-3 mb-6 text-sm"
                style={{
                  background: "rgba(255, 183, 77, 0.08)",
                  border: `1px solid ${AMBER}40`,
                  color: AMBER,
                  fontWeight: 400,
                }}
              >
                <strong style={{ color: AMBER, fontWeight: 600 }}>
                  Live dupe.
                </strong>{" "}
                {urlMode
                  ? "We pulled this product off the page and asked our K-beauty intelligence engine for the closest dupe."
                  : "Our K-beauty intelligence engine found this dupe in real time."}
              </div>
            )}

            {result.is_korean_brand ? (
              <KoreanBrandNotice product={result.product} />
            ) : (
              <ResultGrid
                product={result.product}
                alternative={result.alternatives[0]}
                summaries={summaries}
              />
            )}

            {!result.is_korean_brand && result.alternatives.length > 1 && (
              <div className="mt-8">
                <h2 className="text-xl sm:text-2xl mb-4" style={syneStyle}>
                  Other K-beauty dupes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.alternatives.slice(1).map((a) => (
                    <AltCard
                      key={a.id}
                      alt={a}
                      westernPrice={num(result.product.price)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function EmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <div
      className="rounded-lg p-8 text-center"
      style={{
        background: CARD,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h2 className="text-2xl mb-2" style={syneStyle}>
        {heading}
      </h2>
      <p style={{ color: MUTED, fontWeight: 300 }}>{body}</p>
    </div>
  );
}

function NotFound({ query }: { query: string }) {
  return (
    <div
      className="rounded-lg p-8 text-center"
      style={{
        background: CARD,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h2 className="text-2xl mb-2" style={syneStyle}>
        No dupe for &ldquo;{query}&rdquo;
      </h2>
      <p style={{ color: MUTED, fontWeight: 300 }}>
        We didn&apos;t find this product in our database, and our AI fallback
        didn&apos;t return a usable match. Try a different spelling, brand-first
        phrasing, or the product&apos;s full name.
      </p>
    </div>
  );
}

function ScrapeError({ query, error }: { query: string; error: string }) {
  return (
    <div
      className="rounded-lg p-8"
      style={{
        background: CARD,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h2 className="text-2xl mb-2" style={syneStyle}>
        Couldn&apos;t read that URL
      </h2>
      <p
        style={{
          color: MUTED,
          marginBottom: 12,
          wordBreak: "break-all",
          fontWeight: 300,
        }}
      >
        <span style={{ color: MUTED, opacity: 0.7 }}>URL:</span> {query}
      </p>
      <p style={{ color: MUTED, fontWeight: 300 }}>{error}</p>
    </div>
  );
}

function KoreanBrandNotice({ product }: { product: Product }) {
  const display = [product.brand, product.name]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .trim();
  return (
    <div
      className="rounded-xl p-8 sm:p-10 text-center"
      style={{
        background: CARD,
        border: `1px solid ${GREEN}66`,
        boxShadow: "0 0 0 1px rgba(0,230,118,0.10), 0 8px 32px rgba(0,230,118,0.10)",
      }}
    >
      <div
        className="text-xs uppercase mb-3"
        style={{
          color: GREEN,
          letterSpacing: "0.2em",
          fontWeight: 700,
        }}
      >
        Already K-beauty ✓
      </div>
      <h2
        className="text-2xl sm:text-3xl mb-3"
        style={{ ...syneStyle, fontWeight: 800, letterSpacing: "-0.025em" }}
      >
        This is already a K-beauty product.
      </h2>
      {display && (
        <p
          className="text-sm sm:text-base mb-4"
          style={{ color: TEXT, fontWeight: 300 }}
        >
          <span style={{ color: MUTED }}>You searched:</span>{" "}
          <span style={{ color: TEXT, fontWeight: 400 }}>{display}</span>
        </p>
      )}
      <p
        className="text-base"
        style={{ color: MUTED, fontWeight: 300, lineHeight: 1.55 }}
      >
        Search a Western brand to find your dupe.
      </p>
    </div>
  );
}

function ResultGrid({
  product,
  alternative,
  summaries,
}: {
  product: Product;
  alternative: Alternative | undefined;
  summaries: IngredientSummaries;
}) {
  // On mobile we use flex-col-reverse so the K-beauty dupe lands
  // above the western product (it's the answer, not the question).
  // On md+ we switch back to a 2-col grid where source order = visual
  // order, so the western card stays on the left.
  return (
    <div className="flex flex-col-reverse gap-6 md:grid md:grid-cols-2">
      <WesternCard product={product} summary={summaries.western} />
      {alternative ? (
        <KoreanDupeCard
          alt={alternative}
          westernPrice={num(product.price)}
          summary={summaries.dupe}
        />
      ) : (
        <EmptyState
          heading="No K-beauty dupe yet"
          body="We have this product on file but haven't added a K-beauty dupe. Check back soon."
        />
      )}
    </div>
  );
}

function WesternCard({
  product,
  summary,
}: {
  product: Product;
  summary: string | null;
}) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: CARD,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="text-xs uppercase mb-2"
        style={{ color: MUTED, fontWeight: 500, letterSpacing: "0.18em" }}
      >
        Western product
      </div>
      <h2 className="text-2xl sm:text-3xl" style={syneStyle}>
        {product.name}
      </h2>
      {product.brand && (
        <div className="mt-1 text-sm" style={{ color: MUTED, fontWeight: 300 }}>
          {product.brand}
          {product.category && <> · {product.category}</>}
        </div>
      )}
      <div
        className="mt-4 text-3xl"
        style={{
          color: MUTED,
          textDecoration: "line-through",
          ...syneDisplay,
        }}
      >
        {fmtPrice(product.price)}
      </div>

      {summary && (
        <p
          className="mt-6 text-sm sm:text-base"
          style={{ color: TEXT, fontWeight: 300, lineHeight: 1.6 }}
        >
          {summary}
        </p>
      )}
    </div>
  );
}

function AltCard({
  alt,
  westernPrice,
}: {
  alt: Alternative;
  westernPrice: number | null;
}) {
  const altPrice = num(alt.price);
  const savings =
    westernPrice != null && altPrice != null
      ? Math.max(0, Math.round(westernPrice - altPrice))
      : null;

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: CARD,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg sm:text-xl" style={syneStyle}>
            {alt.name}
          </h3>
          {alt.brand && (
            <div className="text-xs" style={{ color: MUTED, fontWeight: 300 }}>
              {alt.brand}
            </div>
          )}
        </div>
        <div className="text-right">
          <div
            className="text-xl"
            style={{ color: GREEN, ...syneDisplay, fontWeight: 700 }}
          >
            {fmtPrice(alt.price)}
          </div>
          {alt.match_score != null && (
            <div
              className="text-xs"
              style={{ color: GREEN, fontWeight: 500 }}
            >
              {Math.round(Number(alt.match_score))}% match
            </div>
          )}
        </div>
      </div>
      {savings != null && savings > 0 && (
        <div
          className="mt-3 pt-3 flex items-center justify-between text-xs"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span
            style={{
              color: MUTED,
              fontWeight: 500,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            You save
          </span>
          <span style={{ color: GREEN, fontWeight: 600 }}>
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
