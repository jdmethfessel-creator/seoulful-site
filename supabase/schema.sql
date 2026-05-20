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
-- RLS: lock down by default; access via service_role only until the app
-- has real auth + per-user policies. Toggle off if you need anon reads.
-- ============================================================================
alter table public.products enable row level security;
alter table public.korean_alternatives enable row level security;
