-- Allow the app to switch Sheets data source at runtime (Admin-controlled).
-- Values: 'espn' (match_points_espn) or 'cricapi' (match_points).

alter table public.auction_config
  add column if not exists match_points_source text not null default 'espn';

comment on column public.auction_config.match_points_source is
  'Which persisted points table Sheets reads: espn=match_points_espn, cricapi=match_points.';

