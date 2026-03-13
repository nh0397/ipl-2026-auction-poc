-- SQL Script to reset profile budgets to the global auction baseline
-- This cleans up legacy budget data that was previously being decremented.

DO \$\$
DECLARE
    global_budget numeric;
BEGIN
    -- 1. Fetch the global budget from auction_config (defaulting to 150 if not found)
    SELECT COALESCE(budget_per_team, 150) INTO global_budget FROM public.auction_config LIMIT 1;
    
    -- 2. Reset every profile's budget to this global value
    UPDATE public.profiles
    SET budget = global_budget
    WHERE role IN ('Admin', 'Participant');
    
    RAISE NOTICE 'Reset all franchise budgets to % Cr', global_budget;
END \$\$;
