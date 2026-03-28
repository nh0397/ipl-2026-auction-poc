import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { syncMatchScores } from '../lib/cricapi';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function autoSync() {
  console.log("🚀 Starting Automated Score Sync...");
  const now = new Date();

  try {
    // 1. Get matches that are NOT completed
    // We also filter for matches that have already started (or start within the next hour)
    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .neq('status', 'completed')
      .order('date_time', { ascending: true });

    if (error) throw error;
    if (!matches || matches.length === 0) {
      console.log("✅ No active matches found to sync.");
      return;
    }

    for (const match of matches) {
      const matchTime = new Date(match.date_time);
      const timeDiffMs = now.getTime() - matchTime.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      // Eligibility Rule:
      // - Match starts within 1 hour OR
      // - Match started in the last 12 hours (typical T20 duration with buffer)
      if (timeDiffHours >= -1 && timeDiffHours <= 12) {
        console.log(`📡 Syncing Match ${match.match_no}: ${match.title}`);
        
        const result = await syncMatchScores(match.id, match.api_match_id);
        
        if (result.success) {
          const newStatus = result.matchEnded ? 'completed' : 'live';
          
          const { error: updateError } = await supabase
            .from('matches')
            .update({ 
              status: newStatus,
              last_sync_at: new Date().toISOString()
            })
            .eq('id', match.id);

          if (updateError) console.error(`❌ Error updating match status:`, updateError);
          else console.log(`✅ Match ${match.match_no} synced. Status: ${newStatus}`);
        } else {
          console.error(`❌ Sync failed for match ${match.match_no}:`, result.error);
        }
      }
    }

    console.log("🏁 Auto-sync cycle completed.");
  } catch (err: any) {
    console.error("💥 Critical Sync Error:", err.message);
  }
}

autoSync();
