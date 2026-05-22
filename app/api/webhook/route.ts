import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Stripe webhook endpoint. Verifies the signature, then upserts the
// subscriptions table on:
//   - checkout.session.completed  (initial premium grant)
//   - customer.subscription.updated (status changes, renewals)
//   - customer.subscription.deleted (cancellation)
//
// Configure in the Stripe Dashboard:
//   1. https://dashboard.stripe.com/webhooks → Add endpoint
//   2. URL: https://kdupe.co/api/webhook
//   3. Events: the three listed above
//   4. Copy the signing secret into STRIPE_WEBHOOK_SECRET

export const runtime = "nodejs";
// Stripe occasionally retries with delays; keep us off the 10s default.
export const maxDuration = 30;

const STRIPE_API_VERSION = "2026-04-22.dahlia";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!sig || !secret || !stripeKey) {
    console.error("[webhook] missing config:", {
      sigPresent: !!sig,
      secretPresent: !!secret,
      stripeKeyPresent: !!stripeKey,
    });
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 503 }
    );
  }

  // Raw body is required for signature verification — we must read it
  // as text, not parse as JSON first.
  const rawBody = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error(
      "[webhook] signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  console.log("[webhook] received:", event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionLifecycle(event.data.object);
        break;
      default:
        // Other events are no-ops for now; ack to stop retries.
        break;
    }
  } catch (err) {
    console.error("[webhook] handler failed:", {
      type: event.type,
      id: event.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Handler error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const userId =
    session.client_reference_id ||
    (session.metadata && session.metadata.user_id) ||
    null;
  if (!userId) {
    console.error(
      "[webhook] checkout.session.completed without user_id — session",
      session.id
    );
    return;
  }
  if (session.mode !== "subscription") return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  // Pull the full subscription so we can store the real status (sub
  // may be `trialing` if the price has a trial). In the dahlia API
  // version current_period_end lives on subscription items.
  let status = "active";
  let currentPeriodEnd: string | null = null;
  let cancelAtPeriodEnd = false;
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    status = sub.status;
    currentPeriodEnd = subscriptionPeriodEndISO(sub);
    cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) {
    throw new Error(`subscriptions upsert failed: ${error.message}`);
  }
}

async function handleSubscriptionLifecycle(sub: Stripe.Subscription) {
  // For updates/deletions we look up the row by stripe_subscription_id
  // instead of user_id — the user_id is also in sub.metadata.user_id
  // (we set it in create-checkout-session) but the foreign key is the
  // canonical anchor.
  const userId = (sub.metadata && sub.metadata.user_id) || null;
  const status = sub.status;
  const currentPeriodEnd = subscriptionPeriodEndISO(sub);

  const admin = supabaseAdmin();

  if (userId) {
    const { error } = await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          stripe_subscription_id: sub.id,
          stripe_customer_id:
            typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          status,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) {
      throw new Error(`subscriptions upsert failed: ${error.message}`);
    }
    return;
  }

  // Fallback: no user_id on the event — match by subscription id.
  const { error } = await admin
    .from("subscriptions")
    .update({
      status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);
  if (error) {
    throw new Error(`subscriptions update failed: ${error.message}`);
  }
}

// In the dahlia API version current_period_end moved to subscription
// items. Take the max across items so the row reflects when premium
// access actually lapses.
function subscriptionPeriodEndISO(sub: Stripe.Subscription): string | null {
  const ends = (sub.items?.data ?? [])
    .map((item) => (item as { current_period_end?: number }).current_period_end)
    .filter((n): n is number => typeof n === "number" && n > 0);
  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000).toISOString();
}
