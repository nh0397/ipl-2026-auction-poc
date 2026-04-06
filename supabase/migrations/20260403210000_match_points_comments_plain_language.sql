-- Plain-language column comments (replaces older PJ/haul wording if already applied).
COMMENT ON COLUMN public.match_points.points IS
  'Total fantasy points = base points × performance multipliers (from sync); NULL = DNP; 0 = played, zero points';
COMMENT ON COLUMN public.match_points.base_points IS
  'Base points before performance multipliers (from scorecard sync)';
