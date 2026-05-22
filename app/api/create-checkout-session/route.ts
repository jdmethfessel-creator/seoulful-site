import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Stripe Checkout session creator for kDupe Premium ($3.99/mo).
// Returns { url } — the client redirects window.location to it.

export const runtime = "nodejs";

const STRIPE_API_VERSION = "2026-04-22.dahlia";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secret || !priceId) {
    console.error("[stripe] missing config:", {
      secretPresent: !!secret,
      pricePresent: !!priceId,
    });
    return NextResponse.json(
      {
        error:
          "Billing isn't configured yet — STRIPE_SECRET_KEY / STRIPE_PRICE_ID env vars are missing.",
      },
      { status: 503 }
    );
  }

  const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION });

  // Derive the absolute origin for success / cancel URLs from the
  // incoming request so this works in dev (localhost), preview
  // deployments, and prod without an extra env var.
  const origin =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || req.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/saved?upgraded=true`,
      cancel_url: `${origin}/routine`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    if (!session.url) {
      console.error("[stripe] session created without url:", session.id);
      return NextResponse.json(
        { error: "Stripe returned a session without a checkout URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe] session create failed:", {
      name: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Stripe error: ${err.message}`
            : "Couldn't create a checkout session.",
      },
      { status: 502 }
    );
  }
}
