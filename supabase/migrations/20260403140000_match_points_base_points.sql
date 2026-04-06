-- Final fantasy total after haul multiplier lives in `points`; optional audit column for PJ base.
ALTER TABLE public.match_points ADD COLUMN IF NOT EXISTS base_points numeric;

COMMENT ON COLUMN public.match_points.points IS 'Final fantasy points (after haul multipliers when synced from breakdown); NULL = DNP; 0 = played, zero points';
COMMENT ON COLUMN public.match_points.base_points IS 'PJ base before haul multiplier (populated by sync from CricAPI aggregate)';
