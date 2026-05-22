-- kDupe Premium subscriptions table.
--
-- One row per user with a current/canceled subscription. The Stripe
-- webhook (app/api/webhook/route.ts) is the only writer and uses the
-- service role key, which bypasses RLS by design. The browser client
-- reads its own row via the SELECT-own RLS policy below.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_status_idx
  on public.subscriptions(status);

create index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions(stripe_subscription_id);

alter table public.subscriptions enable row level security;

-- Authenticated users can read only their own subscription row.
drop policy if exists "Users read own subscription" on public.subscriptions;
create policy "Users read own subscription"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policy is intentional. The Stripe webhook
-- writes here using the service role key, which is exempt from RLS.
