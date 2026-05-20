-- Seoulful — initial schema
-- Run this in Supabase SQL Editor for the seoulful project (NOT the
-- shared homebiddy / electricstars project). Idempotent; safe to re-run.

create extension if not exists "pgcrypto";

-- ============================================================================
-- products: western skincare products the user logs / looks up
-- ============================================================================
create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  brand               text,
  price               numeric,
  category            text,
  ingredient_list     text,
  flagged_ingredients text,
  key_actives         text,
  created_at          timestamptz not null default now()
);

create index if not exists products_brand_idx    on public.products (brand);
create index if not exists products_category_idx on public.products (category);

-- ============================================================================
-- korean_alternatives: K-beauty alternatives recommended for a given product
-- ============================================================================
create table if not exists public.korean_alternatives (
  id                  uuid primary key default gen_random_uuid(),
  western_product_id  uuid references public.products(id) on delete cascade,
  name                text not null,
  brand               text,
  price               numeric,
  match_score         numeric,
  ingredient_list     text,
  key_actives         text,
  amazon_url          text,
  sephora_url         text,
  yesstyle_url        text,
  created_at          timestamptz not null default now()
);

create index if not exists korean_alternatives_western_idx
  on public.korean_alternatives (western_product_id);
create index if not exists korean_alternatives_match_score_idx
  on public.korean_alternatives (match_score desc);

-- ============================================================================
-- RLS: both tables enabled with PUBLIC READ policies. The app is a
-- read-only search experience, so anon SELECT is intentional. Add per-user
-- INSERT / UPDATE / DELETE policies later when auth is wired up.
-- ============================================================================
alter table public.products enable row level security;
alter table public.korean_alternatives enable row level security;

drop policy if exists "Public read" on public.products;
create policy "Public read" on public.products
  for select using (true);

drop policy if exists "Public read" on public.korean_alternatives;
create policy "Public read" on public.korean_alternatives
  for select using (true);

-- ============================================================================
-- One-off fix: rewrite legacy YesStyle URLs from the old ?queryString=
-- format to the canonical search.html?keyword= form. Idempotent — after
-- first run no rows match the LIKE filter so this is a no-op.
-- ============================================================================
update public.korean_alternatives
set    yesstyle_url = replace(yesstyle_url, 'search?queryString=', 'search.html?keyword=')
where  yesstyle_url like '%search?queryString=%';

-- ============================================================================
-- Truncate over-long YesStyle keywords to the first 3 space-delimited
-- tokens (≈ brand + first 2 product words). Long keywords trigger
-- YesStyle URL errors. Handles both '+' and '%20' as space encodings.
-- Idempotent: re-running collapses 3 tokens to 3 tokens.
-- ============================================================================
update public.korean_alternatives
set    yesstyle_url = 'https://www.yesstyle.com/en/search.html?keyword=' ||
       array_to_string(
         (regexp_split_to_array(
           regexp_replace(yesstyle_url, '^.*[?&]keyword=', ''),
           '\+|%20'
         ))[1:3],
         '+'
       )
where  yesstyle_url like '%/en/search.html?keyword=%';
