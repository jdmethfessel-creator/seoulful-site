import { createClient } from "@supabase/supabase-js";

// Service-role client used by the Stripe webhook to write to the
// subscriptions table without an authenticated user context. The
// service role key BYPASSES Row Level Security — never expose it to
// the browser, never import this file from a client component.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "supabaseAdmin: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
