-- Run this in the Supabase SQL editor before deploying the marketplace /
-- event-RSVP backend changes. This repo has no migration tooling checked in
-- (schema is managed directly in the Supabase dashboard), so this file is
-- documentation + the exact statements to run, not an auto-applied migration.
--
-- All access control for these tables is enforced at the Express layer via
-- supabaseAdmin (the service-role client, which bypasses RLS) — same pattern
-- already used for every other table in this app. RLS is left off here to
-- match that existing convention, not because it wouldn't be reasonable
-- defense-in-depth to add later.

-- ─── Marketplace listings ───────────────────────────────────────────────────
create table if not exists marketplace_listings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  title             text not null,
  description       text not null,
  price             numeric,              -- null = "negotiable" / contact for price
  category          text not null default 'Other',
  condition         text not null default 'used',   -- 'new' | 'used'
  image_url         text,
  location          text,
  contact_phone     text,
  contact_whatsapp  text,
  status            text not null default 'active', -- 'active' | 'sold'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_marketplace_listings_created_at on marketplace_listings (created_at desc);
create index if not exists idx_marketplace_listings_category   on marketplace_listings (category);
create index if not exists idx_marketplace_listings_user_id    on marketplace_listings (user_id);
create index if not exists idx_marketplace_listings_status     on marketplace_listings (status);

-- Reports on listings — mirrors the existing `reports` table (which is
-- specifically FK'd to posts), kept as its own table rather than widening
-- `reports` with a nullable listing_id.
create table if not exists marketplace_reports (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references marketplace_listings(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_marketplace_reports_listing_id on marketplace_reports (listing_id);

-- ─── Event RSVPs ─────────────────────────────────────────────────────────────
create table if not exists event_rsvps (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists idx_event_rsvps_post_id on event_rsvps (post_id);
