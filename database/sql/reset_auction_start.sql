BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bids',
    'chat_messages',
    'audit_logs',
    'franchise_booster_days',
    'match_man_of_the_match',
    'match_fantasy_score_snapshots',
    'fixtureapi_points',
    'workflow_dispatch_events'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
    END IF;
  END LOOP;
END $$;

UPDATE public.players
SET
  status = 'Available',
  sold_to = NULL,
  sold_price = NULL,
  sold_to_id = NULL,
  auction_status = 'pending';

UPDATE public.auction_state
SET
  current_player_id = NULL,
  status = 'waiting',
  current_bid = 0,
  current_bidder_id = NULL,
  current_bidder_name = NULL,
  passed_user_ids = '{}'::text[],
  started_at = now(),
  updated_at = now();

UPDATE public.auction_config
SET
  status = 'setup',
  current_pool = 'Marquee',
  pools_frozen = false,
  updated_at = now();

UPDATE public.profiles
SET
  budget = COALESCE((SELECT budget_per_team FROM public.auction_config LIMIT 1), 120),
  updated_at = now();

UPDATE public.profiles
SET role = 'Admin',
    updated_at = now()
WHERE lower(email) = 'project7072@gmail.com';

COMMIT;
