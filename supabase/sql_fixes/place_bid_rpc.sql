-- ATOMIC BIDDING RPC
-- This function handles the entire bidding transaction atomically
-- to prevent race conditions when multiple users bid simultaneously.

CREATE OR REPLACE FUNCTION public.place_bid(
    p_player_id UUID,
    p_bidder_id UUID,
    p_bidder_name TEXT,
    p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_state public.auction_state;
BEGIN
    -- 1. Lock the auction_state record for update to prevent race conditions
    -- This causes any other simultaneous calls to wait until this one completes.
    SELECT * INTO v_state 
    FROM public.auction_state 
    WHERE id IS NOT NULL 
    FOR UPDATE;

    -- 2. Validate the bid context
    IF v_state.current_player_id IS NULL OR v_state.current_player_id != p_player_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Player mismatch or no active player');
    END IF;

    IF v_state.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Auction is not active');
    END IF;

    -- 3. Validate the bid amount
    DECLARE
        v_min_required NUMERIC;
    BEGIN
        IF v_state.current_bidder_id IS NULL THEN
            v_min_required := v_state.base_price;
        ELSE
            v_min_required := v_state.current_bid + v_state.min_increment;
        END IF;

        IF p_amount < v_min_required THEN
            RETURN jsonb_build_object('success', false, 'message', 'Bid too low. Minimum required is ' || v_min_required || ' Cr');
        END IF;
    END;

    -- 4. Execute the update
    UPDATE public.auction_state
    SET 
        current_bid = p_amount,
        current_bidder_id = p_bidder_id,
        current_bidder_name = p_bidder_name,
        passed_user_ids = '{}', -- Reset all passes whenever a new bid is placed
        updated_at = NOW()
    WHERE id = v_state.id;

    -- 5. Record the bid in history
    INSERT INTO public.bids (player_id, bidder_id, bidder_name, amount)
    VALUES (p_player_id, p_bidder_id, p_bidder_name, p_amount);

    RETURN jsonb_build_object('success', true, 'message', 'Bid placed successfully');

EXCEPTION WHEN OTHERS THEN
    -- Fallback for any database errors
    RETURN jsonb_build_object('success', false, 'message', 'System Error: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
