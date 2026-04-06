-- One Icon pick per auction franchise: 2× on all matches (applied in UI on top of PJ×haul in match_points).
-- player_id cannot be changed after insert (only row delete by admin if ever needed).
CREATE TABLE IF NOT EXISTS public.franchise_icon_selection (
  team_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_franchise_icon_player ON public.franchise_icon_selection (player_id);

COMMENT ON TABLE public.franchise_icon_selection IS
  'Franchise fantasy Icon: 2× stored match_points for this player for all games; immutable player_id after insert.';

CREATE OR REPLACE FUNCTION public.prevent_franchise_icon_player_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.player_id IS DISTINCT FROM OLD.player_id THEN
    RAISE EXCEPTION 'Icon player cannot be changed once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_franchise_icon_immutable_player ON public.franchise_icon_selection;
CREATE TRIGGER tr_franchise_icon_immutable_player
  BEFORE UPDATE ON public.franchise_icon_selection
  FOR EACH ROW
  EXECUTE PROCEDURE public.prevent_franchise_icon_player_change();
