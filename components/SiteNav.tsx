"use client";

import Link from "next/link";
import { useAuth, useOpenPremiumModal } from "@/components/PremiumProvider";

const PINK = "#ff3366";
const GREEN = "#00e676";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

export default function SiteNav() {
  const { isPremium } = useAuth();
  const openModal = useOpenPremiumModal();

  return (
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

      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/routine"
          className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm rounded-md"
          style={{
            color: TEXT,
            textDecoration: "none",
            fontWeight: 400,
          }}
        >
          Build My Routine
        </Link>
        {isPremium && (
          <Link
            href="/saved"
            className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm rounded-md"
            style={{
              color: TEXT,
              textDecoration: "none",
              fontWeight: 400,
            }}
          >
            Saved
          </Link>
        )}
        <Link
          href="/bookmarklet"
          className="hidden md:inline-flex items-center px-3 py-1.5 text-sm rounded-md"
          style={{
            color: MUTED,
            textDecoration: "none",
            fontWeight: 400,
          }}
        >
          Bookmarklet
        </Link>

        {isPremium ? (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full"
            style={{
              background: "rgba(0, 230, 118, 0.1)",
              color: GREEN,
              border: `1px solid ${GREEN}`,
              fontFamily: "var(--font-syne), system-ui, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            Premium
          </span>
        ) : (
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center px-3 py-1.5 text-sm rounded-full"
            style={{
              background: "transparent",
              color: PINK,
              border: `1px solid ${PINK}`,
              fontFamily: "var(--font-syne), system-ui, sans-serif",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            Upgrade
          </button>
        )}
      </div>
    </nav>
  );
}
