-- IPL 2026 Auction POC Database Schema

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  team_name TEXT DEFAULT 'New Franchise',
  budget NUMERIC DEFAULT 120, -- 120 Cr starting budget
  role TEXT DEFAULT 'Manager' CHECK (role IN ('Admin', 'Manager')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Players Table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  team TEXT NOT NULL, -- Current/Previous Team
  country TEXT NOT NULL,
  price TEXT NOT NULL, -- Base Price
  type TEXT, -- e.g. Overseas/Indian
  capped_uncapped TEXT CHECK (capped_uncapped IN ('Capped', 'Uncapped')),
  acquisition TEXT CHECK (acquisition IN ('Retained', 'Auction', 'RTM')),
  role TEXT CHECK (role IN ('All-rounder', 'Batter', 'Batter/WK', 'Bowler')),
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Sold', 'Unsold')),
  sold_to TEXT, -- The name of the team that bought them
  sold_price TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bids Table
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  bidder_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bidder_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Automation: Sync Auth Users to Profiles
-- This trigger automatically creates a profile entry when someone logs in via Google
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable Realtime
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE bids;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
