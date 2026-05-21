"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Stub-mode auth/premium state. We will swap this for a real Supabase
// session + Stripe entitlement check once keys are live.

const PINK = "#ff3366";
const GREEN = "#00e676";
const CARD = "#141414";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

export type AuthUser = {
  id: string;
  email: string;
} | null;

type AuthState = {
  user: AuthUser;
  isPremium: boolean;
};

type PremiumCtx = AuthState & {
  openPremiumModal: () => void;
  closePremiumModal: () => void;
};

const PremiumContext = createContext<PremiumCtx | null>(null);

const PREMIUM_FEATURES = [
  {
    title: "Build My Routine",
    body: "Paste your full Western routine, get a K-beauty version with conflict checking.",
  },
  {
    title: "Saved routines & history",
    body: "Keep every dupe and routine you've built, ready to revisit and tweak.",
  },
  {
    title: "Shareable routine cards",
    body: "Generate a beautiful card to post your switch on TikTok and Instagram.",
  },
];

export function PremiumProvider({ children }: { children: ReactNode }) {
  // Stub: TEMP — forced premium for end-to-end routine testing without
  // Stripe. Flip isPremium back to false once Supabase/Stripe land.
  const [state] = useState<AuthState>({ user: null, isPremium: true });
  const [open, setOpen] = useState(false);

  const openPremiumModal = useCallback(() => setOpen(true), []);
  const closePremiumModal = useCallback(() => setOpen(false), []);

  const value = useMemo<PremiumCtx>(
    () => ({ ...state, openPremiumModal, closePremiumModal }),
    [state, openPremiumModal, closePremiumModal]
  );

  return (
    <PremiumContext.Provider value={value}>
      {children}
      {open && <PremiumModal onClose={closePremiumModal} />}
    </PremiumContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(PremiumContext);
  if (!ctx) return { user: null, isPremium: false };
  return { user: ctx.user, isPremium: ctx.isPremium };
}

export function usePremium(): boolean {
  return useAuth().isPremium;
}

export function useOpenPremiumModal(): () => void {
  const ctx = useContext(PremiumContext);
  return ctx?.openPremiumModal ?? (() => {});
}

// Stubbed billing handler. Real impl will hit a Stripe Checkout server
// action; for now we just log so we can verify the wiring.
export function handleSubscribe(): void {
  console.log("[stub] handleSubscribe — start free trial $3.99/month");
}

function PremiumModal({ onClose }: { onClose: () => void }) {
  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl"
        style={{
          background: CARD,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,51,102,0.15)",
          padding: "2rem 1.75rem",
          color: TEXT,
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute"
          style={{
            top: 12,
            right: 14,
            background: "transparent",
            border: "none",
            color: MUTED,
            cursor: "pointer",
            fontSize: 22,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>

        <div
          className="text-xs uppercase"
          style={{
            color: PINK,
            fontWeight: 600,
            letterSpacing: "0.2em",
            marginBottom: 8,
          }}
        >
          kDupe Premium
        </div>
        <h2
          className="text-3xl mb-2"
          style={{
            fontFamily: "var(--font-syne), system-ui, sans-serif",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
          }}
        >
          Unlock kDupe Premium
        </h2>
        <div className="flex items-baseline gap-2 mb-5">
          <span
            className="text-4xl"
            style={{
              fontFamily: "var(--font-syne), system-ui, sans-serif",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: GREEN,
            }}
          >
            $3.99
          </span>
          <span style={{ color: MUTED, fontWeight: 300 }}>/month</span>
        </div>

        <ul className="space-y-3 mb-6">
          {PREMIUM_FEATURES.map((f) => (
            <li
              key={f.title}
              className="flex gap-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 10,
                padding: "0.75rem 0.9rem",
              }}
            >
              <span
                style={{
                  flex: "0 0 auto",
                  color: GREEN,
                  fontWeight: 700,
                  fontSize: 16,
                  marginTop: 1,
                }}
              >
                ✓
              </span>
              <div>
                <div
                  className="text-sm"
                  style={{
                    fontFamily: "var(--font-syne), system-ui, sans-serif",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    color: TEXT,
                  }}
                >
                  {f.title}
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: MUTED, fontWeight: 300, lineHeight: 1.45 }}
                >
                  {f.body}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => {
            handleSubscribe();
          }}
          className="w-full rounded-lg py-3 text-base"
          style={{
            background: PINK,
            color: "#fff",
            fontFamily: "var(--font-syne), system-ui, sans-serif",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            border: "none",
            cursor: "pointer",
          }}
        >
          Start free trial
        </button>
        <p
          className="text-xs mt-3 text-center"
          style={{ color: MUTED, fontWeight: 300 }}
        >
          Cancel anytime. We&apos;ll email a reminder before your trial ends.
        </p>
      </div>
    </div>
  );
}
