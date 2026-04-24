CREATE OR REPLACE FUNCTION public.place_bid(
  p_player_id UUID,
  p_bidder_id UUID,
  p_bidder_name TEXT,
  p_amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.auction_state;
  v_min_required NUMERIC;
  v_amt NUMERIC;
  v_actor_id UUID;
  v_profile public.profiles;
  v_budget_per_team NUMERIC;
  v_max_players INTEGER;
  v_bought_count INTEGER;
  v_spent NUMERIC;
  v_purse_after NUMERIC;
  v_slots_after INTEGER;
  v_min_reserve NUMERIC;
  v_display_name TEXT;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  IF p_bidder_id IS DISTINCT FROM v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bidder identity mismatch');
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = v_actor_id
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found');
  END IF;

  IF v_profile.role NOT IN ('Admin', 'Participant') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only participants can bid');
  END IF;

  v_amt := round(p_amount::numeric, 2);

  SELECT *
  INTO v_state
  FROM public.auction_state
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_state.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No auction state row');
  END IF;

  IF v_state.current_player_id IS NULL OR v_state.current_player_id <> p_player_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player mismatch or no active player');
  END IF;

  IF v_state.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Auction is not active');
  END IF;

  IF v_state.current_bidder_id IS NULL THEN
    v_min_required := round(v_state.base_price::numeric, 2);
  ELSE
    v_min_required := round(v_state.current_bid + v_state.min_increment, 2);
  END IF;

  IF v_amt < v_min_required THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bid too low. Minimum required is ' || v_min_required || ' Cr');
  END IF;

  SELECT
    COALESCE(ac.budget_per_team, 150),
    COALESCE(ac.max_players, 28)
  INTO v_budget_per_team, v_max_players
  FROM public.auction_config ac
  ORDER BY ac.id
  LIMIT 1;

  SELECT
    COUNT(*)::int,
    COALESCE(SUM(COALESCE(NULLIF(regexp_replace(COALESCE(p.sold_price, '0'), '[^0-9.]', '', 'g'), ''), '0')::numeric), 0)
  INTO v_bought_count, v_spent
  FROM public.players p
  WHERE p.sold_to_id = v_actor_id
    AND p.auction_status = 'sold';

  IF v_bought_count >= v_max_players THEN
    RETURN jsonb_build_object('success', false, 'message', 'Squad full. Maximum players reached.');
  END IF;

  v_purse_after := round((v_budget_per_team - v_spent) - v_amt, 2);
  IF v_purse_after < 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient purse');
  END IF;

  v_slots_after := GREATEST(0, v_max_players - (v_bought_count + 1));
  v_min_reserve := round(v_slots_after * 0.25, 2);
  IF v_purse_after < v_min_reserve THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient reserve for remaining slots. Need at least ' || v_min_reserve || ' Cr.'
    );
  END IF;

  v_display_name := COALESCE(NULLIF(v_profile.team_name, ''), NULLIF(v_profile.full_name, ''), p_bidder_name, 'Unknown');

  UPDATE public.auction_state
  SET
    current_bid = v_amt,
    current_bidder_id = v_actor_id,
    current_bidder_name = v_display_name,
    passed_user_ids = v_state.passed_user_ids,
    updated_at = NOW()
  WHERE id = v_state.id;

  INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount)
  VALUES (p_player_id, v_actor_id, v_display_name, v_amt);

  RETURN jsonb_build_object('success', true, 'message', 'Bid placed successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'System Error: ' || SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_current_player_sold()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_state public.auction_state;
  v_player public.players;
  v_buyer_id UUID;
  v_buyer_name TEXT;
  v_sale_price NUMERIC;
  v_budget_per_team NUMERIC;
  v_max_players INTEGER;
  v_bought_count INTEGER;
  v_spent NUMERIC;
  v_purse_after NUMERIC;
  v_slots_after INTEGER;
  v_min_reserve NUMERIC;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  SELECT role INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor_id
  LIMIT 1;

  IF v_actor_role <> 'Admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only admins can mark sold');
  END IF;

  SELECT *
  INTO v_state
  FROM public.auction_state
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_state.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No auction state row');
  END IF;

  IF v_state.status <> 'active' OR v_state.current_player_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active player to sell');
  END IF;

  IF v_state.current_bidder_id IS NULL OR v_state.current_bid <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No bidder available to mark sold');
  END IF;

  v_buyer_id := v_state.current_bidder_id;
  v_buyer_name := COALESCE(v_state.current_bidder_name, 'Unknown');
  v_sale_price := round(v_state.current_bid::numeric, 2);

  SELECT *
  INTO v_player
  FROM public.players
  WHERE id = v_state.current_player_id
  LIMIT 1
  FOR UPDATE;

  IF v_player.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Current player not found');
  END IF;

  SELECT
    COALESCE(ac.budget_per_team, 150),
    COALESCE(ac.max_players, 28)
  INTO v_budget_per_team, v_max_players
  FROM public.auction_config ac
  ORDER BY ac.id
  LIMIT 1;

  SELECT
    COUNT(*)::int,
    COALESCE(SUM(COALESCE(NULLIF(regexp_replace(COALESCE(p.sold_price, '0'), '[^0-9.]', '', 'g'), ''), '0')::numeric), 0)
  INTO v_bought_count, v_spent
  FROM public.players p
  WHERE p.sold_to_id = v_buyer_id
    AND p.auction_status = 'sold';

  IF v_bought_count >= v_max_players THEN
    RETURN jsonb_build_object('success', false, 'message', 'Buyer squad is full');
  END IF;

  v_purse_after := round((v_budget_per_team - v_spent) - v_sale_price, 2);
  IF v_purse_after < 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Buyer purse would go negative');
  END IF;

  v_slots_after := GREATEST(0, v_max_players - (v_bought_count + 1));
  v_min_reserve := round(v_slots_after * 0.25, 2);
  IF v_purse_after < v_min_reserve THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Buyer must keep reserve of at least ' || v_min_reserve || ' Cr.'
    );
  END IF;

  UPDATE public.players
  SET
    status = 'Sold',
    auction_status = 'sold',
    sold_to = v_buyer_name,
    sold_price = v_sale_price || ' Cr',
    sold_to_id = v_buyer_id,
    base_pool = COALESCE(v_player.base_pool, v_player.pool),
    updated_at = NOW()
  WHERE id = v_player.id;

  UPDATE public.auction_state
  SET
    status = 'sold',
    updated_at = NOW()
  WHERE id = v_state.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Player marked sold',
    'player_id', v_player.id,
    'player_name', v_player.player_name,
    'buyer_id', v_buyer_id,
    'buyer_name', v_buyer_name,
    'sale_price', v_sale_price
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'System Error: ' || SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.place_bid(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bid(UUID, UUID, TEXT, NUMERIC) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_current_player_sold() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_current_player_sold() TO authenticated, service_role;
