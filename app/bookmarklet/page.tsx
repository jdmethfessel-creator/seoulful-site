"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BOOKMARKLET_HREF, BOOKMARKLET_READABLE } from "@/lib/bookmarklet";

const ROSE = "#c8535a";
const CREAM = "#fdf8f4";

export default function BookmarkletPage() {
  const [copied, setCopied] = useState(false);
  const dragLinkRef = useRef<HTMLAnchorElement>(null);

  // React 19 sanitizes javascript: URLs out of href props. Setting the
  // attribute imperatively after mount bypasses that, so dragging the
  // anchor to the bookmarks bar captures the real bookmarklet code.
  useEffect(() => {
    if (dragLinkRef.current) {
      dragLinkRef.current.setAttribute("href", BOOKMARKLET_HREF);
    }
  }, []);

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
    <main className="min-h-screen px-6 pt-10 pb-20" style={{ background: CREAM }}>
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-block text-2xl sm:text-3xl mb-8"
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontWeight: 500,
          }}
        >
          Seoul<span style={{ color: ROSE }}>ful</span>
        </Link>

        <h1
          className="text-4xl sm:text-5xl mb-3"
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontWeight: 500,
            lineHeight: 1.05,
          }}
        >
          The Seoulful{" "}
          <span style={{ color: ROSE }}>browser bookmarklet</span>
        </h1>
        <p
          className="text-base sm:text-lg mb-10"
          style={{ color: "#6b6660", lineHeight: 1.6 }}
        >
          One click on any skincare product page and we&apos;ll open a Seoulful
          tab with the Korean alternative. Works on Sephora, Ulta, Kiehl&apos;s,
          Drunk Elephant, Amazon, and most retailer sites.
        </p>

        {/* Drag target */}
        <div
          className="rounded-xl p-6 sm:p-8 text-center"
          style={{
            background: "#fff",
            border: "1px solid #ead8cc",
            marginBottom: "2rem",
          }}
        >
          <div
            className="text-xs uppercase tracking-widest mb-4"
            style={{ color: "#a39990", fontWeight: 600 }}
          >
            Drag this button to your bookmarks bar
          </div>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            ref={dragLinkRef}
            href="#"
            onClick={(e) => {
              // Prevent the bookmarklet from firing if a user clicks the
              // drag-target while on this page — we want them to install it,
              // not run it here.
              e.preventDefault();
            }}
            draggable
            className="inline-block rounded-lg px-6 py-3 text-base font-semibold cursor-grab select-none"
            style={{
              background: ROSE,
              color: "#fff",
              textDecoration: "none",
            }}
          >
            ★ Save to Seoulful
          </a>
          <div
            className="mt-4 text-sm"
            style={{ color: "#6b6660" }}
          >
            Click and hold, then drag up to your bookmarks bar.
          </div>
        </div>

        {/* Install instructions */}
        <section className="mb-10">
          <h2
            className="text-2xl sm:text-3xl mb-4"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 500,
            }}
          >
            How to install
          </h2>
          <ol
            className="space-y-3 text-base"
            style={{ color: "#3d3a36", paddingLeft: 0, listStyle: "none" }}
          >
            {[
              "Make sure your browser's bookmarks bar is visible (View → Show Bookmarks Bar, or ⌘+Shift+B).",
              "Drag the orange ★ Save to Seoulful button above onto the bookmarks bar.",
              "Browse to any product page on Sephora, Ulta, Kiehl's, etc. Click the bookmark and Seoulful opens the Korean alternative in a new tab.",
            ].map((step, i) => (
              <li
                key={i}
                className="flex gap-3 items-start"
                style={{
                  background: "#fff",
                  border: "1px solid #ead8cc",
                  borderRadius: 10,
                  padding: "0.875rem 1rem",
                }}
              >
                <span
                  style={{
                    flex: "0 0 28px",
                    height: 28,
                    borderRadius: "999px",
                    background: ROSE,
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ lineHeight: 1.55 }}>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Manual install */}
        <section className="mb-10">
          <h2
            className="text-2xl sm:text-3xl mb-3"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 500,
            }}
          >
            Manual install
          </h2>
          <p className="text-sm mb-3" style={{ color: "#6b6660", lineHeight: 1.6 }}>
            If dragging didn&apos;t work, create a new bookmark manually with
            the code below as the URL.
          </p>
          <div style={{ position: "relative" }}>
            <pre
              className="text-xs sm:text-sm overflow-x-auto rounded-lg p-4"
              style={{
                background: "#1a1a1a",
                color: "#fdf8f4",
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
              className="absolute top-3 right-3 rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{
                background: copied ? "#3f8a5f" : ROSE,
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: "#a39990" }}>
            Note: bookmarklets must live on a single line in the bookmark URL.
            The pretty-printed version above is for reading only — copying it
            still pastes the working one-line code.
          </p>
        </section>

        <div className="text-center">
          <Link
            href="/"
            style={{ color: ROSE, fontWeight: 600, textDecoration: "none" }}
          >
            ← Back to Seoulful
          </Link>
        </div>
      </div>
    </main>
  );
}
