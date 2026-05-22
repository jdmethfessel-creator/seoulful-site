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
import type {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Real Supabase-backed auth + entitlement check. useAuth subscribes to
// the supabase session and reads the user's subscriptions row to
// compute isPremium. The Stripe webhook is what writes that row; this
// provider is read-only.

const PINK = "#ff3366";
const GREEN = "#00e676";
const CARD = "#141414";
const TEXT = "#f5f0eb";
const MUTED = "#8a8480";

const SYNE = "var(--font-syne), system-ui, sans-serif";

export type AuthUser = {
  id: string;
  email: string | null;
} | null;

type AuthState = {
  user: AuthUser;
  isPremium: boolean;
  loading: boolean;
};

type PremiumCtx = AuthState & {
  openPremiumModal: () => void;
  closePremiumModal: () => void;
  signOut: () => Promise<void>;
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
  const [user, setUser] = useState<AuthUser>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Subscribe to the supabase session and refresh isPremium when it
  // changes. Initial getUser() handles the case where the user already
  // has a valid session from a previous visit.
  useEffect(() => {
    const supabase = supabaseBrowser();
    let mounted = true;

    async function refreshPremium(uid: string) {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        console.error("[premium] subscriptions read failed:", error.message);
        setIsPremium(false);
        return;
      }
      setIsPremium(data?.status === "active" || data?.status === "trialing");
    }

    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: User | null } }) => {
        if (!mounted) return;
        if (data.user) {
          setUser({ id: data.user.id, email: data.user.email ?? null });
          refreshPremium(data.user.id).finally(
            () => mounted && setLoading(false)
          );
        } else {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!mounted) return;
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? null });
        refreshPremium(session.user.id);
      } else {
        setUser(null);
        setIsPremium(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const openPremiumModal = useCallback(() => setOpen(true), []);
  const closePremiumModal = useCallback(() => setOpen(false), []);

  const signOut = useCallback(async () => {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    setUser(null);
    setIsPremium(false);
  }, []);

  const value = useMemo<PremiumCtx>(
    () => ({
      user,
      isPremium,
      loading,
      openPremiumModal,
      closePremiumModal,
      signOut,
    }),
    [user, isPremium, loading, openPremiumModal, closePremiumModal, signOut]
  );

  return (
    <PremiumContext.Provider value={value}>
      {children}
      {open && <PremiumModal onClose={closePremiumModal} user={user} />}
    </PremiumContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(PremiumContext);
  if (!ctx) return { user: null, isPremium: false, loading: false };
  return { user: ctx.user, isPremium: ctx.isPremium, loading: ctx.loading };
}

export function usePremium(): boolean {
  return useAuth().isPremium;
}

export function useOpenPremiumModal(): () => void {
  const ctx = useContext(PremiumContext);
  return ctx?.openPremiumModal ?? (() => {});
}

export function useSignOut(): () => Promise<void> {
  const ctx = useContext(PremiumContext);
  return ctx?.signOut ?? (async () => {});
}

// Hit our checkout endpoint and redirect to the Stripe Checkout URL.
export async function handleSubscribe(): Promise<void> {
  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
    });
    const data = await res
      .json()
      .catch(() => ({} as { url?: string; error?: string }));
    if (!res.ok || typeof data?.url !== "string") {
      console.error("[stripe] checkout init failed:", { status: res.status, data });
      alert(
        typeof data?.error === "string"
          ? data.error
          : "Couldn't start checkout. Try again in a moment."
      );
      return;
    }
    window.location.assign(data.url);
  } catch (err) {
    console.error("[stripe] checkout fetch failed:", err);
    alert("Couldn't reach the billing service. Check your connection and try again.");
  }
}

function PremiumModal({
  onClose,
  user,
}: {
  onClose: () => void;
  user: AuthUser;
}) {
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
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,51,102,0.15)",
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
            fontFamily: SYNE,
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
              fontFamily: SYNE,
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
                    fontFamily: SYNE,
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

        {user ? <SignedInUpgrade user={user} /> : <SignInForm />}

        <p
          className="text-xs mt-3 text-center"
          style={{ color: MUTED, fontWeight: 300 }}
        >
          Cancel anytime. Billed monthly until you cancel.
        </p>
      </div>
    </div>
  );
}

function SignedInUpgrade({ user }: { user: NonNullable<AuthUser> }) {
  return (
    <>
      <button
        type="button"
        onClick={() => {
          handleSubscribe();
        }}
        className="w-full rounded-lg py-3 text-base"
        style={{
          background: PINK,
          color: "#fff",
          fontFamily: SYNE,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          border: "none",
          cursor: "pointer",
        }}
      >
        Upgrade to Premium
      </button>
      {user.email && (
        <p
          className="text-xs mt-2 text-center"
          style={{ color: MUTED, fontWeight: 300 }}
        >
          Signed in as {user.email}
        </p>
      )}
    </>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("sending");
    setErrorMsg(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          window.location.pathname + window.location.search
        )}`,
      },
    });
    if (error) {
      console.error("[auth] signInWithOtp failed:", error.message);
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div
        className="rounded-lg px-4 py-4 text-sm text-center"
        style={{
          background: "rgba(0,230,118,0.08)",
          border: `1px solid ${GREEN}55`,
          color: GREEN,
          fontWeight: 400,
        }}
      >
        Check your email for the sign-in link, then come back here to upgrade.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label
        className="block text-xs uppercase"
        style={{
          color: MUTED,
          letterSpacing: "0.18em",
          fontWeight: 500,
        }}
      >
        Email
      </label>
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg px-4 py-3 text-base outline-none"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: TEXT,
          fontWeight: 300,
        }}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-lg py-3 text-base"
        style={{
          background: status === "sending" ? "rgba(255,51,102,0.5)" : PINK,
          color: "#fff",
          fontFamily: SYNE,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          border: "none",
          cursor: status === "sending" ? "wait" : "pointer",
        }}
      >
        {status === "sending" ? "Sending..." : "Continue with email"}
      </button>
      {errorMsg && (
        <div
          className="text-xs"
          style={{ color: PINK, fontWeight: 400 }}
        >
          {errorMsg}
        </div>
      )}
      <p
        className="text-xs text-center"
        style={{ color: MUTED, fontWeight: 300 }}
      >
        We&apos;ll email you a one-click link — no password needed.
      </p>
    </form>
  );
}
