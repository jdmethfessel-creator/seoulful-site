"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  useAuth,
  useOpenPremiumModal,
} from "@/components/PremiumProvider";

const PINK = "#ff3366";
const CARD = "#141414";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";
const SYNE = "var(--font-syne), system-ui, sans-serif";

export default function SavedPage() {
  const { isPremium } = useAuth();
  const openModal = useOpenPremiumModal();

  useEffect(() => {
    if (!isPremium) openModal();
  }, [isPremium, openModal]);

  return (
    <main
      style={{ background: "#0a0a0a", color: TEXT, minHeight: "100vh" }}
    >
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        <div
          className="text-xs uppercase mb-3"
          style={{
            color: PINK,
            letterSpacing: "0.2em",
            fontWeight: 600,
          }}
        >
          Premium · Saved
        </div>
        <h1
          className="text-4xl sm:text-5xl mb-3"
          style={{
            fontFamily: SYNE,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          Your saved routines
        </h1>

        {!isPremium ? (
          <p
            className="text-base mb-6"
            style={{ color: MUTED, fontWeight: 300, lineHeight: 1.55 }}
          >
            Saved routines are a kDupe Premium feature. Unlock to keep
            routines you build and revisit them later.
          </p>
        ) : (
          <p
            className="text-base mb-8"
            style={{ color: MUTED, fontWeight: 300, lineHeight: 1.55 }}
          >
            Every routine you build with kDupe will appear here.
          </p>
        )}

        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: CARD,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p
            className="text-base mb-5"
            style={{ color: MUTED, fontWeight: 300 }}
          >
            Your saved routines will appear here.
          </p>
          <Link
            href="/routine"
            className="inline-block rounded-lg px-5 py-2.5 text-sm"
            style={{
              background: PINK,
              color: "#fff",
              fontFamily: SYNE,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Build a routine →
          </Link>
        </div>
      </div>
    </main>
  );
}
