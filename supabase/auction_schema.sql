-- ============================================
-- IPL 2026 Auction: Live Bidding Tables
-- ============================================

-- 1. Auction Config (Singleton - one row controls the entire auction)
CREATE TABLE IF NOT EXISTS auction_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'frozen', 'live', 'paused', 'completed')),
  current_pool TEXT DEFAULT 'Marquee',
  pools_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the singleton row
INSERT INTO auction_config (status, current_pool, pools_frozen)
VALUES ('setup', 'Marquee', false)
ON CONFLICT DO NOTHING;

-- 2. Auction State (Tracks the player currently on the block)
CREATE TABLE IF NOT EXISTS auction_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'sold', 'unsold')),
  base_price NUMERIC NOT NULL DEFAULT 2,
  current_bid NUMERIC NOT NULL DEFAULT 0,
  current_bidder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  current_bidder_name TEXT,
  min_increment NUMERIC NOT NULL DEFAULT 0.5,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the singleton row
INSERT INTO auction_state (status, base_price, current_bid, min_increment)
VALUES ('waiting', 2, 0, 0.5)
ON CONFLICT DO NOTHING;

-- 3. Add pool column to players if not exists
ALTER TABLE players ADD COLUMN IF NOT EXISTS pool TEXT;

-- 4. Add auction_status to players to track if they've been through auction
ALTER TABLE players ADD COLUMN IF NOT EXISTS auction_status TEXT DEFAULT 'pending'
  CHECK (auction_status IN ('pending', 'on_block', 'sold', 'unsold'));

-- 5. Add passed_user_ids to auction_state for tracking "Out" votes
ALTER TABLE auction_state ADD COLUMN IF NOT EXISTS passed_user_ids TEXT[] DEFAULT '{}';

-- 6. Enable Realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE auction_config;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
