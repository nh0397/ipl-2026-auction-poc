-- Run in Supabase SQL Editor for a clean resync (optional one-off).
-- WARNING: Truncates BOTH persisted points tables. players, matches, fixtures, nominations are untouched.
-- After: run Scoreboard → Sync points (ESPN → match_points_espn; CricAPI → match_points if enabled in featureFlags).

truncate table public.match_points_espn;
truncate table public.match_points;
