/**
 * Build per-player PJ fantasy stats from a raw CricAPI `match_scorecard.data` object
 * (same shape as https://api.cricapi.com/v1/match_scorecard).
 * Mirrors `scripts/ipl_fantasy.py` `transform()` including `dot_balls` / `0s` on bowling rows
 * (populate those via Cricsheet merge before storing the scorecard in Supabase).
 */

import {
  type IplFantasyPlayerForScoring,
  d11BonusMultiplierInfo,
  d11PointsAfterMultiplier,
  pjRulesDetailedBreakdown,
  scorePjRulesPlayer,
  type D11BonusMultiplierInfo,
} from "@/lib/scoring";

export type CricApiFantasyPlayerRow = {
  player_id: string;
  player_name: string;
  team: string;
  fantasy: IplFantasyPlayerForScoring;
  scoring: ReturnType<typeof scorePjRulesPlayer>;
  breakdown: ReturnType<typeof pjRulesDetailedBreakdown>;
  d11: D11BonusMultiplierInfo & { multipliedTotal: number };
};

function oversToFloat(raw: unknown): number {
  const o = Number(raw ?? 0) || 0;
  const full = Math.floor(o);
  const balls = Math.round((o - full) * 10);
  return full + balls / 6;
}

function inferPlayerRole(p: {
  batting: { balls: number; runs: number };
  bowling: { overs: number };
}): string {
  const balls = Number(p.batting.balls) || 0;
  const runs = Number(p.batting.runs) || 0;
  const overs = Number(p.bowling.overs) || 0;
  if (overs >= 0.1 && balls > 0) return "All-Rounder";
  if (overs >= 0.1 && balls === 0 && runs === 0) return "Bowler";
  return "Batter";
}

/**
 * @param data — `response.data` from a successful `match_scorecard` call (not the full envelope).
 */
