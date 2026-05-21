import Link from "next/link";
import {
  isUrlInput,
  searchFromUrl,
  searchProduct,
  type Alternative,
  type Product,
  type SearchResult,
} from "@/lib/search";

const ROSE = "#c8535a";
const GREEN = "#3f8a5f";
const AMBER = "#b87333";

type Params = { q?: string };

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

  return (
    <main className="min-h-screen px-6 pt-10 pb-20" style={{ background: "#fdf8f4" }}>
      {/* Header — back link + repeat search bar */}
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="inline-block text-2xl sm:text-3xl mb-6"
          style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 500 }}
        >
          Seoul<span style={{ color: ROSE }}>ful</span>
        </Link>

        <form action="/search" className="flex flex-col sm:flex-row gap-3 mb-10">
          <input
            type="text"
            name="q"
            defaultValue={query}
            required
            placeholder="Paste a Sephora / Ulta / Kiehl's URL, or type a product name..."
            className="flex-1 rounded-lg px-5 py-3 text-base outline-none"
            style={{ background: "#fff", border: "1px solid #e8ddd4" }}
          />
          <button
            type="submit"
            className="rounded-lg px-6 py-3 text-base font-semibold whitespace-nowrap"
            style={{ background: ROSE, color: "#fff" }}
          >
            Find Korean Alternative
          </button>
        </form>

        {!query && (
          <EmptyState
            heading="Enter a product"
            body="Type any Western skincare product name — or paste a Sephora / Ulta / Kiehl's URL — to find its Korean alternative."
          />
        )}

        {query && scrapeError && <ScrapeError query={query} error={scrapeError} />}

        {query && !scrapeError && !result && <NotFound query={query} />}

        {query && result && (
          <>
            {result.source === "ai" && (
              <div
                className="rounded-lg px-4 py-3 mb-6 text-sm"
                style={{ background: "#fff5e9", border: `1px solid ${AMBER}40`, color: "#7a4d20" }}
              >
                <strong>Live match.</strong>{" "}
                {urlMode
                  ? "We pulled this product off the page and asked our K-beauty research agent for the best Korean alternative."
                  : "Our K-beauty research agent found this in real time."}
              </div>
            )}

            <ResultGrid product={result.product} alternative={result.alternatives[0]} />

            {result.alternatives.length > 1 && (
              <div className="mt-8">
                <h2
                  className="text-xl sm:text-2xl mb-4"
                  style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 500 }}
                >
                  Other Korean alternatives
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.alternatives.slice(1).map((a) => (
                    <AltCard key={a.id} alt={a} />
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
      style={{ background: "#fff", border: "1px solid #ead8cc" }}
    >
      <h2
        className="text-2xl mb-2"
        style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 500 }}
      >
        {heading}
      </h2>
      <p style={{ color: "#6b6660" }}>{body}</p>
    </div>
  );
}

function NotFound({ query }: { query: string }) {
  return (
    <div
      className="rounded-lg p-8 text-center"
      style={{ background: "#fff", border: "1px solid #ead8cc" }}
    >
      <h2
        className="text-2xl mb-2"
        style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 500 }}
      >
        No match for &ldquo;{query}&rdquo;
      </h2>
      <p style={{ color: "#6b6660" }}>
        We didn&apos;t find this product in our database, and our AI fallback didn&apos;t return a usable match.
        Try a different spelling, brand-first phrasing, or the product&apos;s full name.
      </p>
    </div>
  );
}

function ScrapeError({ query, error }: { query: string; error: string }) {
  return (
    <div
      className="rounded-lg p-8"
      style={{ background: "#fff", border: "1px solid #ead8cc" }}
    >
      <h2
        className="text-2xl mb-2"
        style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 500 }}
      >
        Couldn&apos;t read that URL
      </h2>
      <p style={{ color: "#6b6660", marginBottom: 12, wordBreak: "break-all" }}>
        <span style={{ color: "#a39990" }}>URL:</span> {query}
      </p>
      <p style={{ color: "#6b6660" }}>{error}</p>
    </div>
  );
}

function ResultGrid({
  product,
  alternative,
}: {
  product: Product;
  alternative: Alternative | undefined;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <WesternCard product={product} />
      {alternative ? (
        <KoreanCard alt={alternative} />
      ) : (
        <EmptyState
          heading="No Korean alternative yet"
          body="We have this product on file but haven't added a Korean alternative. Check back soon."
        />
      )}
    </div>
  );
}

