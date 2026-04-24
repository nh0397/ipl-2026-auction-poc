-- Manual Man of the Match: bonus added to PJ base before haul; not from scorecard sync.
CREATE TABLE IF NOT EXISTS public.match_man_of_the_match (
  match_id uuid PRIMARY KEY REFERENCES public.matches (id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players (id) ON DELETE CASCADE,
  bonus_points numeric NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_mom_player ON public.match_man_of_the_match (player_id);

COMMENT ON TABLE public.match_man_of_the_match IS
  'Admin-selected MoM per match: bonus_points (default 50) is added to PJ base_points before haul multiplier for sheet display; match_points rows stay sync-only.';

ALTER TABLE public.match_man_of_the_match ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_mom_select_authenticated
  ON public.match_man_of_the_match
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY match_mom_write_admin
  ON public.match_man_of_the_match
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid ()
        AND p.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid ()
        AND p.role = 'Admin'
    )
  );
