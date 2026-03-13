-- PRODUCTION RESET SCRIPT
-- Purpose: Clear all auction activity and reset states while preserving base data (Players & Users).

-- 1. Clear Auction Activity
TRUNCATE TABLE public.bids RESTART IDENTITY;
TRUNCATE TABLE public.chat_messages RESTART IDENTITY;

-- 2. Reset Player Auction Status (Preserving the list of players)
UPDATE public.players
SET 
    status = 'Available',
    auction_status = 'pending',
    sold_to = NULL,
    sold_to_id = NULL,
    sold_price = NULL;

-- 3. Reset Auction Configuration to Setup State
UPDATE public.auction_config
SET 
    status = 'setup',
    current_pool = 'Marquee'
WHERE id IS NOT NULL; -- Singleton update

-- 4. Reset Auction State (Current Block)
UPDATE public.auction_state
SET 
    current_player_id = NULL,
    status = 'waiting',
    current_bid = 0,
    current_bidder_id = NULL,
    current_bidder_name = NULL,
    passed_user_ids = '{}'
WHERE id IS NOT NULL; -- Singleton update

-- 5. Reset Franchise Budgets to Global Baseline (e.g., 150)
DO \$\$
DECLARE
    global_budget numeric;
BEGIN
    SELECT COALESCE(budget_per_team, 150) INTO global_budget FROM public.auction_config LIMIT 1;
    
    UPDATE public.profiles
    SET budget = global_budget
    WHERE role IN ('Admin', 'Participant');
    
    RAISE NOTICE 'Production Ready: All states cleared. Budgets reset to % Cr.', global_budget;
END \$\$;
