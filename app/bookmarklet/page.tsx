"use client";

import Link from "next/link";
import { useState } from "react";
import { BOOKMARKLET_HREF, BOOKMARKLET_READABLE } from "@/lib/bookmarklet";
import BookmarkletDragButton from "@/components/BookmarkletDragButton";

const PINK = "#ff3366";
const GREEN = "#00e676";
const BG = "#0a0a0a";
const CARD = "#141414";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

const syneStyle = {
  fontFamily: "var(--font-syne), system-ui, sans-serif",
  fontWeight: 700,
  letterSpacing: "-0.02em",
} as const;

export default function BookmarkletPage() {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_HREF);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // older browsers / locked-down clipboards — no fallback worth doing
    }
  }

  return (
    <main
      className="min-h-screen px-6 pt-10 pb-20"
      style={{ background: BG, color: TEXT }}
    >
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-block text-2xl sm:text-3xl mb-8"
          style={{
            ...syneStyle,
            fontWeight: 800,
            color: TEXT,
            textDecoration: "none",
          }}
        >
          k<span style={{ color: PINK }}>Dupe</span>
        </Link>

        <h1
          className="text-4xl sm:text-5xl mb-3"
          style={{
            ...syneStyle,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: TEXT,
          }}
        >
          The kDupe{" "}
          <span style={{ color: PINK }}>browser bookmarklet</span>
        </h1>
        <p
          className="text-base sm:text-lg mb-10"
          style={{ color: MUTED, lineHeight: 1.6, fontWeight: 300 }}
        >
          One click on any skincare product page and we&apos;ll open a kDupe
          tab with the K-beauty dupe.
        </p>

        <div
          className="rounded-xl p-6 sm:p-8 text-center"
          style={{
            background: CARD,
            border: "1px solid rgba(255,255,255,0.06)",
            marginBottom: "2rem",
          }}
        >
          <div
            className="text-xs uppercase mb-4"
            style={{
              color: MUTED,
              fontWeight: 500,
              letterSpacing: "0.18em",
            }}
          >
            Drag this button to your bookmarks bar
          </div>
          <BookmarkletDragButton />
          <div
            className="mt-4 text-sm"
            style={{ color: MUTED, fontWeight: 300 }}
          >
            Click and hold, then drag up to your bookmarks bar.
          </div>
        </div>

        <section className="mb-10">
          <h2 className="text-2xl sm:text-3xl mb-4" style={syneStyle}>
            How to install
          </h2>
          <ol
            className="space-y-3 text-base"
            style={{ color: TEXT, paddingLeft: 0, listStyle: "none" }}
          >
            {[
              "Make sure your browser's bookmarks bar is visible (View → Show Bookmarks Bar, or ⌘+Shift+B).",
              "Drag the pink ★ Save to kDupe button above onto the bookmarks bar.",
              "Browse to any skincare product page. Click the bookmark and kDupe opens the K-beauty dupe in a new tab.",
            ].map((step, i) => (
              <li
                key={i}
                className="flex gap-3 items-start"
                style={{
                  background: CARD,
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  padding: "0.875rem 1rem",
                  fontWeight: 300,
                }}
              >
                <span
                  style={{
                    flex: "0 0 28px",
                    height: 28,
                    borderRadius: "999px",
                    background: PINK,
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    fontFamily: "var(--font-syne), system-ui, sans-serif",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ lineHeight: 1.55 }}>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl sm:text-3xl mb-3" style={syneStyle}>
            Manual install
          </h2>
          <p
            className="text-sm mb-3"
            style={{ color: MUTED, lineHeight: 1.6, fontWeight: 300 }}
          >
            If dragging didn&apos;t work, create a new bookmark manually with
            the code below as the URL.
          </p>
          <div style={{ position: "relative" }}>
            <pre
              className="text-xs sm:text-sm overflow-x-auto rounded-lg p-4"
              style={{
                background: "#050505",
                color: TEXT,
                border: "1px solid rgba(255,255,255,0.06)",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              {BOOKMARKLET_READABLE}
            </pre>
            <button
              type="button"
              onClick={copyCode}
              className="absolute top-3 right-3 rounded-md px-3 py-1.5 text-xs"
              style={{
                background: copied ? GREEN : PINK,
                color: copied ? "#062" : "#fff",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-syne), system-ui, sans-serif",
                fontWeight: 700,
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p
            className="text-xs mt-3"
            style={{ color: MUTED, fontWeight: 300 }}
          >
            Note: bookmarklets must live on a single line in the bookmark URL.
            The pretty-printed version above is for reading only — copying it
            still pastes the working one-line code.
          </p>
        </section>

        <div className="text-center">
          <Link
            href="/"
            style={{
              color: PINK,
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "var(--font-syne), system-ui, sans-serif",
            }}
          >
            ← Back to kDupe
          </Link>
        </div>
      </div>
    </main>
  );
}