export function aggregateFantasyRowsFromCricApiMatchData(data: Record<string, unknown>): CricApiFantasyPlayerRow[] {
  const teamInfo = (data.teamInfo || []) as Array<{ name?: string; shortname?: string }>;
  const scorecard = (data.scorecard || []) as any[];

  type PState = {
    player_id: string;
    player_name: string;
    team: string;
    batting: {
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      dismissal: string;
    };
    bowling: {
      overs: number;
      maidens: number;
      runs_conceded: number;
      wickets: number;
      lbw_bowled_wickets: number;
      dot_balls: number;
    };
    fielding: {
      catches: number;
      stumpings: number;
      runout_direct: number;
      runout_indirect: number;
    };
  };

  const players = new Map<string, PState>();

  const ensure = (pid: string, name: string): PState => {
    let p = players.get(pid);
    if (!p) {
      p = {
        player_id: pid,
        player_name: name,
        team: "",
        batting: {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          dismissal: "not out",
        },
        bowling: {
          overs: 0,
          maidens: 0,
          runs_conceded: 0,
          wickets: 0,
          lbw_bowled_wickets: 0,
          dot_balls: 0,
        },
        fielding: {
          catches: 0,
          stumpings: 0,
          runout_direct: 0,
          runout_indirect: 0,
        },
      };
      players.set(pid, p);
    }
    return p;
  };

  const teamMap = new Map<string, string>();

  for (const inning of scorecard) {
    const innName = String(inning?.inning || "");
    let innTeam = "";
    for (const t of teamInfo) {
      const tName = (t.name || "").toLowerCase();
      if (tName && innName.toLowerCase().includes(tName)) {
        innTeam = String(t.shortname || "").replace(/W$/, "");
        break;
      }
    }
    for (const b of inning.batting || []) {
      const pid = b?.batsman?.id;
      if (pid && innTeam) teamMap.set(String(pid), innTeam);
    }
  }

  const squadData = (data.squadData || []) as any[];
  for (const squad of squadData) {
    let sTeam = "";
    for (const t of teamInfo) {
      const teamLabel = String(squad?.team || "").toLowerCase();
      if (teamLabel && (t.name || "").toLowerCase().includes(teamLabel)) {
        sTeam = String(t.shortname || "").replace(/W$/, "");
        break;
      }
    }
    if (!sTeam) sTeam = String(squad?.shortname || "").replace(/W$/, "");
    for (const pl of squad.players || []) {
      const pid = pl?.id;
      if (pid && sTeam && !teamMap.has(String(pid))) teamMap.set(String(pid), sTeam);
    }
  }

  for (const squad of squadData) {
    for (const pl of squad.players || []) {
      const pid = pl?.id;
      const name = pl?.name;
      if (!pid || !name) continue;
      const p = ensure(String(pid), String(name));
      if (!p.team) p.team = teamMap.get(String(pid)) || "";
    }
  }

  const bowlerPidByName = new Map<string, string>();
  for (const inning of scorecard) {
    for (const b of inning.bowling || []) {
      const bpid = b?.bowler?.id;
      const bname = b?.bowler?.name;
      if (bpid && bname) bowlerPidByName.set(String(bname).toLowerCase(), String(bpid));
    }
  }

  for (const inning of scorecard) {
    for (const b of inning.batting || []) {
      const pid = b?.batsman?.id;
      const name = b?.batsman?.name;
      if (!pid || !name) continue;
      const p = ensure(String(pid), String(name));
      p.team = teamMap.get(String(pid)) || p.team;
      p.batting.runs += Number(b.r ?? 0) || 0;
      p.batting.balls += Number(b.b ?? 0) || 0;
      p.batting.fours += Number(b["4s"] ?? 0) || 0;
      p.batting.sixes += Number(b["6s"] ?? 0) || 0;
      const d = String(b.dismissal || "");
      if (d) p.batting.dismissal = d;
      const dt = d.toLowerCase().trim();
      if (dt === "bowled" || dt === "lbw") {
        let bpid = b?.bowler?.id;
        const bname = b?.bowler?.name;
        if (!bpid && bname) bpid = bowlerPidByName.get(String(bname).toLowerCase());
        if (bpid && bname) {
          ensure(String(bpid), String(bname)).bowling.lbw_bowled_wickets += 1;
        }
      }
    }

    for (const b of inning.bowling || []) {
      const pid = b?.bowler?.id;
      const name = b?.bowler?.name;
      if (!pid || !name) continue;
      const p = ensure(String(pid), String(name));
      if (!p.team) p.team = teamMap.get(String(pid)) || "";
      p.bowling.overs += oversToFloat(b.o);
      p.bowling.maidens += Number(b.m ?? 0) || 0;
      p.bowling.runs_conceded += Number(b.r ?? 0) || 0;
      p.bowling.wickets += Number(b.w ?? 0) || 0;
      let dotsRow = b.dot_balls;
      if (dotsRow == null) dotsRow = b["0s"];
      p.bowling.dot_balls += Number(dotsRow ?? 0) || 0;
    }

    for (const c of inning.catching || []) {
      const catcher = c.catcher;
      if (!catcher?.id) continue;
      const pid = String(catcher.id);
      const name = String(catcher.name || "");
      const p = ensure(pid, name);
      if (!p.team) p.team = teamMap.get(pid) || "";
      p.fielding.catches += (Number(c.catch ?? 0) || 0) + (Number(c.cb ?? 0) || 0);
      p.fielding.stumpings += Number(c.stumped ?? 0) || 0;
      p.fielding.runout_direct += Number(c.runout ?? 0) || 0;
    }
  }

  for (const p of players.values()) {
    if (!p.team) p.team = teamMap.get(p.player_id) || "";
  }

  const out: CricApiFantasyPlayerRow[] = [];
  for (const p of players.values()) {
    const role = inferPlayerRole(p);
    const fantasy: IplFantasyPlayerForScoring = {
      batting: p.batting,
      bowling: p.bowling,
      fielding: p.fielding,
      in_announced_lineup: true,
      is_playing_substitute: false,
      playerRole: role,
    };
    const scoring = scorePjRulesPlayer(fantasy);
    const r = Number(p.batting.runs ?? 0) || 0;
    const w = Number(p.bowling.wickets ?? 0) || 0;
    const d11Meta = d11BonusMultiplierInfo(r, w);
    out.push({
      player_id: p.player_id,
      player_name: p.player_name,
      team: p.team,
      fantasy,
      scoring,
      breakdown: pjRulesDetailedBreakdown(fantasy),
      d11: {
        ...d11Meta,
        multipliedTotal: d11PointsAfterMultiplier(scoring.total_pts, d11Meta.appliedMultiplier),
      },
    });
  }

  out.sort((a, b) => b.d11.multipliedTotal - a.d11.multipliedTotal);
  return out;
}
