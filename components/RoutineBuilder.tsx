"use client";

import { useEffect, useState } from "react";
import {
  useAuth,
  useOpenPremiumModal,
} from "@/components/PremiumProvider";
import RoutineCard from "@/components/RoutineCard";
import type { Routine, RoutineStep } from "@/lib/routine";

const PINK = "#ff3366";
const GREEN = "#00e676";
const AMBER = "#ffb74d";
const CARD = "#141414";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

const SYNE = "var(--font-syne), system-ui, sans-serif";

// Stub: real impl will persist to Supabase under the current user.
function saveRoutine(routine: Routine, productsInput: string) {
  console.log("[stub] saveRoutine", { routine, productsInput });
}

export default function RoutineBuilder() {
  const { isPremium } = useAuth();
  const openModal = useOpenPremiumModal();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [showShare, setShowShare] = useState(false);

  // Pop the upgrade modal once when a non-premium user lands here.
  useEffect(() => {
    if (!isPremium) openModal();
  }, [isPremium, openModal]);

  if (!isPremium) return <LockedTeaser onUnlock={openModal} />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const routineInput = input.trim();
    if (!routineInput) {
      setError("List your products or describe your routine to get started.");
      return;
    }
    setError(null);
    setLoading(true);
    setRoutine(null);
    setShowShare(false);
    try {
      const res = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routineInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Couldn't build a routine. Try again."
        );
        return;
      }
      setRoutine(data.routine as Routine);
      saveRoutine(data.routine as Routine, input);
    } catch (err) {
      console.error("[routine] submit failed:", err);
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 pt-10 pb-20">
      <div className="text-center mb-10">
        <div
          className="text-xs uppercase mb-3"
          style={{
            color: PINK,
            letterSpacing: "0.2em",
            fontWeight: 600,
          }}
        >
          Premium · Build My Routine
        </div>
        <h1
          className="text-4xl sm:text-5xl md:text-6xl"
          style={{
            fontFamily: SYNE,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.02,
            color: TEXT,
          }}
        >
          Paste your routine.
          <br />
          <span style={{ color: PINK }}>We&apos;ll K-beauty it.</span>
        </h1>
        <p
          className="mt-5 text-base sm:text-lg max-w-2xl mx-auto"
          style={{ color: MUTED, fontWeight: 300, lineHeight: 1.55 }}
        >
          List the Western products you use — or just describe your routine
          in plain English. We&apos;ll build a full K-beauty morning and
          evening routine, flag any ingredient conflicts, and show you what
          you&apos;ll save.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-w-2xl mx-auto">
        <label
          className="block text-xs uppercase mb-2"
          style={{
            color: MUTED,
            letterSpacing: "0.18em",
            fontWeight: 500,
          }}
        >
          Your current routine
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={8}
          placeholder={`List your products one per line, or just describe your routine in your own words.

Examples:
- SkinCeuticals C E Ferulic
- Drunk Elephant moisturizer
- I use a vitamin C serum in the morning and a retinol at night
- I spend about $300/month on skincare and use mostly Tatcha and La Mer`}
          className="w-full rounded-lg px-4 py-3 text-base outline-none"
          style={{
            background: CARD,
            border: "1px solid rgba(255,255,255,0.08)",
            color: TEXT,
            fontWeight: 300,
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            resize: "vertical",
            minHeight: 220,
          }}
        />
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <p className="text-xs" style={{ color: MUTED, fontWeight: 300 }}>
            We&apos;ll cross-check actives across the full routine.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg px-6 py-3 text-base whitespace-nowrap"
            style={{
              background: loading ? "rgba(255,51,102,0.4)" : PINK,
              color: "#fff",
              fontFamily: SYNE,
              fontWeight: 700,
              letterSpacing: "-0.005em",
              border: "none",
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Building..." : "Build My K-beauty Routine"}
          </button>
        </div>
        {error && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-sm"
            style={{
              background: "rgba(255,51,102,0.08)",
              border: "1px solid rgba(255,51,102,0.3)",
              color: PINK,
              fontWeight: 400,
            }}
          >
            {error}
          </div>
        )}
      </form>

      {routine && (
        <div className="mt-12">
          <Conflicts items={routine.summary.conflicts_detected} />

          {routine.has_specific_products && (
            <SummaryBar
              current={routine.summary.current_total}
              kdupe={routine.summary.kdupe_total}
              annual={routine.summary.annual_savings}
            />
          )}

          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${
              routine.has_specific_products ? "mt-6" : ""
            }`}
          >
            <RoutineColumn
              title="Morning"
              steps={routine.morning}
              showWestern={routine.has_specific_products}
            />
            <RoutineColumn
              title="Evening"
              steps={routine.evening}
              showWestern={routine.has_specific_products}
            />
          </div>

          <div className="mt-10 flex flex-col items-center gap-4">
            {!showShare ? (
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="rounded-lg px-5 py-3 text-base"
                style={{
                  background: "transparent",
                  border: `1px solid ${PINK}`,
                  color: PINK,
                  fontFamily: SYNE,
                  fontWeight: 700,
                  letterSpacing: "-0.005em",
                  cursor: "pointer",
                }}
              >
                Share My Routine →
              </button>
            ) : (
              <>
                <RoutineCard routine={routine} />
                <p
                  className="text-xs text-center"
                  style={{ color: MUTED, fontWeight: 300 }}
                >
                  Screenshot the card above to share on TikTok or Instagram.
                </p>
                <button
                  type="button"
                  onClick={() => setShowShare(false)}
                  className="text-xs underline"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: MUTED,
                    cursor: "pointer",
                  }}
                >
                  Hide share card
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LockedTeaser({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 pt-16 pb-24 text-center">
      <div
        className="text-xs uppercase mb-3"
        style={{
          color: PINK,
          letterSpacing: "0.2em",
          fontWeight: 600,
        }}
      >
        Premium feature
      </div>
      <h1
        className="text-4xl sm:text-5xl mb-3"
        style={{
          fontFamily: SYNE,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          color: TEXT,
        }}
      >
        Build My{" "}
        <span style={{ color: PINK }}>K-beauty routine</span>
      </h1>
      <p
        className="text-base sm:text-lg mb-8"
        style={{ color: MUTED, fontWeight: 300, lineHeight: 1.55 }}
      >
        Paste your current Western routine and we&apos;ll rebuild the whole
        thing in K-beauty — with conflict checking and savings totals.
        Available on kDupe Premium.
      </p>
      <button
        type="button"
        onClick={onUnlock}
        className="rounded-lg px-6 py-3 text-base"
        style={{
          background: PINK,
          color: "#fff",
          fontFamily: SYNE,
          fontWeight: 700,
          border: "none",
          cursor: "pointer",
          letterSpacing: "-0.005em",
        }}
      >
        Unlock Premium · $3.99/mo
      </button>
    </div>
  );
}

function Conflicts({ items }: { items: string[] }) {
  const real = (items ?? []).filter((s) => s && s.trim().length > 0);

  if (real.length === 0) {
    return (
      <div
        className="rounded-lg px-4 py-3 mb-6 text-sm flex gap-3 items-start"
        style={{
          background: "rgba(0, 230, 118, 0.08)",
          border: `1px solid ${GREEN}66`,
          color: GREEN,
          fontWeight: 400,
        }}
      >
        <span style={{ fontWeight: 700 }}>✓</span>
        <span>
          Your routine ingredients are compatible. No conflicts detected.
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg px-4 py-3 mb-6 text-sm flex gap-3 items-start"
      style={{
        background: "rgba(255, 183, 77, 0.08)",
        border: `1px solid ${AMBER}66`,
        color: AMBER,
        fontWeight: 400,
      }}
    >
      <span style={{ fontWeight: 700 }}>⚠</span>
      <div className="space-y-1.5">
        {real.map((c, i) => (
          <p key={i} style={{ lineHeight: 1.5 }}>
            {c}
          </p>
        ))}
      </div>
    </div>
  );
}

function SummaryBar({
  current,
  kdupe,
  annual,
}: {
  current: number;
  kdupe: number;
  annual: number;
}) {
  const monthly = Math.max(0, Math.round(current - kdupe));
  return (
    <div
      className="rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      style={{
        background: CARD,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="text-base sm:text-lg"
        style={{
          fontFamily: SYNE,
          fontWeight: 700,
          letterSpacing: "-0.015em",
          lineHeight: 1.3,
        }}
      >
        Your current routine costs{" "}
        <span style={{ color: MUTED, textDecoration: "line-through" }}>
          ${Math.round(current)}
        </span>
        /month. Your K-beauty routine costs{" "}
        <span style={{ color: GREEN }}>${Math.round(kdupe)}</span>
        /month.
      </div>
      <div
        className="text-right shrink-0"
        style={{ fontFamily: SYNE }}
      >
        <div
          className="text-xs uppercase"
          style={{
            color: MUTED,
            letterSpacing: "0.18em",
            fontWeight: 500,
          }}
        >
          You save
        </div>
        <div
          className="text-2xl sm:text-3xl"
          style={{
            color: GREEN,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          ${monthly}/mo
        </div>
        <div className="text-xs" style={{ color: GREEN, fontWeight: 500 }}>
          ${Math.max(0, Math.round(annual)).toLocaleString()}/yr
        </div>
      </div>
    </div>
  );
}

function RoutineColumn({
  title,
  steps,
  showWestern,
}: {
  title: string;
  steps: RoutineStep[];
  showWestern: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: CARD,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h2
        className="text-2xl mb-4"
        style={{ fontFamily: SYNE, fontWeight: 700, letterSpacing: "-0.02em" }}
      >
        {title}
      </h2>
      {steps.length === 0 ? (
        <p className="text-sm" style={{ color: MUTED, fontWeight: 300 }}>
          No steps in this routine.
        </p>
      ) : (
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <StepRow key={i} step={s} showWestern={showWestern} />
          ))}
        </ol>
      )}
    </div>
  );
}

function StepRow({
  step,
  showWestern,
}: {
  step: RoutineStep;
  showWestern: boolean;
}) {
  return (
    <li>
      <div
        className="text-xs uppercase mb-1"
        style={{
          color: PINK,
          letterSpacing: "0.18em",
          fontWeight: 600,
        }}
      >
        {step.step || "Step"}
      </div>
      <div
        className={
          showWestern ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : ""
        }
      >
        {showWestern && (
          <div>
            <div className="text-sm" style={{ color: TEXT, fontWeight: 300 }}>
              {step.western.brand ? `${step.western.brand} ` : ""}
              {step.western.name || "—"}
            </div>
            {step.western.price > 0 && (
              <div
                className="text-sm"
                style={{
                  color: MUTED,
                  textDecoration: "line-through",
                  fontFamily: SYNE,
                  fontWeight: 600,
                }}
              >
                ${Math.round(step.western.price)}
              </div>
            )}
          </div>
        )}
        <div>
          <div className="text-sm flex items-baseline gap-2 flex-wrap">
            <span style={{ color: TEXT, fontWeight: 400 }}>
              {step.korean.brand ? `${step.korean.brand} ` : ""}
              {step.korean.name || "—"}
            </span>
            {step.korean.match_score > 0 && (
              <span
                className="text-xs"
                style={{
                  color: GREEN,
                  border: `1px solid ${GREEN}`,
                  background: "rgba(0,230,118,0.1)",
                  borderRadius: 999,
                  padding: "1px 8px",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                {Math.round(step.korean.match_score)}% match
              </span>
            )}
          </div>
          {step.korean.price > 0 && (
            <div
              className="text-sm"
              style={{
                color: GREEN,
                fontFamily: SYNE,
                fontWeight: 700,
              }}
            >
              ${Math.round(step.korean.price)}
            </div>
          )}
          {step.korean.key_actives.length > 0 && (
            <div
              className="text-xs mt-1"
              style={{ color: MUTED, fontWeight: 300 }}
            >
              {step.korean.key_actives.slice(0, 4).join(" · ")}
            </div>
          )}
          {(step.korean.amazon_url || step.korean.yesstyle_url) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {step.korean.amazon_url && (
                <a
                  href={step.korean.amazon_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1 rounded-md"
                  style={{
                    border: `1px solid ${PINK}`,
                    color: PINK,
                    fontFamily: SYNE,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Amazon →
                </a>
              )}
              {step.korean.yesstyle_url && (
                <a
                  href={step.korean.yesstyle_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1 rounded-md"
                  style={{
                    border: `1px solid ${PINK}`,
                    color: PINK,
                    fontFamily: SYNE,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  YesStyle →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
