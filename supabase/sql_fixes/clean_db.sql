TRUNCATE TABLE public.bids RESTART IDENTITY;

UPDATE public.players
SET 
    status = 'Available',
    auction_status = 'pending',
    pool = NULL,
    sold_to = NULL,
    sold_to_id = NULL,
    sold_price = NULL;

UPDATE public.auction_state
SET 
    current_player_id = NULL,
    status = 'waiting',
    current_bid = 0,
    current_bidder_id = NULL,
    current_bidder_name = NULL,
    passed_user_ids = '{}',
    updated_at = NOW();

UPDATE public.profiles
SET budget = (SELECT budget_per_team FROM public.auction_config LIMIT 1)
WHERE role IN ('Admin', 'Participant');
