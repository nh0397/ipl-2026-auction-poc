-- CricAPI-driven fixtures table.
-- Stores the series_info -> matchList payload (and a few derived fields) so the UI
-- can render schedule cards without relying on ESPN schedule scraping.

create table if not exists public.fixtures_cricapi (
  id uuid primary key default gen_random_uuid(),

  -- CricAPI identifiers
  api_series_id uuid,
  api_match_id text not null,

  -- Main descriptive fields
  match_name text,
  match_type text,
  status text,
  venue text,

  -- Dates/times
  match_date date,
  date_time_gmt timestamptz,

  -- Derived "two teams" view (based on teamInfo[0] / teamInfo[1] order)
  team1_name text,
  team1_short text,
  team1_img text,
  team2_name text,
  team2_short text,
  team2_img text,

  -- Booleans from API
  match_started boolean default false,
  match_ended boolean default false,
  has_squad boolean default false,
  fantasy_enabled boolean default false,
  bbb_enabled boolean default false,

  -- Full payload storage for maximum fidelity
  teams jsonb not null default '[]'::jsonb,
  team_info jsonb not null default '[]'::jsonb,
  raw_match jsonb,

  -- Optional scorecard storage (filled later by whichever scraper you enable)
  scorecard jsonb,
  points_synced boolean default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (api_match_id)
);

create index if not exists idx_fixtures_cricapi_series_id on public.fixtures_cricapi(api_series_id);
create index if not exists idx_fixtures_cricapi_match_date on public.fixtures_cricapi(match_date);
create index if not exists idx_fixtures_cricapi_match_started on public.fixtures_cricapi(match_started);
create index if not exists idx_fixtures_cricapi_match_ended on public.fixtures_cricapi(match_ended);