function WesternCard({ product }: { product: Product }) {
  const flagged = splitList(product.flagged_ingredients);
  const actives = splitList(product.key_actives);
  return (
    <div
      className="rounded-lg p-6"
      style={{ background: "#fff", border: "1px solid #ead8cc" }}
    >
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#a39990", fontWeight: 600 }}>
        Western product
      </div>
      <h2
        className="text-2xl sm:text-3xl"
        style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 500 }}
      >
        {product.name}
      </h2>
      {product.brand && (
        <div className="mt-1 text-sm" style={{ color: "#6b6660" }}>
          {product.brand}
          {product.category && <> · {product.category}</>}
        </div>
      )}
      <div className="mt-4 text-3xl" style={{ color: ROSE, fontWeight: 700, fontFamily: "var(--font-cormorant), Georgia, serif" }}>
        {fmtPrice(product.price)}
      </div>

      {flagged.length > 0 && (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: AMBER, fontWeight: 600 }}>
            Flagged ingredients
          </div>
          <ul className="space-y-1">
            {flagged.map((f) => (
              <li key={f} className="text-sm" style={{ color: "#4a4540" }}>
                <span style={{ marginRight: 6 }}>⚠️</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {actives.length > 0 && (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: GREEN, fontWeight: 600 }}>
            Key actives
          </div>
          <ul className="space-y-1">
            {actives.map((a) => (
              <li key={a} className="text-sm" style={{ color: "#4a4540" }}>
                <span style={{ marginRight: 6 }}>✓</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KoreanCard({ alt }: { alt: Alternative }) {
  const actives = splitList(alt.key_actives);
  return (
    <div
      className="rounded-lg p-6"
      style={{
        background: "#fff",
        border: `2px solid ${ROSE}`,
        boxShadow: "0 8px 24px rgba(200,83,90,0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-xs uppercase tracking-widest" style={{ color: ROSE, fontWeight: 600 }}>
          Korean alternative
        </div>
        {alt.match_score != null && (
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: ROSE, color: "#fff" }}
          >
            {Math.round(Number(alt.match_score))}% match
          </span>
        )}
      </div>
      <h2
        className="text-2xl sm:text-3xl"
        style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 500 }}
      >
        {alt.name}
      </h2>
      {alt.brand && (
        <div className="mt-1 text-sm" style={{ color: "#6b6660" }}>
          {alt.brand}
        </div>
      )}
      <div className="mt-4 text-3xl" style={{ color: GREEN, fontWeight: 700, fontFamily: "var(--font-cormorant), Georgia, serif" }}>
        {fmtPrice(alt.price)}
      </div>

      {actives.length > 0 && (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: GREEN, fontWeight: 600 }}>
            Key actives
          </div>
          <ul className="space-y-1">
            {actives.map((a) => (
              <li key={a} className="text-sm" style={{ color: "#4a4540" }}>
                <span style={{ marginRight: 6 }}>✓</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <BuyButton href={alt.amazon_url} label="Buy on Amazon" />
        <BuyButton href={alt.sephora_url} label="Buy on Sephora" />
        <BuyButton href={alt.yesstyle_url} label="Buy on YesStyle" />
      </div>
    </div>
  );
}

function AltCard({ alt }: { alt: Alternative }) {
  return (
    <div
      className="rounded-lg p-5"
      style={{ background: "#fff", border: "1px solid #ead8cc" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3
            className="text-lg sm:text-xl"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 500 }}
          >
            {alt.name}
          </h3>
          {alt.brand && (
            <div className="text-xs" style={{ color: "#6b6660" }}>{alt.brand}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xl" style={{ color: GREEN, fontWeight: 600 }}>
            {fmtPrice(alt.price)}
          </div>
          {alt.match_score != null && (
            <div className="text-xs" style={{ color: "#a39990" }}>
              {Math.round(Number(alt.match_score))}% match
            </div>
          )}
        </div>
      </div>
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
      className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors"
      style={{
        background: "#fff",
        border: `1px solid ${ROSE}`,
        color: ROSE,
      }}
    >
      {label} →
    </a>
  );
}
