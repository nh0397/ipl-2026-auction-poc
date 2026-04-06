-- Up to 5 dated Captain / Vice Captain pairs per auction franchise (profiles.id).
-- For a match on calendar day D (IST), the active row is the one with greatest valid_from where valid_from <= D
-- and both captain_id and vice_captain_id are set.
CREATE TABLE IF NOT EXISTS public.franchise_cvc_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot >= 1 AND slot <= 5),
  captain_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  vice_captain_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  valid_from date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_franchise_cvc_team_valid ON public.franchise_cvc_selections (team_id, valid_from DESC);

COMMENT ON TABLE public.franchise_cvc_selections IS
  'Franchise C/VC picks with effective date (IST calendar). Sheet applies match_points × C/VC on top of PJ×haul.';
