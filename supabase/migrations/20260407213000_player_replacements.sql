-- Map in-match replacements so points can be credited to the auctioned player.
-- Example: Harshit Rana (auctioned) replaced by Navdeep Saini (played).
-- Store (match_id, in_player_id=Navdeep, out_player_id=Harshit).

create table if not exists public.player_replacements (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  out_player_id uuid not null references public.players (id) on delete cascade,
  in_player_id uuid not null references public.players (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (match_id, in_player_id)
);

create index if not exists idx_player_replacements_match_id on public.player_replacements (match_id);
create index if not exists idx_player_replacements_out_player on public.player_replacements (out_player_id);
create index if not exists idx_player_replacements_in_player on public.player_replacements (in_player_id);

comment on table public.player_replacements is
  'Per-match replacement attribution: points for in_player_id are credited to out_player_id when syncing points.';

