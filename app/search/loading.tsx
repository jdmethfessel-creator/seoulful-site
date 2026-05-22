"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Scanning ingredient labels...",
  "Checking 10,000+ K-beauty formulas...",
  "Flagging fragrance and fillers...",
  "Calculating your savings...",
  "Finding your dupe...",
];

const PINK = "#ff3366";
const CARD = "#141414";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

const SYNE = "var(--font-syne), system-ui, sans-serif";

export default function SearchLoading() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setI((prev) => (prev + 1) % MESSAGES.length);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <main
      className="min-h-screen px-6 pt-10 pb-20"
      style={{ background: "#0a0a0a", color: TEXT }}
    >
      <div className="max-w-5xl mx-auto">
        <div
          className="rounded-xl p-10 sm:p-16 text-center"
          style={{
            background: CARD,
            border: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
            overflow: "hidden",
          }}
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="relative mx-auto"
            style={{ height: 56, maxWidth: 640 }}
          >
            {MESSAGES.map((m, idx) => (
              <div
                key={idx}
                className="absolute inset-0 flex items-center justify-center px-2"
                style={{
                  opacity: idx === i ? 1 : 0,
                  transform: idx === i ? "translateY(0)" : "translateY(4px)",
                  transition:
                    "opacity 420ms ease, transform 420ms ease",
                  color: PINK,
                  fontFamily: SYNE,
                  fontWeight: 800,
                  letterSpacing: "-0.025em",
                  fontSize: "clamp(1.25rem, 3.4vw, 1.75rem)",
                  lineHeight: 1.15,
                }}
              >
                {m}
              </div>
            ))}
          </div>

          <p
            className="mt-5 text-sm"
            style={{ color: MUTED, fontWeight: 300 }}
          >
            Our K-beauty intelligence engine is working.
          </p>

          <div
            className="mt-10 mx-auto rounded-full overflow-hidden"
            style={{
              maxWidth: 360,
              height: 4,
              background: "rgba(255,51,102,0.12)",
            }}
          >
            <div
              className="h-full kdupe-progress-bar"
              style={{ background: PINK }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
