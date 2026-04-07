-- Split C and VC effective dates so each can change independently.
-- Backward compatible: existing `valid_from` is copied into the new columns.

ALTER TABLE public.franchise_cvc_selections
  ADD COLUMN IF NOT EXISTS captain_valid_from date,
  ADD COLUMN IF NOT EXISTS vice_valid_from date;

UPDATE public.franchise_cvc_selections
SET
  captain_valid_from = COALESCE(captain_valid_from, valid_from),
  vice_valid_from = COALESCE(vice_valid_from, valid_from)
WHERE captain_valid_from IS NULL OR vice_valid_from IS NULL;

COMMENT ON COLUMN public.franchise_cvc_selections.captain_valid_from IS
  'Effective-from date (IST calendar) for captain pick on sheets. Falls back to valid_from for legacy rows.';

COMMENT ON COLUMN public.franchise_cvc_selections.vice_valid_from IS
  'Effective-from date (IST calendar) for vice captain pick on sheets. Falls back to valid_from for legacy rows.';

