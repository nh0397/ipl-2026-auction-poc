-- Haul multipliers (Dream11-style): total fantasy = base_points × max(batting_tier, bowling_tier).
ALTER TABLE public.match_points
  ADD COLUMN IF NOT EXISTS haul_run_mult numeric,
  ADD COLUMN IF NOT EXISTS haul_wicket_mult numeric,
  ADD COLUMN IF NOT EXISTS haul_applied_mult numeric;

COMMENT ON COLUMN public.match_points.haul_run_mult IS
  'Haul tier multiplier from batting runs (1, 1.25, 1.5, 1.75, 3, 4) before max with bowling tier';
COMMENT ON COLUMN public.match_points.haul_wicket_mult IS
  'Haul tier multiplier from bowling wickets (1, 1.5, 2, 4) before max with batting tier';
COMMENT ON COLUMN public.match_points.haul_applied_mult IS
  'max(haul_run_mult, haul_wicket_mult) applied to base_points for stored points';
