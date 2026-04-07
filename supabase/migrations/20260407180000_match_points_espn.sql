-- ESPN scraper → persisted PJ points (separate from CricAPI `public.match_points`).
-- Scoreboard Sheets tab reads `match_points_espn` when `SHEET_MATCH_POINTS_TABLE` in app is set accordingly.

create table if not exists public.match_points_espn (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  points numeric,
  created_at timestamptz not null default now(),
  base_points numeric,
  manual_override boolean not null default false,
  haul_run_mult numeric,
  haul_wicket_mult numeric,
  haul_applied_mult numeric,
  unique (player_id, match_id)
);

create index if not exists idx_match_points_espn_player on public.match_points_espn (player_id);
create index if not exists idx_match_points_espn_match on public.match_points_espn (match_id);
create index if not exists idx_match_points_espn_manual_override
  on public.match_points_espn (manual_override)
  where manual_override = true;

comment on table public.match_points_espn is
  'Fantasy points derived from ESPN-scraped fixtures.scorecard; sync writes here. CricAPI uses public.match_points only.';

do $$
begin
  alter publication supabase_realtime add table public.match_points_espn;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
