-- IPL 2026 Auction POC Database Schema

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  team_name TEXT DEFAULT 'New Franchise',
  budget NUMERIC DEFAULT 120, -- 120 Cr starting budget
  role TEXT DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Participant', 'Viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
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
  capped_uncapped TEXT, -- Capped/Uncapped
  acquisition TEXT, -- Retained/Auction/RTM/Traded
  role TEXT, -- e.g. Wicketkeeper Batter, Bowler, etc.
  status TEXT NOT NULL DEFAULT 'Available', -- Available/Sold/Unsold
  sold_to TEXT, -- The name of the team that bought them
  sold_to_id UUID REFERENCES profiles(id), -- UUID of buyer
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
-- ONLY creates profiles for whitelisted participant/admin emails.
-- Everyone else can view via anon key but gets no profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
  assigned_role TEXT;
BEGIN
  -- Determine role based on email
  IF new.email IN (
    'jalan.me4u@gmail.com',
    'harshshah661992@gmail.com',
    'tradingwithparthshah@gmail.com',
    'naisicric97@gmail.com'
  ) THEN
    assigned_role := 'Admin';
  ELSE
    assigned_role := 'Viewer';
  END IF;

  -- Check if profile with this email already exists
  SELECT id INTO existing_id FROM public.profiles WHERE email = new.email;
  
  IF existing_id IS NOT NULL THEN
    -- Profile exists: link it to the real auth user
    UPDATE public.profiles SET 
      id = new.id,
      full_name = COALESCE(new.raw_user_meta_data->>'full_name', full_name),
      avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', avatar_url),
      role = assigned_role,
      updated_at = NOW()
    WHERE email = new.email;
  ELSE
    -- Create profile for this participant/admin
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, budget)
    VALUES (
      new.id, new.email, 
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'avatar_url', 
      assigned_role, 
      CASE WHEN assigned_role = 'Viewer' THEN 0 ELSE 120 END
    );
  END IF;
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
