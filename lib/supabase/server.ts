import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Cookie-aware Supabase client for Route Handlers and Server
// Components. Reads the authenticated user's session from the request
// cookies; writes refreshed tokens back when called from a route
// handler (the set call is a no-op when we're inside a Server
// Component, which is the documented pattern).
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookie writes are not
            // allowed there. Safe to ignore; middleware / route
            // handlers refresh the session on the next request.
          }
        },
      },
    }
  );
}
