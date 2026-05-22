import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Magic-link callback. Supabase sends the user here with ?code=... in
// the URL; we exchange it for a session (which sets the auth cookies
// via supabaseServer) and redirect to wherever the user came from.

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = sanitizeNext(req.nextUrl.searchParams.get("next")) ?? "/routine";

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchange failed:", error.message);
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(error.message)}`, req.nextUrl.origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next, req.nextUrl.origin));
}

// Only honor relative same-origin redirects so a malicious link
// can't bounce the user off-site after sign-in.
function sanitizeNext(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}
