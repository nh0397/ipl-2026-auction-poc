// One-time script to sync IPL 2026 fixtures from CricAPI to Supabase
// Run with: node scripts/sync-fixtures.js
// Compatible with Node 16+

const https = require("https");

require('dotenv').config();

const API_KEY = process.env.NEXT_PUBLIC_CRICAPI_KEY;
const API_URL = `https://api.cricapi.com/v1/series_info?apikey=${API_KEY}&id=87c62aac-bc3c-4738-ab93-19da0690488f`;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function extractMatchNo(name) {
  const match = name.match(/(\d+)(?:st|nd|rd|th)\s+Match/i);
  return match ? parseInt(match[1]) : 0;
}

async function main() {
  console.log("🏏 Fetching IPL 2026 fixtures from CricAPI...");
  
  const data = await httpGet(API_URL);
  
  if (data.status !== "success") {
    console.error("❌ API Error:", data);
    return;
  }

  const matchList = data.data.matchList;
  console.log(`✅ Found ${matchList.length} matches. Transforming...\n`);

  const rows = matchList.map((m) => ({
    api_match_id: m.id,
    match_no: extractMatchNo(m.name),
    title: m.name.split(",")[0].trim(),
    venue: m.venue || null,
    match_date: m.date,
    date_time_gmt: m.dateTimeGMT,
    team1_name: (m.teamInfo && m.teamInfo[0] && m.teamInfo[0].name) || (m.teams && m.teams[0]) || null,
    team1_short: (m.teamInfo && m.teamInfo[0] && m.teamInfo[0].shortname) || null,
    team1_img: (m.teamInfo && m.teamInfo[0] && m.teamInfo[0].img) || null,
    team2_name: (m.teamInfo && m.teamInfo[1] && m.teamInfo[1].name) || (m.teams && m.teams[1]) || null,
    team2_short: (m.teamInfo && m.teamInfo[1] && m.teamInfo[1].shortname) || null,
    team2_img: (m.teamInfo && m.teamInfo[1] && m.teamInfo[1].img) || null,
    status: m.matchEnded ? "completed" : m.matchStarted ? "live" : "scheduled",
    match_started: m.matchStarted || false,
    match_ended: m.matchEnded || false,
  }));

  rows.sort((a, b) => a.match_no - b.match_no);

  console.log(`Upserting ${rows.length} fixtures into Supabase...\n`);

  try {
    await httpPost(`${SUPABASE_URL}/rest/v1/fixtures`, rows, {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "resolution=merge-duplicates",
    });

    console.log("✅ Successfully synced all fixtures!\n");
    rows.slice(0, 15).forEach((r) => {
      console.log(`  Match ${String(r.match_no).padStart(2)}: ${r.team1_short} vs ${r.team2_short}  |  ${r.match_date}  |  ${r.venue ? r.venue.split(",")[0] : "TBD"}`);
    });
    console.log(`  ... and ${rows.length - 15} more matches.\n`);
    console.log(`API Credits: ${data.info.hitsToday} used today out of ${data.info.hitsLimit}`);
  } catch (err) {
    console.error("❌ Database Error:", err.message);
  }
}

main();
