-- Canonical CricAPI sync flag for the app UI (separate from fixtures_cricapi payload).
-- Backfilled from fixtures_cricapi.points_synced so existing rows stay consistent.

create table if not exists public.fixtureapi_points (
  api_match_id text primary key,
  synced boolean not null default false
);

insert into public.fixtureapi_points (api_match_id, synced)
select fc.api_match_id, coalesce(fc.points_synced, false)
from public.fixtures_cricapi fc
on conflict (api_match_id) do update
set synced = excluded.synced;

alter table public.fixtureapi_points enable row level security;

create policy "fixtureapi_points_select_anon"
  on public.fixtureapi_points
  for select
  using (true);
