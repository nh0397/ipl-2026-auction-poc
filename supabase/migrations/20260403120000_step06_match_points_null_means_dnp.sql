-- Semantics: NULL = DNP (did not play); 0 = played, zero fantasy points; otherwise points value.
-- Persisted via public.match_points (player_id, match_id); upserts from the score sheet override sync until you add per-row source flags.
COMMENT ON COLUMN public.match_points.points IS 'Fantasy points; NULL = DNP (did not play), 0 = played with zero points';
