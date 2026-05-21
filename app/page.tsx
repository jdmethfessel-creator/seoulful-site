import Link from "next/link";
import BookmarkletDragButton from "@/components/BookmarkletDragButton";

const ROSE = "#c8535a";
const CREAM = "#fdf8f4";

const trending = [
  { western: "SkinCeuticals C E Ferulic", priceFrom: 185, priceTo: 22 },
  { western: "La Mer Moisturizer", priceFrom: 355, priceTo: 42 },
  { western: "Drunk Elephant B-Hydra", priceFrom: 48, priceTo: 19 },
  { western: "Tatcha Water Cream", priceFrom: 72, priceTo: 21 },
  { western: "Estee Lauder ANR", priceFrom: 115, priceTo: 18 },
];

const valueProps = [
  {
    title: "Ingredient Truth",
    body: "The EU bans 1,400+ ingredients from skincare. The US bans 11. Same brand, different formula.",
  },
  {
    title: "Korean Science",
    body: "Korea has more R&D per capita in cosmetics than any country on earth. The actives end up there first.",
  },
  {
    title: "Half the Price",
    body: "Same actives, packaged sensibly. You're paying for a Nordstrom counter, not better chemistry.",
  },
];

export default function Home() {
  return (
    <main style={{ background: CREAM }}>
      <nav
        className="flex justify-end px-6 pt-5"
        style={{ maxWidth: 1280, margin: "0 auto" }}
      >
        <Link
          href="/bookmarklet"
          className="text-sm"
          style={{
            color: "#6b6660",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          Browser bookmarklet →
        </Link>
      </nav>

      <section className="px-6 pt-10 pb-12 sm:pt-16 sm:pb-16 max-w-3xl mx-auto text-center">
        <h1
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
          className="text-6xl sm:text-7xl md:text-8xl"
        >
          Seoul<span style={{ color: ROSE }}>ful</span>
        </h1>

        <p
          className="mt-6 text-base sm:text-lg italic"
          style={{
            color: "#6b6660",
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontWeight: 400,
          }}
        >
          Where K-beauty meets ingredient science.
        </p>

        <form action="/search" className="mt-10 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            name="q"
            required
            placeholder="Paste a Sephora / Ulta / Kiehl's URL, or search any product..."
            autoComplete="off"
            className="flex-1 rounded-lg px-5 py-4 text-base outline-none transition-colors"
            style={{
              background: "#fff",
              border: "1px solid #e8ddd4",
              color: "#1a1a1a",
            }}
          />
          <button
            type="submit"
            className="rounded-lg px-6 py-4 text-base font-semibold whitespace-nowrap transition-transform"
            style={{ background: ROSE, color: "#fff" }}
          >
            Find Korean Alternative
          </button>
        </form>

        <div className="mt-8">
          <p
            className="text-xs uppercase tracking-widest mb-4"
            style={{ color: "#a39990", fontWeight: 600 }}
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
                    background: "#fff",
                    border: "1px solid #ead8cc",
                    color: "#3d3a36",
                  }}
                >
                  <span>{t.western}</span>
                  <span style={{ color: "#a39990" }}>
                    ${t.priceFrom} → <span style={{ color: ROSE, fontWeight: 600 }}>${t.priceTo}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 sm:mt-14 text-center">
          <h2
            className="text-lg sm:text-xl mb-1"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 500,
              color: "#3d3a36",
            }}
          >
            Find K-beauty dupes while you shop
          </h2>
          <p
            className="text-sm mb-4"
            style={{ color: "#6b6660", lineHeight: 1.6 }}
          >
            Drag this to your bookmarks bar, then click it on any Sephora,
            Ulta, or Kiehl&apos;s page.
          </p>
          <BookmarkletDragButton size="sm" />
        </div>
      </section>

      <section
        className="px-6 py-14 sm:py-20"
        style={{ borderTop: "1px solid #ead8cc", background: "#faf3eb" }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {valueProps.map((v) => (
            <div key={v.title} className="text-center md:text-left">
              <h3
                className="text-2xl sm:text-3xl mb-3"
                style={{
                  fontFamily: "var(--font-cormorant), Georgia, serif",
                  fontWeight: 500,
                  color: ROSE,
                }}
              >
                {v.title}
              </h3>
              <p className="text-sm sm:text-base leading-relaxed" style={{ color: "#4a4540" }}>
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer
        className="px-6 py-8 text-center text-xs"
        style={{ color: "#a39990", borderTop: "1px solid #ead8cc" }}
      >
        © 2026 Seoulful · Where K-beauty meets ingredient science.
      </footer>
    </main>
  );
}
