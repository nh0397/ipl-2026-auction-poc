-- Migration: Points System & Leaderboard
-- Created: 2026-03-12

-- 1. Matches Table
CREATE TABLE IF NOT EXISTS public.matches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    match_no integer UNIQUE NOT NULL,
    title text NOT NULL,
    is_locked boolean DEFAULT false,
    date_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Match Points Table (Stores points per player per match)
CREATE TABLE IF NOT EXISTS public.match_points (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
    match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
    points numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(player_id, match_id)
);

-- 3. Nominations Table (Team strategy per match)
CREATE TABLE IF NOT EXISTS public.nominations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
    captain_id uuid REFERENCES public.players(id),
    vc_id uuid REFERENCES public.players(id),
    booster_id text,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(team_id, match_id)
);

-- 4. Track C/VC changes in profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cvc_changes_used integer DEFAULT 0;

-- Enable real-time for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nominations;

-- Helper index
CREATE INDEX IF NOT EXISTS idx_match_points_player ON public.match_points(player_id);
CREATE INDEX IF NOT EXISTS idx_match_points_match ON public.match_points(match_id);
