-- Add missing columns for refined Fantasy Scorecard
ALTER TABLE "public"."match_points" 
ADD COLUMN IF NOT EXISTS "dot_balls" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "is_announced" boolean DEFAULT true;
