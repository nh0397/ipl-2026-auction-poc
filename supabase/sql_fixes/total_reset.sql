-- TOTAL DATABASE RESET SCRIPT
-- WARNING: This will wipe EVERYTHING (Players, Bids, Chat, Rules) 
-- while preserving User Profiles (reset to Viewer).

-- 1. Wipe all data tables
TRUNCATE TABLE public.players RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.bids RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.chat_messages RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.audit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.rules RESTART IDENTITY CASCADE;

-- 2. Reset Auction Configuration (Singleton)
UPDATE public.auction_config
SET 
    status = 'setup',
    current_pool = 'Marquee',
    budget_per_team = 150,
    min_players = 23,
    max_players = 28
WHERE id IS NOT NULL;

-- 3. Reset Auction State (Singleton)
UPDATE public.auction_state
SET 
    current_player_id = NULL,
    status = 'waiting',
    base_price = 2,
    current_bid = 0,
    current_bidder_id = NULL,
    current_bidder_name = NULL,
    passed_user_ids = '{}',
    updated_at = NOW()
WHERE id IS NOT NULL;

-- 4. Reset all User Profiles to the clean slate
-- We preserve the IDs/Emails so people don't lose access,
-- but we remove their team privileges.
UPDATE public.profiles
SET 
    role = 'Viewer',
    team_name = 'New Franchise',
    budget = 150,
    avatar_url = NULL, -- Optional: reset profile pic too
    updated_at = NOW();

-- 5. Restore Admins (Optional: Add specific emails if you want to keep certain admins)
-- UPDATE public.profiles SET role = 'Admin' WHERE email IN ('youradmin@example.com');

RAISE NOTICE 'Database Wiped: Everything is clean and ready for fresh data.';
