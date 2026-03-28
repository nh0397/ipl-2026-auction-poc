// Score sync script — fetches today's match scorecard from CricAPI and saves to fixtures.scorecard
// Run with: node scripts/sync-scores.js
// Compatible with Node 16+ (uses built-in https, no fetch/SDK needed)

const https = require("https");
require("dotenv").config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CRICAPI_KEY = process.env.NEXT_PUBLIC_CRICAPI_KEY;

// ─── HTTP helpers ───────────────────────────────────────────────────
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

function httpRequest(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        else resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Get today's date in YYYY-MM-DD (IST) ───────────────────────────
function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const today = getTodayIST();
  console.log(`\n🏏 Score Sync — Looking for matches on ${today}\n`);

  // 1. Fetch today's fixtures from Supabase
  const fixturesUrl = `${SUPABASE_URL}/rest/v1/fixtures?match_date=eq.${today}&select=*`;
  const { data: todayFixtures } = await httpRequest("GET", fixturesUrl, null, {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  });

  if (!todayFixtures || todayFixtures.length === 0) {
    console.log("✅ No matches scheduled for today. Nothing to sync.");
    return;
  }

  console.log(`📋 Found ${todayFixtures.length} match(es) today:\n`);
  todayFixtures.forEach((f) => {
    console.log(`   Match ${f.match_no}: ${f.team1_short} vs ${f.team2_short} (${f.status})`);
    console.log(`   API Match ID: ${f.api_match_id}`);
    console.log(`   Venue: ${f.venue || "TBD"}\n`);
  });

  // 2. For each match, fetch scorecard from CricAPI
  for (const fixture of todayFixtures) {
    if (!fixture.api_match_id) {
      console.log(`⚠️  Match ${fixture.match_no} has no API match ID. Skipping.`);
      continue;
    }

    console.log(`📡 Fetching scorecard for Match ${fixture.match_no}: ${fixture.team1_short} vs ${fixture.team2_short}...`);

    try {
      const scorecardUrl = `https://api.cricapi.com/v1/match_scorecard?apikey=${CRICAPI_KEY}&id=${fixture.api_match_id}`;
      const scorecardData = await httpGet(scorecardUrl);

      if (scorecardData.status !== "success") {
        console.log(`⚠️  API returned: ${scorecardData.status} — ${scorecardData.reason || "unknown error"}`);
        console.log(`   (Match may not have started yet)\n`);
        continue;
      }

      const matchData = scorecardData.data;
      const isStarted = matchData.matchStarted || false;
      const isEnded = matchData.matchEnded || false;

      console.log(`   Match started: ${isStarted}, Match ended: ${isEnded}`);

      // 3. Update the fixture row with the scorecard data
      const updateUrl = `${SUPABASE_URL}/rest/v1/fixtures?id=eq.${fixture.id}`;
      await httpRequest("PATCH", updateUrl, {
        scorecard: matchData,
        status: isEnded ? "completed" : isStarted ? "live" : fixture.status,
        match_started: isStarted,
        match_ended: isEnded,
      }, {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal",
      });

      console.log(`   ✅ Scorecard saved to fixtures table!`);

      // Print score summary if available
      if (matchData.scorecard && matchData.scorecard.length > 0) {
        matchData.scorecard.forEach((inning) => {
          console.log(`   📊 ${inning.inning}: ${inning.r}/${inning.w} (${inning.o} ov)`);
        });
      } else if (matchData.score && matchData.score.length > 0) {
        matchData.score.forEach((s) => {
          console.log(`   📊 ${s.inning}: ${s.r}/${s.w} (${s.o} ov)`);
        });
      }
      console.log();
    } catch (err) {
      console.error(`   ❌ Error syncing Match ${fixture.match_no}:`, err.message, "\n");
    }
  }

  console.log("🏁 Score sync completed!\n");
}

main().catch((err) => {
  console.error("💥 Fatal error:", err.message);
  process.exit(1);
});
