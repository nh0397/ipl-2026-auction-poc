-- Lock exactly one auction_state row (singleton) for concurrent bidding.
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
BEGIN
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
    v_min_required := v_state.base_price;
  ELSE
    v_min_required := v_state.current_bid + v_state.min_increment;
  END IF;

  IF p_amount < v_min_required THEN
    RETURN jsonb_build_object(
      'success',
      false,
      'message',
      'Bid too low. Minimum required is ' || v_min_required || ' Cr'
    );
  END IF;

  UPDATE public.auction_state
  SET
    current_bid = p_amount,
    current_bidder_id = p_bidder_id,
    current_bidder_name = p_bidder_name,
    passed_user_ids = v_state.passed_user_ids,
    updated_at = NOW()
  WHERE id = v_state.id;

  INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount)
  VALUES (p_player_id, p_bidder_id, p_bidder_name, p_amount);

  RETURN jsonb_build_object('success', true, 'message', 'Bid placed successfully');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'System Error: ' || SQLERRM);
END;
$$;
