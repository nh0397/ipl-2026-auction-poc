-- Add fields the existing UI expects (match_no, title),
-- so we can swap the app to fixtures_cricapi without losing features.

alter table public.fixtures_cricapi
  add column if not exists match_no integer,
  add column if not exists title text;

create index if not exists idx_fixtures_cricapi_match_no on public.fixtures_cricapi(match_no);

