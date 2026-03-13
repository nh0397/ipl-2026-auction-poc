#!/bin/bash

# Configuration
OUTPUT_FILE="supabase/seed_prod.sql"

echo "🚀 Starting data export for production..."

# 1. Export core configuration and rules
echo "📦 Exporting auction_config, auction_state, and auction_settings..."
supabase db dump --local --data-only --table public.auction_config,public.auction_state,public.auction_settings -f "$OUTPUT_FILE"

# 2. Append player data
echo "📦 Exporting players and bids..."
supabase db dump --local --data-only --table public.players,public.bids -f "tmp_players.sql"
cat "tmp_players.sql" >> "$OUTPUT_FILE"
rm "tmp_players.sql"

# 3. Append profiles
echo "📦 Exporting profiles..."
supabase db dump --local --data-only --table public.profiles -f "tmp_profiles.sql"
cat "tmp_profiles.sql" >> "$OUTPUT_FILE"
rm "tmp_profiles.sql"

echo "✅ Production seed file generated: $OUTPUT_FILE"
echo "💡 Usage: Run 'supabase db execute < $OUTPUT_FILE' on your production instance."
