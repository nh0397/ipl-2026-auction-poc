-- Rows with manual_override = true are edited from the score sheet; Sync points skips them.
ALTER TABLE public.match_points
  ADD COLUMN IF NOT EXISTS manual_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.match_points.manual_override IS
  'true = user saved this row from the score sheet; automated sync must not overwrite points/base_points';

CREATE INDEX IF NOT EXISTS idx_match_points_manual_override
  ON public.match_points (manual_override)
  WHERE manual_override = true;
