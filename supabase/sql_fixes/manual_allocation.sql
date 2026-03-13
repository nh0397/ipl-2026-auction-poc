-- Manual Allocation Script
-- 1. Normalize Team Names
UPDATE public.profiles SET team_name = 'The Fuckchods' WHERE email = 'jalan.me4u@gmail.com';
UPDATE public.profiles SET team_name = 'WW' WHERE email = 'tradingwithparthshah@gmail.com';
UPDATE public.profiles SET team_name = 'No M&M' WHERE email = 'naisicric97@gmail.com';
UPDATE public.profiles SET team_name = 'Formidable Fuckers' WHERE email = 'harshshah661992@gmail.com';

-- 2. Allocation for WW (Parth - ID: 365433f9-feba-4aed-bab6-5e2037b8be16)
DO $$ 
DECLARE 
    v_team_id UUID := '365433f9-feba-4aed-bab6-5e2037b8be16';
    v_team_name TEXT := 'WW';
BEGIN
    -- Abhishek Sharma (Bid: 20)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '20' WHERE player_name = 'Abhishek Sharma';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 20 FROM public.players WHERE player_name = 'Abhishek Sharma';

    -- Axar Patel (Bid: 5.01)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '5.01' WHERE player_name = 'Axar Patel';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 5.01 FROM public.players WHERE player_name = 'Axar Patel';

    -- Hardik Pandya (Bid: 9.41)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '9.41' WHERE player_name = 'Hardik Pandya';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 9.41 FROM public.players WHERE player_name = 'Hardik Pandya';

    -- Jos Buttler (Bid: 6.11)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '6.11' WHERE player_name = 'Jos Buttler';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 6.11 FROM public.players WHERE player_name = 'Jos Buttler';

    -- Sunil Narine (Bid: 7.85)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '7.85' WHERE player_name = 'Sunil Narine';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 7.85 FROM public.players WHERE player_name = 'Sunil Narine';
END $$;

-- 3. Allocation for Formidable Fuckers (Harsh - ID: 1685dfdd-00b9-41dc-b652-e311019c764a)
DO $$ 
DECLARE 
    v_team_id UUID := '1685dfdd-00b9-41dc-b652-e311019c764a';
    v_team_name TEXT := 'Formidable Fuckers';
BEGIN
    -- Sanju Samson (Bid: 20)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '20' WHERE player_name = 'Sanju Samson';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 20 FROM public.players WHERE player_name = 'Sanju Samson';

    -- Mitchell Marsh (Bid: 7)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '7' WHERE player_name = 'Mitchell Marsh';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 7 FROM public.players WHERE player_name = 'Mitchell Marsh';

    -- Varun Chakravarthy (Bid: 6.25)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '6.25' WHERE player_name = 'Varun Chakravarthy';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 6.25 FROM public.players WHERE player_name = 'Varun Chakravarthy';
END $$;

-- 4. Allocation for The Fuckchods (Prashanth - ID: a6d318ca-20a7-4b37-9976-1fb0ea12fdb4)
DO $$ 
DECLARE 
    v_team_id UUID := 'a6d318ca-20a7-4b37-9976-1fb0ea12fdb4';
    v_team_name TEXT := 'The Fuckchods';
BEGIN
    -- Virat Kohli (Bid: 20)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '20' WHERE player_name = 'Virat Kohli';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 20 FROM public.players WHERE player_name = 'Virat Kohli';

    -- Arshdeep Singh (Bid: 12.25)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '12.25' WHERE player_name = 'Arshdeep Singh';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 12.25 FROM public.players WHERE player_name = 'Arshdeep Singh';

    -- Rajat Patidar (Bid: 8.1)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '8.1' WHERE player_name = 'Rajat Patidar';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 8.1 FROM public.players WHERE player_name = 'Rajat Patidar';

    -- Travis Head (Bid: 8.1)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '8.1' WHERE player_name = 'Travis Head';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 8.1 FROM public.players WHERE player_name = 'Travis Head';
END $$;

-- 5. Allocation for No M&M (Naisarg - ID: b6ea0551-f997-4f67-9065-ec24d0d0ce84)
DO $$ 
DECLARE 
    v_team_id UUID := 'b6ea0551-f997-4f67-9065-ec24d0d0ce84';
    v_team_name TEXT := 'No M&M';
BEGIN
    -- Suryakumar Yadav (Bid: 20)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '20' WHERE player_name = 'Suryakumar Yadav';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 20 FROM public.players WHERE player_name = 'Suryakumar Yadav';

    -- KL Rahul (Bid: 14)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '14' WHERE player_name = 'KL Rahul';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 14 FROM public.players WHERE player_name = 'KL Rahul';

    -- Nicholas Pooran (Bid: 12)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '12' WHERE player_name = 'Nicholas Pooran';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 12 FROM public.players WHERE player_name = 'Nicholas Pooran';

    -- Ruturaj Gaikwad (Bid: 13)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '13' WHERE player_name = 'Ruturaj Gaikwad';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 13 FROM public.players WHERE player_name = 'Ruturaj Gaikwad';

    -- Shreyas Iyer (Bid: 13)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '13' WHERE player_name = 'Shreyas Iyer';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 13 FROM public.players WHERE player_name = 'Shreyas Iyer';

    -- Shubman Gill (Bid: 13)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '13' WHERE player_name = 'Shubman Gill';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 13 FROM public.players WHERE player_name = 'Shubman Gill';

    -- Yashasvi Jaiswal (Bid: 15)
    UPDATE public.players SET pool = NULL, status = 'Sold', auction_status = 'sold', sold_to = v_team_name, sold_to_id = v_team_id, sold_price = '15' WHERE player_name = 'Yashasvi Jaiswal';
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount) SELECT id, v_team_id, v_team_name, 15 FROM public.players WHERE player_name = 'Yashasvi Jaiswal';
END $$;
