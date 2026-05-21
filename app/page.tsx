import Link from "next/link";
import BookmarkletDragButton from "@/components/BookmarkletDragButton";

const PINK = "#ff3366";
const GREEN = "#00e676";
const BG = "#0a0a0a";
const CARD = "#141414";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

const trending = [
  { western: "SkinCeuticals C E Ferulic", priceFrom: 185, priceTo: 22 },
  { western: "La Mer Moisturizer", priceFrom: 355, priceTo: 42 },
  { western: "Drunk Elephant B-Hydra", priceFrom: 48, priceTo: 19 },
  { western: "Tatcha Water Cream", priceFrom: 72, priceTo: 21 },
  { western: "Estee Lauder ANR", priceFrom: 115, priceTo: 18 },
];

const tickerItems = [
  "La Mer $355 → $42",
  "SkinCeuticals CE Ferulic $185 → $22",
  "Drunk Elephant B-Hydra $48 → $19",
  "Tatcha Water Cream $72 → $21",
  "Estée Lauder ANR $115 → $18",
  "Kiehl's Facial Fuel $42 → $28",
];

const valueProps = [
  {
    title: "Cleaner by Law",
    body: "The EU bans 1,400+ ingredients from skincare. The US bans 11. Korean brands formulate to the stricter standard. Your Western product doesn't.",
  },
  {
    title: "Better Formulated",
    body: "Korea has more cosmetic R&D per capita than any country on earth. K-beauty brands compete on formula because their consumers read ingredient labels. Western brands compete on marketing.",
  },
  {
    title: "A Fraction of the Price",
    body: "You're not paying for better chemistry. You're paying for a Sephora counter, a celebrity campaign, and a box. kDupe finds what actually works.",
  },
];

export default function Home() {
  return (
    <main style={{ background: BG, color: TEXT }}>
      <nav
        className="sticky top-0 z-30 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(10, 10, 10, 0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Link
          href="/"
          className="text-2xl"
          style={{
            fontFamily: "var(--font-syne), system-ui, sans-serif",
            fontWeight: 800,
            color: TEXT,
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          k<span style={{ color: PINK }}>Dupe</span>
        </Link>
        <Link
          href="/bookmarklet"
          className="hidden sm:inline text-sm"
          style={{
            color: MUTED,
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          Browser bookmarklet →
        </Link>
      </nav>

      <section className="px-6 pt-14 pb-10 sm:pt-20 sm:pb-12 max-w-3xl mx-auto text-center">
        <h1
          style={{
            fontFamily: "var(--font-syne), system-ui, sans-serif",
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
            color: TEXT,
          }}
          className="text-5xl sm:text-7xl md:text-8xl"
        >
          Better ingredients, cleaner formula,
          <br />
          <span style={{ color: PINK }}>lower price.</span>
        </h1>

        <p
          className="mt-7 text-base sm:text-lg max-w-2xl mx-auto"
          style={{
            color: MUTED,
            fontWeight: 300,
            lineHeight: 1.55,
          }}
        >
          Paste any product and find the K-beauty alternative that works just
          as hard, with cleaner ingredients and a lower price tag.
        </p>

        <form action="/search" className="mt-10 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            name="q"
            required
            placeholder="Drunk Elephant, La Mer, SkinCeuticals..."
            autoComplete="off"
            className="flex-1 rounded-lg px-5 py-4 text-base outline-none transition-colors"
            style={{
              background: CARD,
              border: "1px solid rgba(255,255,255,0.08)",
              color: TEXT,
              fontWeight: 300,
            }}
          />
          <button
            type="submit"
            className="rounded-lg px-6 py-4 text-base whitespace-nowrap transition-transform"
            style={{
              background: PINK,
              color: "#fff",
              fontFamily: "var(--font-syne), system-ui, sans-serif",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Find your dupe
          </button>
        </form>

        <div className="mt-8">
          <p
            className="text-xs uppercase tracking-widest mb-4"
            style={{ color: MUTED, fontWeight: 500, letterSpacing: "0.18em" }}
          >
            Trending searches
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {trending.map((t) => (
              <li key={t.western}>
                <Link
                  href={`/search?q=${encodeURIComponent(t.western)}`}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
                  style={{
                    background: CARD,
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: TEXT,
                    fontWeight: 300,
                  }}
                >
                  <span>{t.western}</span>
                  <span style={{ color: MUTED }}>
                    ${t.priceFrom} →{" "}
                    <span style={{ color: GREEN, fontWeight: 500 }}>
                      ${t.priceTo}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="overflow-hidden py-5"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "#0d0d0d",
        }}
        aria-label="Featured savings"
      >
        <div
          className="kdupe-ticker-track flex whitespace-nowrap"
          style={{ width: "max-content" }}
        >
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span
              key={i}
              className="text-sm sm:text-base px-6"
              style={{
                color: TEXT,
                fontWeight: 300,
                letterSpacing: "0.01em",
              }}
            >
              <TickerLine text={item} />
              <span style={{ color: PINK, margin: "0 0 0 1.25rem" }}>·</span>
            </span>
          ))}
        </div>
      </section>

      <section className="hidden sm:block px-6 py-14 max-w-3xl mx-auto text-center">
        <h2
          className="text-2xl sm:text-3xl mb-2"
          style={{
            fontFamily: "var(--font-syne), system-ui, sans-serif",
            fontWeight: 700,
            color: TEXT,
            letterSpacing: "-0.02em",
          }}
        >
          Find K-beauty dupes while you shop
        </h2>
        <p
          className="text-sm mb-5"
          style={{ color: MUTED, lineHeight: 1.6, fontWeight: 300 }}
        >
          Drag this to your bookmarks bar, then click it on any skincare
          product page.
        </p>
        <BookmarkletDragButton size="sm" />
      </section>

      <section
        className="px-6 py-16 sm:py-20"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "#0d0d0d",
        }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          {valueProps.map((v) => (
            <div key={v.title} className="text-center md:text-left">
              <h3
                className="text-xl sm:text-2xl mb-3"
                style={{
                  fontFamily: "var(--font-syne), system-ui, sans-serif",
                  fontWeight: 700,
                  color: PINK,
                  letterSpacing: "-0.02em",
                }}
              >
                {v.title}
              </h3>
              <p
                className="text-sm sm:text-base leading-relaxed"
                style={{ color: MUTED, fontWeight: 300 }}
              >
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer
        className="px-6 py-8 text-center text-xs"
        style={{
          color: MUTED,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontWeight: 300,
        }}
      >
        kDupe · K-beauty intelligence. Free forever.
      </footer>
    </main>
  );
}

function TickerLine({ text }: { text: string }) {
  // Render the "$X → $Y" segment with the new price highlighted in green.
  const match = text.match(/^(.*?)(\$\d+)\s*→\s*(\$\d+)$/);
  if (!match) return <>{text}</>;
  const [, prefix, from, to] = match;
  return (
    <>
      <span>{prefix}</span>
      <span style={{ color: MUTED, textDecoration: "line-through" }}>
        {from}
      </span>
      <span style={{ color: MUTED, margin: "0 0.4rem" }}>→</span>
      <span style={{ color: GREEN, fontWeight: 500 }}>{to}</span>
    </>
  );
}
