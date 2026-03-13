-- 1. Reset all auction-related tables
DELETE FROM public.bids;
DELETE FROM public.chat_messages;

UPDATE public.players 
SET 
  status = 'Available',
  auction_status = 'pending',
  sold_to = NULL,
  sold_to_id = NULL,
  sold_price = NULL;

UPDATE public.auction_state 
SET 
  status = 'waiting',
  current_player_id = NULL,
  current_bid = 0,
  current_bidder_id = NULL,
  current_bidder_name = NULL,
  passed_user_ids = '{}';

UPDATE public.auction_config 
SET 
  status = 'setup',
  current_pool = 'Marquee';

-- 2. Assign Marquee Players (Replace placeholders if necessary)
DO $$
BEGIN
  -- WW Assignments
  UPDATE public.players SET sold_to = 'WW', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'WW' LIMIT 1), sold_price = '20', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Abhishek Sharma';
  UPDATE public.players SET sold_to = 'WW', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'WW' LIMIT 1), sold_price = '5.01', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Axar Patel';
  UPDATE public.players SET sold_to = 'WW', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'WW' LIMIT 1), sold_price = '9.41', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Hardik Pandya';
  UPDATE public.players SET sold_to = 'WW', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'WW' LIMIT 1), sold_price = '6.11', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Jos Buttler';
  UPDATE public.players SET sold_to = 'WW', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'WW' LIMIT 1), sold_price = '7.85', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Sunil Narine';

  -- Formidable Fuckers Assignments
  UPDATE public.players SET sold_to = 'Formidable Fuckers', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'Formidable Fuckers' LIMIT 1), sold_price = '20', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Sanju Samson';
  UPDATE public.players SET sold_to = 'Formidable Fuckers', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'Formidable Fuckers' LIMIT 1), sold_price = '7', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Mitchell Marsh';
  UPDATE public.players SET sold_to = 'Formidable Fuckers', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'Formidable Fuckers' LIMIT 1), sold_price = '6.25', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Varun Chakravarthy';

  -- The Fukchods Assignments
  UPDATE public.players SET sold_to = 'The Fukchods', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'The Fukchods' LIMIT 1), sold_price = '20', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Virat Kohli';
  UPDATE public.players SET sold_to = 'The Fukchods', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'The Fukchods' LIMIT 1), sold_price = '12.25', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Arshdeep Singh';
  UPDATE public.players SET sold_to = 'The Fukchods', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'The Fukchods' LIMIT 1), sold_price = '8.1', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Rajat Patidar';
  UPDATE public.players SET sold_to = 'The Fukchods', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'The Fukchods' LIMIT 1), sold_price = '8.1', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Travis Head';

  -- No M&M Assignments
  UPDATE public.players SET sold_to = 'No M&M', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'No M&M' LIMIT 1), sold_price = '20', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Suryakumar Yadav';
  UPDATE public.players SET sold_to = 'No M&M', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'No M&M' LIMIT 1), sold_price = '14', auction_status = 'sold', status = 'Sold' WHERE player_name = 'KL Rahul';
  UPDATE public.players SET sold_to = 'No M&M', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'No M&M' LIMIT 1), sold_price = '12', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Nicholas Pooran';
  UPDATE public.players SET sold_to = 'No M&M', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'No M&M' LIMIT 1), sold_price = '13', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Ruturaj Gaikwad';
  UPDATE public.players SET sold_to = 'No M&M', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'No M&M' LIMIT 1), sold_price = '13', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Shreyas Iyer';
  UPDATE public.players SET sold_to = 'No M&M', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'No M&M' LIMIT 1), sold_price = '13', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Shubman Gill';
  UPDATE public.players SET sold_to = 'No M&M', sold_to_id = (SELECT id FROM public.profiles WHERE team_name = 'No M&M' LIMIT 1), sold_price = '15', auction_status = 'sold', status = 'Sold' WHERE player_name = 'Yashasvi Jaiswal';
END $$;
