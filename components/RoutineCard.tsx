"use client";

import type { Routine } from "@/lib/routine";

const PINK = "#ff3366";
const GREEN = "#00e676";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

// Shareable, screenshot-friendly summary card for a generated routine.
// Designed to look good cropped to a 4:5 portrait on TikTok / Instagram.

export default function RoutineCard({ routine }: { routine: Routine }) {
  const annual = Math.max(0, Math.round(routine.summary.annual_savings));
  const showSavings = routine.has_specific_products && annual > 0;

  return (
    <div
      className="mx-auto rounded-3xl overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 0% 0%, rgba(255,51,102,0.18) 0%, rgba(10,10,10,0) 55%), radial-gradient(120% 80% at 100% 100%, rgba(0,230,118,0.14) 0%, rgba(10,10,10,0) 60%), #0a0a0a",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "2rem 1.75rem",
        maxWidth: 540,
        color: TEXT,
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div
          className="text-2xl"
          style={{
            fontFamily: "var(--font-syne), system-ui, sans-serif",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          k<span style={{ color: PINK }}>Dupe</span>
        </div>
        <div
          className="text-xs uppercase"
          style={{
            color: MUTED,
            letterSpacing: "0.18em",
            fontWeight: 500,
          }}
        >
          My routine
        </div>
      </div>

      <h2
        className="text-3xl sm:text-4xl"
        style={{
          fontFamily: "var(--font-syne), system-ui, sans-serif",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
        }}
      >
        {showSavings ? (
          <>
            I switched my routine to K-beauty and{" "}
            <span style={{ color: GREEN }}>
              saved ${annual.toLocaleString()}/year
            </span>
          </>
        ) : (
          <>
            My new{" "}
            <span style={{ color: GREEN }}>K-beauty routine</span>
          </>
        )}
      </h2>

      <div className="grid grid-cols-2 gap-4 mt-7">
        <CardColumn title="Morning" steps={routine.morning} />
        <CardColumn title="Evening" steps={routine.evening} />
      </div>

      <div
        className="mt-7 pt-5 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        {showSavings ? (
          <div className="flex flex-col">
            <span
              className="text-xs uppercase"
              style={{
                color: MUTED,
                letterSpacing: "0.18em",
                fontWeight: 500,
              }}
            >
              Monthly
            </span>
            <span
              className="text-lg"
              style={{
                fontFamily: "var(--font-syne), system-ui, sans-serif",
                fontWeight: 700,
              }}
            >
              <span style={{ color: MUTED, textDecoration: "line-through" }}>
                ${Math.round(routine.summary.current_total)}
              </span>{" "}
              <span style={{ color: GREEN }}>
                ${Math.round(routine.summary.kdupe_total)}
              </span>
            </span>
          </div>
        ) : (
          <span
            className="text-xs uppercase"
            style={{
              color: MUTED,
              letterSpacing: "0.18em",
              fontWeight: 500,
            }}
          >
            Built with kDupe
          </span>
        )}
        <div
          className="text-sm"
          style={{
            color: PINK,
            fontFamily: "var(--font-syne), system-ui, sans-serif",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          kdupe.co
        </div>
      </div>
    </div>
  );
}

function CardColumn({
  title,
  steps,
}: {
  title: string;
  steps: Routine["morning"];
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: "1rem 0.9rem",
      }}
    >
      <div
        className="text-xs uppercase mb-3"
        style={{
          color: PINK,
          letterSpacing: "0.18em",
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      <ol className="space-y-2.5">
        {steps.length === 0 && (
          <li className="text-xs" style={{ color: MUTED, fontWeight: 300 }}>
            No products in this routine.
          </li>
        )}
        {steps.map((s, i) => (
          <li key={i} className="text-xs leading-snug">
            <div
              style={{
                color: MUTED,
                fontWeight: 500,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontSize: 10,
              }}
            >
              {s.step || "Step"}
            </div>
            <div style={{ color: TEXT, fontWeight: 400 }}>
              {s.korean.brand ? `${s.korean.brand} ` : ""}
              {s.korean.name || "—"}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
