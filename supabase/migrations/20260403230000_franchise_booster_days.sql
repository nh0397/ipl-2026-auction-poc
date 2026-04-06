-- Three IST calendar booster days per auction franchise: on those days the sheet uses
-- base_points × 3 for squad players who played (× 6 for franchise Icon); C/VC and normal Icon 2× do not apply.
CREATE TABLE IF NOT EXISTS public.franchise_booster_days (
  team_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot >= 1 AND slot <= 3),
  booster_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (team_id, slot),
  UNIQUE (team_id, booster_date)
);

CREATE INDEX IF NOT EXISTS idx_franchise_booster_team_date ON public.franchise_booster_days (team_id, booster_date);

COMMENT ON TABLE public.franchise_booster_days IS
  'Franchise picks up to 3 booster calendar days (IST). On a booster day, sheet points = base_points × 3 (× 6 for franchise Icon); Captain/Vice and normal Icon multiplier are skipped.';
