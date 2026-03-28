import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const apiKey = process.env.NEXT_PUBLIC_CRICAPI_KEY!;
const baseUrl = process.env.NEXT_PUBLIC_CRICAPI_BASE_URL!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Indian Premier League 2026 Series ID
const DEFAULT_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f"; 

async function syncFixtures(seriesId: string) {
  console.log(`Starting fixture sync for series: ${seriesId}`);
  
  try {
    const response = await fetch(`${baseUrl}/series_info?apikey=${apiKey}&id=${seriesId}`);
    const data: any = await response.json();
    
    if (data.status !== "success") {
      throw new Error(data.reason || "Failed to fetch fixtures from CricAPI");
    }

    const matches = data.data.matchList;
    console.log(`Found ${matches.length} matches. Processing...`);

    const formattedMatches = matches.map((m: any) => ({
      api_match_id: m.id,
      match_no: parseInt(m.name.match(/(\d+)/)?.[0] || "0"),
      title: m.name.split(",")[0],
      date_time: m.dateTimeGMT,
    }));

    const { data: upsertData, error } = await supabase
      .from("matches")
      .upsert(formattedMatches, { onConflict: "match_no" });

    if (error) throw error;

    console.log("✅ Successfully synced fixtures to database!");
    console.table(formattedMatches.slice(0, 5).map((m: any) => ({
      No: m.match_no,
      Match: m.title,
      Date: m.date_time
    })));
    
  } catch (err: any) {
    console.error("❌ Sync Error:", err.message);
  }
}

// Get series ID from command line or use default
const targetSeries = process.argv[2] || DEFAULT_SERIES_ID;
syncFixtures(targetSeries);
