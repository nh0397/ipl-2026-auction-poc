/**
 * PJ fantasy rows from an ESPN-shaped scorecard (`fixtures.scorecard`: innings, batting, bowling, catching).
 * Shared by Scoreboard and Fixtures modals.
 */

import {
  scorePjRulesPlayer,
  pjRulesDetailedBreakdown,
  d11BonusMultiplierInfo,
  d11PointsAfterMultiplier,
  parseLbwBowledBowlerName,
  pjResolveScoringPlayerRole,
  type PjRulesDetailedBreakdown,
  type D11BonusMultiplierInfo,
} from "@/lib/scoring";

export type PlayerCatalogRow = {
  player_name: string;
  team: string;
  type: string | null;
  role: string | null;
};

export type EspnPjBreakdownRow = {
  n: string;
  team: string;
  role: string;
  r: number;
  b: number;
  f: number;
  s: number;
  w: number;
  m: number;
  o: number;
  r_conc: number;
  c: number;
  st: number;
  dots: number;
  lbwB: number;
  ro: number;
  roI: number;
  dismissal?: string;
  base: number;
  b_pts: number;
  bw_pts: number;
  f_pts: number;
  sr_pts: number | null;
  eco_pts: number | null;
  total: number;
  breakdownHint?: string;
  _variant: "pjRules";
  pjDetail?: PjRulesDetailedBreakdown;
  d11?: D11BonusMultiplierInfo & { multipliedTotal: number };
};

