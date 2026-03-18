import { supabase } from "./supabase";
import { calculateDream11Points, MatchStats } from "./scoring";

const API_KEY = process.env.NEXT_PUBLIC_CRICAPI_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_CRICAPI_BASE_URL;

/**
 * Sync fixtures for a specific series
 */
export async function syncFixtures(seriesId: string) {
  try {
    const response = await fetch(`${BASE_URL}/series_info?apikey=${API_KEY}&id=${seriesId}`);
    const data = await response.json();
    
    if (data.status !== "success") throw new Error(data.reason || "Failed to fetch fixtures");

    const matches = data.data.matchList;
    const { error } = await supabase.from("matches").upsert(
      matches.map((m: any) => ({
        api_match_id: m.id,
        match_no: parseInt(m.name.match(/(\d+)/)?.[0] || "0"),
        title: m.name.split(",")[0],
        date_time: m.dateTimeGMT,
      })),
      { onConflict: "match_no" }
    );

    if (error) throw error;
    return { success: true, count: matches.length };
  } catch (err: any) {
    console.error("Error syncing fixtures:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Sync player scores for a specific match
 */
export async function syncMatchScores(matchId: string, apiMatchId: string) {
  try {
    const response = await fetch(`${BASE_URL}/match_scorecard?apikey=${API_KEY}&id=${apiMatchId}`);
    const data = await response.json();

    if (data.status !== "success") throw new Error(data.reason || "Failed to fetch scorecard");

    const scorecard = data.data.scorecard;
    const allPlayers = await supabase.from("players").select("id, api_player_id, role");
    const playerMap = new Map(allPlayers.data?.map(p => [p.api_player_id, p]));

    const updates: any[] = [];

    scorecard.forEach((inning: any) => {
      // Process Batting
      inning.batting.forEach((b: any) => {
        const player = playerMap.get(b.player.id);
        if (!player) return;

        const stats: MatchStats = {
          runs: b.r,
          balls: b.b,
          fours: b['4s'],
          sixes: b['6s'],
          wickets: 0,
          lbwBowled: 0,
          maidens: 0,
          catches: 0,
          stumpings: 0,
          runOutDirect: 0,
          runOutIndirect: 0,
          dotBalls: 0,
          strikeRate: b.sr,
          isDuck: b.r === 0 && b.dismissal !== "not out",
          role: mapRole(player.role)
        };
        
        updates.push({
          match_id: matchId,
          player_id: player.id,
          points: calculateDream11Points(stats)
        });
      });

      // Process Bowling
      inning.bowling.forEach((bw: any) => {
        const player = playerMap.get(bw.player.id);
        if (!player) return;

        const updateIdx = updates.findIndex(u => u.player_id === player.id);
        
        const stats: MatchStats = {
          runs: 0, balls: 0, fours: 0, sixes: 0,
          wickets: bw.w,
          lbwBowled: 0, // Raw scorecard doesn't detail this
          maidens: bw.m,
          catches: 0, stumpings: 0, runOutDirect: 0, runOutIndirect: 0, dotBalls: 0,
          economyRate: bw.er,
          oversMoved: bw.o,
          isDuck: false,
          role: mapRole(player.role)
        };

        const bowlingPoints = calculateDream11Points(stats);
        if (updateIdx > -1) {
          updates[updateIdx].points += bowlingPoints;
        } else {
          updates.push({ match_id: matchId, player_id: player.id, points: bowlingPoints });
        }
      });

      // Process Fielding
      inning.fielding.forEach((f: any) => {
        const player = playerMap.get(f.player.id);
        if (!player) return;

        const updateIdx = updates.findIndex(u => u.player_id === player.id);
        
        const stats: MatchStats = {
          runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, lbwBowled: 0, maidens: 0,
          catches: f.c || 0,
          stumpings: f.st || 0,
          runOutDirect: (f.re || 0) + (f.ro || 0), // Estimate run-outs
          runOutIndirect: 0,
          dotBalls: 0,
          isDuck: false,
          role: mapRole(player.role)
        };

        const fieldingPoints = calculateDream11Points(stats);
        if (updateIdx > -1) {
          updates[updateIdx].points += fieldingPoints;
        } else {
          updates.push({ match_id: matchId, player_id: player.id, points: fieldingPoints });
        }
      });
    });

    const { error } = await supabase.from("match_points").upsert(updates, { onConflict: "player_id,match_id" });
    if (error) throw error;

    return { success: true, count: updates.length };
  } catch (err: any) {
    console.error("Error syncing scores:", err);
    return { success: false, error: err.message };
  }
}

function mapRole(role: string): 'Batter' | 'Bowler' | 'All-Rounder' | 'WK' {
  const r = (role || "").toLowerCase();
  if (r.includes("wk") || r.includes("keeper")) return "WK";
  if (r.includes("all")) return "All-Rounder";
  if (r.includes("bowl")) return "Bowler";
  return "Batter";
}
