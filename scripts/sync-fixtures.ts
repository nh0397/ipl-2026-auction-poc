import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const API_URL = "https://api.cricapi.com/v1/series_info?apikey=REMOVED_KEY&id=87c62aac-bc3c-4738-ab93-19da0690488f";

function extractMatchNo(name: string): number {
  // "Sunrisers Hyderabad vs Delhi Capitals, 31st Match, ..." → 31
  const match = name.match(/(\d+)(?:st|nd|rd|th)\s+Match/i);
  return match ? parseInt(match[1]) : 0;
}

async function syncFixtures() {
  console.log("🏏 Fetching IPL 2026 fixtures from CricAPI...");
  
  const response = await fetch(API_URL);
  const data: any = await response.json();
  
  if (data.status !== "success") {
    console.error("❌ API Error:", data);
    return;
  }

  const matchList = data.data.matchList;
  console.log(`Found ${matchList.length} matches. Transforming...`);

  const rows = matchList.map((m: any) => ({
    api_match_id: m.id,
    match_no: extractMatchNo(m.name),
    title: m.name.split(",")[0].trim(),
    venue: m.venue || null,
    match_date: m.date,
    date_time_gmt: m.dateTimeGMT,
    team1_name: m.teamInfo?.[0]?.name || m.teams?.[0] || null,
    team1_short: m.teamInfo?.[0]?.shortname || null,
    team1_img: m.teamInfo?.[0]?.img || null,
    team2_name: m.teamInfo?.[1]?.name || m.teams?.[1] || null,
    team2_short: m.teamInfo?.[1]?.shortname || null,
    team2_img: m.teamInfo?.[1]?.img || null,
    status: m.matchEnded ? 'completed' : m.matchStarted ? 'live' : 'scheduled',
    match_started: m.matchStarted || false,
    match_ended: m.matchEnded || false,
  }));

  // Sort by match number
  rows.sort((a: any, b: any) => a.match_no - b.match_no);

  console.log(`\nInserting ${rows.length} fixtures into database...`);

  const { data: result, error } = await supabase
    .from("fixtures")
    .upsert(rows, { onConflict: "api_match_id" });

  if (error) {
    console.error("❌ Database Error:", error.message);
    console.error("Details:", error);
    return;
  }

  console.log("✅ Successfully synced all fixtures!\n");
  
  // Print summary
  console.table(
    rows.slice(0, 10).map((r: any) => ({
      "#": r.match_no,
      Match: r.title,
      Date: r.match_date,
      Venue: r.venue?.split(",")[0],
      Status: r.status,
    }))
  );
  console.log(`... and ${rows.length - 10} more matches.`);
}

syncFixtures().catch(console.error);