function normalizeScorecardPlayerName(raw: string) {
  return String(raw || "")
    .replace(/†/g, "")
    .replace(/\(c\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function catalogNameMatches(scorecardNorm: string, dbName: string): boolean {
  const a = scorecardNorm.toLowerCase().replace(/\s+/g, " ").trim();
  const b = normalizeScorecardPlayerName(dbName).toLowerCase();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const al = a.split(/\s+/).pop() || a;
  const bl = b.split(/\s+/).pop() || b;
  if (al === bl && al.length >= 3) return true;
  return false;
}

function catalogTeamMatches(
  scorecardTeam: string,
  playerTeam: string,
  match: {
    team1_short?: string | null;
    team1_name?: string | null;
    team2_short?: string | null;
    team2_name?: string | null;
  }
): boolean {
  const pt = playerTeam.trim().toLowerCase();
  if (!pt) return true;
  const st = scorecardTeam.trim().toLowerCase();
  if (st.includes(pt) || pt.includes(st)) return true;
  const hints = [match.team1_short, match.team1_name, match.team2_short, match.team2_name].filter(Boolean) as string[];
  for (const h of hints) {
    const hl = h.toLowerCase();
    if (hl.includes(pt) || pt.includes(hl)) return true;
    if (st.includes(hl) || hl.includes(st)) return true;
  }
  return false;
}

function findPlayerCatalogRow(
  displayName: string,
  scorecardTeam: string,
  catalog: PlayerCatalogRow[],
  match: {
    team1_short?: string | null;
    team1_name?: string | null;
    team2_short?: string | null;
    team2_name?: string | null;
  }
): PlayerCatalogRow | null {
  if (!catalog?.length) return null;
  const norm = normalizeScorecardPlayerName(displayName);
  const candidates = catalog.filter((p) => catalogNameMatches(norm, p.player_name));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const teamScoped = candidates.filter((p) => catalogTeamMatches(scorecardTeam, p.team, match));
  return teamScoped[0] ?? candidates[0];
}

export function computeEspnPjBreakdownRows(
  sc: any,
  match: {
    team1_short?: string | null;
    team1_name?: string | null;
    team2_short?: string | null;
    team2_name?: string | null;
  },
  catalog: PlayerCatalogRow[]
): EspnPjBreakdownRow[] {
  if (!sc?.innings) return [];

  const stats: Record<string, any> = {};

  sc.innings.forEach((inn: any) => {
    const battingTeam = inn.team;
    const bowlingTeam = sc.innings.find((i: any) => i.team !== battingTeam)?.team || "Opponent";
    (inn.batting || []).forEach((b: any) => {
      const raw = b.player || "";
      if (!raw || raw === "BATTING") return;
      const n = normalizeScorecardPlayerName(raw);
      const key = `${n}_${battingTeam}`;
      if (!stats[key])
        stats[key] = { n, team: battingTeam, r: 0, b: 0, f: 0, s: 0, w: 0, m: 0, o: 0, r_conc: 0, c: 0, st: 0, dots: 0, lbwB: 0, ro: 0, roI: 0, isDuck: false, role: "Batter" };
    });
    (inn.bowling || []).forEach((bw: any) => {
      const raw = bw.bowler || "";
      if (!raw || raw === "BOWLING") return;
      const n = normalizeScorecardPlayerName(raw);
      const key = `${n}_${bowlingTeam}`;
      if (!stats[key])
        stats[key] = { n, team: bowlingTeam, r: 0, b: 0, f: 0, s: 0, w: 0, m: 0, o: 0, r_conc: 0, c: 0, st: 0, dots: 0, lbwB: 0, ro: 0, roI: 0, isDuck: false, role: "Bowler" };
    });
  });

  const findKeyForTeamRoster = (name: string, team: string) => {
    const n = normalizeScorecardPlayerName(name);
    const suffix = `_${team}`;
    const exact = `${n}_${team}`;
    if (stats[exact]) return exact;
    const keys = Object.keys(stats).filter((k) => k.endsWith(suffix));
    const nLower = n.toLowerCase();
    for (const k of keys) {
      const playerPart = k.slice(0, -suffix.length);
      if (playerPart.toLowerCase() === nLower) return k;
    }
    for (const k of keys) {
      const pl = k.slice(0, -suffix.length).toLowerCase();
      if (pl.includes(nLower) || nLower.includes(pl)) return k;
    }
    const lastTok = nLower.split(/\s+/).pop() || nLower;
    for (const k of keys) {
      const parts = k.slice(0, -suffix.length).toLowerCase().split(/\s+/).filter(Boolean);
      if (parts.some((part) => part === lastTok || part.startsWith(lastTok) || lastTok.startsWith(part))) return k;
    }
    return exact;
  };

  const ensureStatRow = (key: string, team: string, role: string, displayName?: string) => {
    if (stats[key]) return;
    const suffix = `_${team}`;
    const playerName =
      displayName ||
      (key.endsWith(suffix) ? key.slice(0, -suffix.length) : normalizeScorecardPlayerName(String(key).split("_")[0] || ""));
    stats[key] = {
      n: playerName,
      team,
      r: 0,
      b: 0,
      f: 0,
      s: 0,
      w: 0,
      m: 0,
      o: 0,
      r_conc: 0,
      c: 0,
      st: 0,
      dots: 0,
      lbwB: 0,
      ro: 0,
      roI: 0,
      isDuck: false,
      role,
      dismissal: "",
    };
  };

  sc.innings.forEach((inn: any) => {
    const currentTeam = inn.team;
    const opposingTeam = sc.innings.find((i: any) => i.team !== currentTeam)?.team || "Opponent";

    (inn.batting || []).forEach((b: any) => {
      const rawN = b.player || "";
      if (!rawN || rawN === "BATTING") return;
      const key = findKeyForTeamRoster(rawN, currentTeam);
      const dStr = (b.dismissal || b["dismissal-text"] || "").toLowerCase();
      const sufCT = `_${currentTeam}`;

      if (!stats[key])
        stats[key] = {
          n: key.endsWith(sufCT) ? key.slice(0, -sufCT.length) : normalizeScorecardPlayerName(rawN),
          team: currentTeam,
          r: 0,
          b: 0,
          f: 0,
          s: 0,
          w: 0,
          m: 0,
          o: 0,
          r_conc: 0,
          c: 0,
          st: 0,
          dots: 0,
          lbwB: 0,
          ro: 0,
          roI: 0,
          isDuck: false,
          role: "Batter",
          dismissal: "",
        };
      stats[key].r += Number(b.R || b.r) || 0;
      stats[key].b += Number(b.B || b.b) || 0;
      stats[key].f += Number(b["4s"]) || 0;
      stats[key].s += Number(b["6s"]) || 0;
      if (dStr) stats[key].dismissal = dStr;
      if (rawN.includes("†")) stats[key].role = "WK";
      else if (stats[key].role === "Fielder") stats[key].role = "Batter";

      if (stats[key].r === 0 && dStr !== "not out" && dStr !== "") stats[key].isDuck = true;

      const lbwBowledBy = parseLbwBowledBowlerName(b.dismissal || b["dismissal-text"] || "");
      if (lbwBowledBy) {
        const bKey = findKeyForTeamRoster(lbwBowledBy, opposingTeam);
        ensureStatRow(bKey, opposingTeam, "Bowler", lbwBowledBy);
        stats[bKey].lbwB += 1;
      }
    });

    (inn.bowling || []).forEach((bw: any) => {
      const rawN = bw.bowler;
      if (!rawN || rawN === "BOWLING") return;
      const key = findKeyForTeamRoster(rawN, opposingTeam);
      const sufOpp = `_${opposingTeam}`;

      if (!stats[key])
        stats[key] = {
          n: key.endsWith(sufOpp) ? key.slice(0, -sufOpp.length) : normalizeScorecardPlayerName(rawN),
          team: opposingTeam,
          r: 0,
          b: 0,
          f: 0,
          s: 0,
          r_conc: 0,
          w: 0,
          m: 0,
          o: 0,
          c: 0,
          st: 0,
          dots: 0,
          lbwB: 0,
          ro: 0,
          roI: 0,
          isDuck: false,
          role: "Bowler",
        };
      stats[key].w += Number(bw.W || bw.w) || 0;
      stats[key].m += Number(bw.M || bw.m) || 0;
      stats[key].r_conc += Number(bw.R || bw.r) || 0;
      stats[key].o += Number(bw.O || bw.o) || 0;
      stats[key].dots += Number(bw["0s"] || 0);

      if (stats[key].role === "Batter" || stats[key].role === "WK")
        stats[key].role = stats[key].role === "WK" ? "WK/Bowler" : "All-Rounder";
      else if (stats[key].role === "Fielder") stats[key].role = "Bowler";
    });

    (inn.catching || []).forEach((c: any) => {
      const rawN = typeof c.catcher === "string" ? c.catcher : c.catcher?.name;
      if (!rawN) return;
      const key = findKeyForTeamRoster(rawN, opposingTeam);
      ensureStatRow(key, opposingTeam, "Fielder", rawN);
      stats[key].c += Number(c.catch || 0);
      stats[key].st += Number(c.stumped || 0);
    });

    (inn.batting || []).forEach((b: any) => {
      const d = (b.dismissal || b["dismissal-text"] || "").toLowerCase();
      if (!d) return;

      if (/\bc\s*&\s*b\s+/i.test(d)) {
        const m = d.match(/\bc\s*&\s*b\s+([a-zA-Z .''-]+)/i);
        if (m?.[1]) {
          const nRaw = m[1].trim();
          const key = findKeyForTeamRoster(nRaw, opposingTeam);
          ensureStatRow(key, opposingTeam, "Fielder", nRaw);
          stats[key].c += 1;
        }
        return;
      }

      if (d.startsWith("c ") || d.startsWith("st ")) {
        const parts = d.split(" b ");
        let nRaw = parts[0].replace(/^(?:c|st)\s+(?:†)?/, "").trim();
        if (nRaw && !["sub", "batting", "retired"].includes(nRaw)) {
          const key = findKeyForTeamRoster(nRaw, opposingTeam);
          ensureStatRow(key, opposingTeam, "Fielder", nRaw);
          if (d.startsWith("c ")) stats[key].c += 1;
          if (d.startsWith("st ")) stats[key].st += 1;
        }
      }

      if (d.includes("run out")) {
        const roMatch = d.match(/\(([^)]+)\)/);
        if (roMatch?.[1]) {
          const inner = roMatch[1].trim();
          let parts: string[];
          const bySlash = inner.split(/\s*\/\s*/).map((s: string) => s.trim()).filter(Boolean);
          if (bySlash.length >= 2) parts = bySlash;
          else {
            const byComma = inner.split(/\s*,\s*/).map((s: string) => s.trim()).filter(Boolean);
            parts = byComma.length >= 2 ? byComma : [inner];
          }
          const indirect = parts.length >= 2;
          for (const nRaw of parts) {
            if (!nRaw || /^sub$/i.test(nRaw)) continue;
            const key = findKeyForTeamRoster(nRaw, opposingTeam);
            ensureStatRow(key, opposingTeam, "Fielder", nRaw);
            if (indirect) stats[key].roI += 1;
            else stats[key].ro += 1;
          }
        }
      }
    });
  });

  const base = 4;

  const rows: EspnPjBreakdownRow[] = Object.values(stats).map((p: any) => {
    const cat = findPlayerCatalogRow(p.n, p.team, catalog, match);
    const resolvedRole = pjResolveScoringPlayerRole(cat?.type, cat?.role, p.role);
    const pjInput = {
      batting: { runs: p.r, balls: p.b, fours: p.f, sixes: p.s, dismissal: p.dismissal || "not out" },
      bowling: {
        overs: p.o,
        maidens: p.m,
        runs_conceded: p.r_conc,
        wickets: p.w,
        lbw_bowled_wickets: p.lbwB,
        dot_balls: p.dots,
      },
      fielding: { catches: p.c, stumpings: p.st, runout_direct: p.ro, runout_indirect: p.roI ?? 0 },
      in_announced_lineup: true,
      playerRole: resolvedRole,
    };
    const scored = scorePjRulesPlayer(pjInput);
    const pjDetail = pjRulesDetailedBreakdown(pjInput);
    const totalPts = base + scored.total_pts - 4;
    const d11Meta = d11BonusMultiplierInfo(p.r, p.w);
    return {
      ...p,
      role: resolvedRole,
      _variant: "pjRules" as const,
      base,
      b_pts: scored.batting_pts,
      bw_pts: scored.bowling_pts,
      f_pts: scored.fielding_pts,
      sr_pts: scored.sr_pts ?? null,
      eco_pts: scored.eco_pts ?? null,
      total: totalPts,
      breakdownHint: "PJ Rules (T20)",
      pjDetail,
      d11: {
        ...d11Meta,
        multipliedTotal: d11PointsAfterMultiplier(totalPts, d11Meta.appliedMultiplier),
      },
    };
  });

  return rows.sort((a, b) => (b.total || 0) - (a.total || 0));
}
