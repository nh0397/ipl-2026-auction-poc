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
import { lookupDbPlayerId, normPlayerName as normPlayerNameForId } from "@/lib/matchPointsPlayerLookup";

export type PlayerCatalogRow = {
  player_name: string;
  team: string;
  type: string | null;
  role: string | null;
  /** When set (e.g. from `players.auction_status`), used for fuzzy name fallback on subs. */
  auction_status?: string | null;
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
  /** False for substitute fielders like `sub (Name)` so they don't get Playing XI +4. */
  inXI?: boolean;
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
  pjScoring?: ReturnType<typeof scorePjRulesPlayer>;
  d11?: D11BonusMultiplierInfo & { multipliedTotal: number };
};

function normalizeScorecardPlayerName(raw: string) {
  return String(raw || "")
    .replace(/†/g, "")
    .replace(/\(c\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSubFielder(raw: string): { name: string; isSub: boolean } {
  const s = normalizeScorecardPlayerName(raw);
  const m = s.match(/^sub\s*\((.+)\)$/i);
  if (m?.[1]) return { name: normalizeScorecardPlayerName(m[1]), isSub: true };
  return { name: s, isSub: false };
}

const TABLE_HEADER_PLAYERS = new Set(["batting", "bowling"]);

function emptyAggregatedStatRow(
  n: string,
  team: string,
  role: string,
  inXI: boolean
): Record<string, unknown> {
  return {
    n,
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
    inXI,
  };
}

/** Add one roster name → stats key; substitutes (`sub (…)`) never get announced XI +4. */
function addAnnouncedPlayerToStats(stats: Record<string, any>, raw: unknown, team: string) {
  const teamTrim = String(team || "").trim();
  if (!teamTrim) return;
  const sub = parseSubFielder(normalizeScorecardPlayerName(String(raw ?? "")));
  const n = sub.name;
  if (!n || TABLE_HEADER_PLAYERS.has(n.toLowerCase())) return;
  const key = `${n}_${teamTrim}`;
  if (!stats[key]) {
    stats[key] = emptyAggregatedStatRow(n, teamTrim, "Batter", !sub.isSub);
  } else if (sub.isSub) {
    stats[key].inXI = false;
  }
}

function inferOpposingBattingTeam(sc: any, battingTeam: string): string {
  const bt = String(battingTeam || "").trim();
  if (!bt) return "";
  const labels = new Set<string>();
  for (const inn of sc?.innings || []) {
    const a = String(inn.team || inn.batting_team || "").trim();
    const b = String(inn.bowling_team || "").trim();
    if (a) labels.add(a);
    if (b) labels.add(b);
  }
  const arr = [...labels].filter(Boolean);
  if (arr.length === 2) {
    const other = arr.find((t) => t !== bt);
    if (other) return other;
  }
  const opp = (sc?.innings || []).find((i: any) => {
    const t = String(i.team || i.batting_team || "").trim();
    return t && t !== bt;
  });
  return String(opp?.team || opp?.batting_team || "").trim();
}

/**
 * Seed every player in the match-day squads (both XIs) before reading dismissals / aggregates.
 * Uses `team_a` / `team_b` from the ESPN scraper when present; otherwise the same union as Python:
 * per innings, batting side = batting + did not bat + yet to bat; bowling side = bowling table.
 */
function seedAnnouncedSquadsIntoStats(stats: Record<string, any>, sc: any) {
  const ta = sc?.team_a;
  const tb = sc?.team_b;
  const teamAName = String(ta?.name ?? "").trim();
  const teamBName = String(tb?.name ?? "").trim();
  const useTopLevelSquads =
    teamAName &&
    teamBName &&
    Array.isArray(ta?.unique) &&
    Array.isArray(tb?.unique) &&
    ta.unique.length > 0 &&
    tb.unique.length > 0;

  if (useTopLevelSquads) {
    for (const raw of ta.unique) addAnnouncedPlayerToStats(stats, raw, teamAName);
    for (const raw of tb.unique) addAnnouncedPlayerToStats(stats, raw, teamBName);
    return;
  }

  for (const inn of sc?.innings || []) {
    const batTeam = String(inn.team || inn.batting_team || "").trim();
    let bowlTeam = String(inn.bowling_team || "").trim();
    if (!bowlTeam && batTeam) bowlTeam = inferOpposingBattingTeam(sc, batTeam);

    const squadBat = inn.squad_batting;
    const squadBowl = inn.squad_bowling;
    if (Array.isArray(squadBat) && batTeam) {
      for (const raw of squadBat) addAnnouncedPlayerToStats(stats, raw, batTeam);
    }
    if (Array.isArray(squadBowl) && bowlTeam) {
      for (const raw of squadBowl) addAnnouncedPlayerToStats(stats, raw, bowlTeam);
    }

    if (batTeam) {
      for (const b of inn.batting || []) {
        const raw = b.player;
        if (raw && raw !== "BATTING") addAnnouncedPlayerToStats(stats, raw, batTeam);
      }
      for (const raw of inn.did_not_bat || inn.didNotBat || []) addAnnouncedPlayerToStats(stats, raw, batTeam);
      for (const raw of inn.yet_to_bat || []) addAnnouncedPlayerToStats(stats, raw, batTeam);
    }
    if (bowlTeam) {
      for (const bw of inn.bowling || []) {
        const raw = bw.bowler;
        if (raw && raw !== "BOWLING") addAnnouncedPlayerToStats(stats, raw, bowlTeam);
      }
    }
  }
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

export function catalogTeamMatches(
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

/** Tokens like scorecard initials / surnames for DB-style %token% matching (min length 2). */
function nameTokensForFuzzyLookup(displayNorm: string): string[] {
  const n = normalizeScorecardPlayerName(displayNorm).toLowerCase();
  return n.split(/\s+/).filter((t) => t.length >= 2);
}

/**
 * If strict name match fails, find a **sold** player on the scorecard team whose `player_name`
 * contains any token from the scorecard label (e.g. "JG" + "Bethell" vs DB "Jacob Bethell").
 */
function findSoldPlayerOnTeamByTokenMatch(
  displayNorm: string,
  scorecardTeam: string,
  catalog: PlayerCatalogRow[],
  match: {
    team1_short?: string | null;
    team1_name?: string | null;
    team2_short?: string | null;
    team2_name?: string | null;
  }
): PlayerCatalogRow | null {
  const tokens = nameTokensForFuzzyLookup(displayNorm);
  if (tokens.length === 0) return null;
  const sold = catalog.filter((p) => String(p.auction_status ?? "").toLowerCase() === "sold");
  for (const p of sold) {
    if (!catalogTeamMatches(scorecardTeam, p.team, match)) continue;
    const pn = String(p.player_name ?? "").toLowerCase();
    if (tokens.some((t) => pn.includes(t))) return p;
  }
  return null;
}

export function findPlayerCatalogRow(
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
  if (candidates.length === 0) {
    return findSoldPlayerOnTeamByTokenMatch(norm, scorecardTeam, catalog, match);
  }
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

  // Full squads first (both XIs): everyone gets announced-lineup +4 in scoring; then we add stats from the card.
  seedAnnouncedSquadsIntoStats(stats, sc);

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
    const suffix = `_${team}`;
    const rawName =
      displayName ||
      (key.endsWith(suffix) ? key.slice(0, -suffix.length) : normalizeScorecardPlayerName(String(key).split("_")[0] || ""));
    const sub = parseSubFielder(rawName);
    const playerName = sub.name;
    if (stats[key]) {
      /** Squad may list "JG Bethell" in XI; dismissal `c sub (JG Bethell)` must strip Playing XI +4. */
      if (sub.isSub) stats[key].inXI = false;
      return;
    }
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
      inXI: !sub.isSub,
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

      if (!stats[key]) {
        const subBat = parseSubFielder(normalizeScorecardPlayerName(rawN));
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
          inXI: !subBat.isSub,
        };
      }
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

      if (!stats[key]) {
        const subBw = parseSubFielder(normalizeScorecardPlayerName(rawN));
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
          inXI: !subBw.isSub,
        };
      }
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
        const nRaw = parts[0].replace(/^(?:c|st)\s+(?:†)?/, "").trim();
        if (nRaw && !["sub", "batting", "retired"].includes(nRaw)) {
          const sub = parseSubFielder(nRaw);
          const key = findKeyForTeamRoster(sub.name, opposingTeam);
          /** Pass full `nRaw` so `sub (Name)` is detected in ensureStatRow (not just the inner name). */
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
            const subRo = parseSubFielder(nRaw.trim());
            const key = findKeyForTeamRoster(subRo.name, opposingTeam);
            ensureStatRow(key, opposingTeam, "Fielder", nRaw.trim());
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
      /** Only strict `true` counts as Playing XI (+4). Substitutes / `sub (Name)` set `inXI` false. */
      in_announced_lineup: p.inXI === true,
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
      pjScoring: scored,
      d11: {
        ...d11Meta,
        multipliedTotal: d11PointsAfterMultiplier(totalPts, d11Meta.appliedMultiplier),
      },
    };
  });

  return rows.sort((a, b) => {
    const bt = b.d11?.multipliedTotal ?? b.total ?? 0;
    const at = a.d11?.multipliedTotal ?? a.total ?? 0;
    return bt - at;
  });
}

/**
 * Map ESPN breakdown row → `players.id` for sync: strict name map first, then same fuzzy rules as the modal
 * (incl. sold-player token match like "JG" / "Bethell" → "Jacob Bethell").
 */
export function resolveDbPlayerIdForEspnRow(
  row: { n: string; team: string },
  catalog: Array<PlayerCatalogRow & { id: string }>,
  match: {
    team1_short?: string | null;
    team1_name?: string | null;
    team2_short?: string | null;
    team2_name?: string | null;
  },
  nameToDbPlayerId: Map<string, string>
): string | undefined {
  const direct = lookupDbPlayerId(row.n, nameToDbPlayerId);
  if (direct) return direct;
  const hit = findPlayerCatalogRow(row.n, row.team, catalog, match);
  if (!hit) return undefined;
  const full = catalog.find(
    (c) =>
      normPlayerNameForId(c.player_name) === normPlayerNameForId(hit.player_name) &&
      catalogTeamMatches(row.team, c.team, match)
  );
  return full?.id;
}
