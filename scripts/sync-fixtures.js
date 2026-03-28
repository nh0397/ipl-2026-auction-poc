const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load from .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiKey = process.env.NEXT_PUBLIC_CRICAPI_KEY;
const baseUrl = process.env.NEXT_PUBLIC_CRICAPI_BASE_URL;
const seriesId = "87c62aac-bc3c-4738-ab93-19da0690488f"; // IPL 2026

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function syncFixtures() {
  console.log(`Starting fixture sync for IPL 2026...`);
  
  try {
    const url = `${baseUrl}/series_info?apikey=${apiKey}&id=${seriesId}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== "success") {
      throw new Error(data.reason || "Failed to fetch fixtures");
    }

    const matches = data.data.matchList;
    console.log(`Found ${matches.length} matches. Upserting to database...`);

    const formattedMatches = matches.map((m) => ({
      api_match_id: m.id,
      match_no: parseInt(m.name.match(/(\d+)/)?.[0] || "0"),
      title: m.name.split(",")[0],
      date_time: m.dateTimeGMT,
      status: 'scheduled'
    }));

    const { error } = await supabase
      .from("matches")
      .upsert(formattedMatches, { onConflict: "match_no" });

    if (error) throw error;

    console.log("✅ Successfully synced 70 IPL fixtures to your 'matches' table!");
  } catch (err) {
    console.error("❌ Error syncing fixtures:", err.message);
  }
}

syncFixtures();
