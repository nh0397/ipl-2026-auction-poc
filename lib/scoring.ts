/**
 * Dream11 T20 Scoring Rules (2024-2025 Standard)
 */

export interface MatchStats {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  lbwBowled: number;
  maidens: number;
  catches: number;
  stumpings: number;
  runOutDirect: number;
  runOutIndirect: number;
  dotBalls: number;
  economyRate?: number;
  strikeRate?: number;
  oversMoved?: number; // Needed for economy rate check (min 2 overs)
  isDuck: boolean;
  isAnnounced?: boolean; // NEW: +4 pts for being in the playing 11
  role: 'Batter' | 'Bowler' | 'All-Rounder' | 'WK';
}

export function calculateDream11Points(stats: MatchStats): number {
  let points = 0;

  // 1. Batting Points
  points += stats.runs; // 1 pt per run
  points += stats.fours * 4; // UPDATED: +4 per four
  points += stats.sixes * 6; // UPDATED: +6 per six

  // Batting Milestone Bonuses (Highest achieved only)
  if (stats.runs >= 100) points += 16;
  else if (stats.runs >= 75) points += 12;
  else if (stats.runs >= 50) points += 8;
  else if (stats.runs >= 25) points += 4;

  // Duck Penalty
  if (stats.isDuck && stats.role !== 'Bowler') {
    points -= 2;
  }

  // 2. Bowling Points
  points += stats.wickets * 30; // UPDATED: 30 pts per wicket
  points += stats.lbwBowled * 8; // +8 per LBW or Bowled
  points += stats.maidens * 12; // +12 per maiden
  points += stats.dotBalls * 1; // NEW: +1 per dot ball

  // Bowling Milestone Bonuses
  if (stats.wickets >= 5) points += 12; // UPDATED: +12 for 5W
  else if (stats.wickets >= 4) points += 8;
  else if (stats.wickets >= 3) points += 4;

  // 3. Fielding Points
  points += stats.catches * 8;
  if (stats.catches >= 3) points += 4; // 3 catch bonus
  points += stats.stumpings * 12;
  points += stats.runOutDirect * 12;
  points += stats.runOutIndirect * 6;

  // 4. Economy rate (min 2 overs) — T20 chart: neutral for ~7–10 RPO
  if (stats.oversMoved && stats.oversMoved >= 2 && stats.economyRate !== undefined) {
    const eco = stats.economyRate;
    if (eco < 5) points += 6;
    else if (eco <= 5.99) points += 4;
    else if (eco <= 7) points += 2;
    else if (eco < 10) {
      /* 7.01–9.99: 0 */
    } else if (eco <= 11) points -= 2;
    else if (eco <= 12) points -= 4;
    else points -= 6;
  }

  // 5. Strike rate (except bowler, min 10 balls)
  if (stats.balls >= 10 && stats.strikeRate !== undefined && stats.role !== "Bowler") {
    const sr = stats.strikeRate;
    if (sr > 170) points += 6;
    else if (sr >= 150.01 && sr <= 170) points += 4;
    else if (sr >= 130 && sr <= 150) points += 2;
    else if (sr >= 60 && sr < 70) points -= 2;
    else if (sr >= 50 && sr < 60) points -= 4;
    else if (sr < 50) points -= 6;
  }
  
  // 6. Others — announced playing XI (+4)
  if (stats.isAnnounced) points += 4;

  return points;
}

// ============================================================================
// IPL Fantasy (Python rules port)
// ============================================================================

export interface IplFantasyBatting {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  /** Example values: "not out", "c ...", "b ...", "retired hurt" */
  dismissal: string;
}

export interface IplFantasyBowling {
  overs: number; // already normalized to (overs + balls/6)
  maidens: number;
  runs_conceded: number;
  wickets: number;
  lbw_bowled_wickets: number;
  dot_balls: number;
}

/**
 * ESPN-style dismissal text for +8 LBW/bowled bowling bonus — returns the **bowler** name, not the batter.
 * Examples: `lbw b Jadeja`, `lbw b R Ashwin`, `b Burger` (pure bowled). Not `c Iyer b Jansen` (caught).
 * Caught & bowled (`c & b Name`) does not use this — catch points only, no bowled bonus.
 */
export function parseLbwBowledBowlerName(dismissal: string): string | null {
  const raw = String(dismissal || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "not out" || lower.startsWith("retired") || lower.startsWith("absent")) return null;

  const lbw = /^lbw\s+b\s+(.+)$/i.exec(raw);
  if (lbw?.[1]) {
    const name = lbw[1].replace(/\s*\([^)]*\)\s*$/g, "").trim();
    return name || null;
  }

  // Bowled only: leading `b <bowler>` (not caught-and-bowled `c … b …`, which starts with `c`)
  if (/^b\s+/i.test(raw) && !/^c\s+/i.test(raw)) {
    const name = raw.replace(/^b\s+/i, "").replace(/\s*\([^)]*\)\s*$/g, "").trim();
    return name || null;
  }

  return null;
}

/** True only for specialist bowlers (duck/SR rules do not apply). Case-insensitive. */
export function pjIsPureBowlerRole(playerRole?: string): boolean {
  return String(playerRole || "").trim().toLowerCase() === "bowler";
}

/**
 * Map `public.players.type` / `role` to PJ scoring role. Returns null if columns are empty or unrecognized.
 */
export function pjScoringRoleFromPlayerRow(
  type: string | null | undefined,
  role: string | null | undefined
): string | null {
  const raw = `${type ?? ""} ${role ?? ""}`.trim().toLowerCase();
  if (!raw) return null;
  if (/\ball[\s-]?round/.test(raw)) return "All-Rounder";
  if (/wicket|wk\b|keeper|wicketkeeper/.test(raw)) return "WK";
  if (/\bbowler\b/.test(raw) && !/\ball[\s-]?round/.test(raw)) return "Bowler";
  if (/batsman|batter|batting/.test(raw)) return "Batter";
  return null;
}

/** Fallback when no DB row: from scorecard inference labels used in the scoreboard aggregator. */
export function pjScoringRoleFromScorecardInference(scorecardRole: string): string {
  const s = scorecardRole.trim();
  if (s === "Bowler") return "Bowler";
  if (s === "WK/Bowler") return "All-Rounder";
  if (s === "WK" || s === "All-Rounder") return s;
  if (s === "Fielder") return "Batter";
  return "Batter";
}

/** Prefer `players.type` / `players.role`; otherwise scorecard-derived role. */
export function pjResolveScoringPlayerRole(
  dbType: string | null | undefined,
  dbRole: string | null | undefined,
  scorecardRole: string
): string {
  const fromDb = pjScoringRoleFromPlayerRow(dbType, dbRole);
  if (fromDb) return fromDb;
  return pjScoringRoleFromScorecardInference(scorecardRole);
}

export interface IplFantasyFielding {
  catches: number;
  stumpings: number;
  runout_direct: number;
  runout_indirect: number;
}

export interface IplFantasyPlayerForScoring {
  batting: Partial<IplFantasyBatting>;
  bowling: Partial<IplFantasyBowling>;
  fielding: Partial<IplFantasyFielding>;
  /** +4 when player is in the announced XI (T20 chart). */
  in_announced_lineup?: boolean;
  is_playing_substitute?: boolean;
  is_captain?: boolean;
  is_vice_captain?: boolean;
  /** Used for duck (−2) and SR (skip for pure bowlers): Batter | Bowler | WK | All-Rounder */
  playerRole?: string;
}

export function iplFantasyBattingPoints(
  bat: Partial<IplFantasyBatting> | undefined,
  opts?: { isBowler?: boolean }
): { points: number; srPoints: number } {
  const runs = Number(bat?.runs ?? 0) || 0;
  const balls = Number(bat?.balls ?? 0) || 0;
  const fours = Number(bat?.fours ?? 0) || 0;
  const sixes = Number(bat?.sixes ?? 0) || 0;
  const d = String(bat?.dismissal ?? "").toLowerCase();

  const isDismissed = !["", "not out", "retired hurt"].includes(d);

  let pts = 0;
  pts += runs + fours * 4 + sixes * 6;

  if (runs >= 100) pts += 16;
  else if (runs >= 75) pts += 12;
  else if (runs >= 50) pts += 8;
  else if (runs >= 25) pts += 4;

  // Duck: −2 for Batter / WK / AR (not pure bowlers)
  if (runs === 0 && isDismissed && !opts?.isBowler) pts -= 2;

  let srPts = 0;
  if (!opts?.isBowler && balls >= 10) {
    const sr = balls > 0 ? (runs / balls) * 100 : 0;
    if (sr > 170) srPts = 6;
    else if (sr >= 150.01 && sr <= 170) srPts = 4;
    else if (sr >= 130 && sr <= 150) srPts = 2;
    else if (sr >= 60 && sr < 70) srPts = -2;
    else if (sr >= 50 && sr < 60) srPts = -4;
    else if (sr < 50) srPts = -6;
  }
  pts += srPts;

  return { points: pts, srPoints: srPts };
}

export function iplFantasyBowlingPoints(bwl: Partial<IplFantasyBowling> | undefined): { points: number; ecoPoints: number } {
  const overs = Number(bwl?.overs ?? 0) || 0;
  const maidens = Number(bwl?.maidens ?? 0) || 0;
  const runsC = Number(bwl?.runs_conceded ?? 0) || 0;
  const wickets = Number(bwl?.wickets ?? 0) || 0;
  const lbwB = Number(bwl?.lbw_bowled_wickets ?? 0) || 0;
  const dots = Number(bwl?.dot_balls ?? 0) || 0;

  let pts = 0;
  pts += dots + wickets * 30 + lbwB * 8;

  if (wickets >= 5) pts += 12;
  else if (wickets === 4) pts += 8;
  else if (wickets === 3) pts += 4;

  pts += maidens * 12;

  let ecoPts = 0;
  if (overs >= 2) {
    const eco = runsC / overs;
    if (eco < 5) ecoPts = 6;
    else if (eco <= 5.99) ecoPts = 4;
    else if (eco <= 7) ecoPts = 2;
    else if (eco < 10) ecoPts = 0;
    else if (eco <= 11) ecoPts = -2;
    else if (eco <= 12) ecoPts = -4;
    else ecoPts = -6;
    pts += ecoPts;
  }

  return { points: pts, ecoPoints: ecoPts };
}

export function iplFantasyFieldingPoints(fld: Partial<IplFantasyFielding> | undefined): number {
  const catches = Number(fld?.catches ?? 0) || 0;
  let pts = catches * 8;
  if (catches >= 3) pts += 4;
  pts += (Number(fld?.stumpings ?? 0) || 0) * 12;
  pts += (Number(fld?.runout_direct ?? 0) || 0) * 12;
  pts += (Number(fld?.runout_indirect ?? 0) || 0) * 6;
  return pts;
}

/** One row in the PJ Rules expandable breakdown (scoreboard UI). */
export type PjRulesBreakdownLine = {
  label: string;
  pts: number;
  /** Short stat text, e.g. "SR 185.2 (≥10 balls)" */
  detail?: string;
};

export type PjRulesDetailedBreakdown = {
  batting: PjRulesBreakdownLine[];
  bowling: PjRulesBreakdownLine[];
  fielding: PjRulesBreakdownLine[];
  extras: PjRulesBreakdownLine[];
};

function pjMilestoneLine(runs: number): PjRulesBreakdownLine | null {
  if (runs >= 100) return { label: "Century bonus", pts: 16, detail: "100+ runs" };
  if (runs >= 75) return { label: "75 run bonus", pts: 12, detail: "75+ runs" };
  if (runs >= 50) return { label: "Half-century bonus", pts: 8, detail: "50+ runs" };
  if (runs >= 25) return { label: "25 run bonus", pts: 4, detail: "25+ runs" };
  return null;
}

function pjEconomyLine(
  overs: number,
  runsC: number,
  ecoPts: number
): PjRulesBreakdownLine | null {
  if (overs < 2) return null;
  const eco = runsC / overs;
  let band: string;
  if (eco < 5) band = "<5 RPO";
  else if (eco <= 5.99) band = "5–5.99 RPO";
  else if (eco <= 7) band = "6–7 RPO";
  else if (eco < 10) band = "7.01–9.99 RPO (neutral)";
  else if (eco <= 11) band = "10–11 RPO";
  else if (eco <= 12) band = "11.01–12 RPO";
  else band = ">12 RPO";
  return {
    label: "Economy rate",
    pts: ecoPts,
    detail: `${eco.toFixed(2)} RPO (${band})`,
  };
}

/** Line-by-line PJ Rules breakdown for the scoreboard panel (sums match `scorePjRulesPlayer`). */
export function pjRulesDetailedBreakdown(p: IplFantasyPlayerForScoring): PjRulesDetailedBreakdown {
  const isBowler = pjIsPureBowlerRole(p.playerRole);
  const bat = p.batting ?? {};
  const bwl = p.bowling ?? {};
  const fld = p.fielding ?? {};

  const runs = Number(bat.runs ?? 0) || 0;
  const balls = Number(bat.balls ?? 0) || 0;
  const fours = Number(bat.fours ?? 0) || 0;
  const sixes = Number(bat.sixes ?? 0) || 0;
  const d = String(bat.dismissal ?? "").toLowerCase();
  const isDismissed = !["", "not out", "retired hurt"].includes(d);

  const batOut: PjRulesBreakdownLine[] = [];
  batOut.push({ label: "Runs (1 pt/run)", pts: runs, detail: `${runs} runs` });
  if (fours > 0) batOut.push({ label: "Boundary bonus (4 pt/four)", pts: fours * 4, detail: `${fours}×4` });
  if (sixes > 0) batOut.push({ label: "Six bonus (6 pt/six)", pts: sixes * 6, detail: `${sixes}×6` });

  const ms = pjMilestoneLine(runs);
  if (ms) batOut.push(ms);

  if (runs === 0 && isDismissed && !isBowler) {
    batOut.push({ label: "Duck (Batter / WK / AR)", pts: -2, detail: "Dismissed for 0" });
  }

  const batFull = iplFantasyBattingPoints(p.batting, { isBowler });
  if (!isBowler && balls >= 10) {
    const sr = balls > 0 ? (runs / balls) * 100 : 0;
    let band: string;
    if (sr > 170) band = ">170";
    else if (sr >= 150.01 && sr <= 170) band = "150.01–170";
    else if (sr >= 130 && sr <= 150) band = "130–150";
    else if (sr >= 60 && sr < 70) band = "60–70";
    else if (sr >= 50 && sr < 60) band = "50–60";
    else if (sr < 50) band = "<50";
    else band = "70.01–129.99 (neutral)";
    batOut.push({
      label: "Strike rate",
      pts: batFull.srPoints,
      detail: `SR ${sr.toFixed(1)} (${band}) · min 10 balls`,
    });
  }

  const overs = Number(bwl.overs ?? 0) || 0;
  const maidens = Number(bwl.maidens ?? 0) || 0;
  const runsC = Number(bwl.runs_conceded ?? 0) || 0;
  const wickets = Number(bwl.wickets ?? 0) || 0;
  const lbwB = Number(bwl.lbw_bowled_wickets ?? 0) || 0;
  const dots = Number(bwl.dot_balls ?? 0) || 0;

  const bwFull = iplFantasyBowlingPoints(p.bowling);

  const bowlOut: PjRulesBreakdownLine[] = [];
  if (dots > 0) bowlOut.push({ label: "Dot balls (1 pt/dot)", pts: dots, detail: `${dots} dots` });
  if (wickets > 0) bowlOut.push({ label: "Wickets (30 pt each, excl. run-out)", pts: wickets * 30, detail: `${wickets}×30` });
  if (lbwB > 0) bowlOut.push({ label: "LBW / bowled bonus", pts: lbwB * 8, detail: `${lbwB}×8` });
  if (wickets >= 5) bowlOut.push({ label: "5-wicket bonus", pts: 12, detail: "5+ wickets" });
  else if (wickets === 4) bowlOut.push({ label: "4-wicket bonus", pts: 8 });
  else if (wickets === 3) bowlOut.push({ label: "3-wicket bonus", pts: 4 });
  if (maidens > 0) bowlOut.push({ label: "Maiden overs (12 pt each)", pts: maidens * 12, detail: `${maidens} maidens` });

  const ecoLine = pjEconomyLine(overs, runsC, bwFull.ecoPoints);
  if (ecoLine) bowlOut.push(ecoLine);

  const catches = Number(fld.catches ?? 0) || 0;
  const stumpings = Number(fld.stumpings ?? 0) || 0;
  const roD = Number(fld.runout_direct ?? 0) || 0;
  const roI = Number(fld.runout_indirect ?? 0) || 0;

  const fieldOut: PjRulesBreakdownLine[] = [];
  if (catches > 0) fieldOut.push({ label: "Catches (8 pt each)", pts: catches * 8, detail: `${catches}×8` });
  if (catches >= 3) fieldOut.push({ label: "3-catch bonus", pts: 4 });
  if (stumpings > 0) fieldOut.push({ label: "Stumpings (12 pt each)", pts: stumpings * 12, detail: `${stumpings}×12` });
  if (roD > 0) fieldOut.push({ label: "Run out — direct hit (12 pt each)", pts: roD * 12, detail: `${roD}×12` });
  if (roI > 0) fieldOut.push({ label: "Run out — not direct (6 pt each)", pts: roI * 6, detail: `${roI}×6` });

  const extras: PjRulesBreakdownLine[] = [];
  if (p.in_announced_lineup) extras.push({ label: "Announced playing XI", pts: 4, detail: "Entry bonus" });
  if (p.is_playing_substitute) extras.push({ label: "Playing substitute", pts: 4, detail: "If applicable" });

  return { batting: batOut, bowling: bowlOut, fielding: fieldOut, extras };
}

/**
 * Bonus multiplier: applies to **total** base fantasy points for that player for that match.
 * Run-based and wicket-based tiers are evaluated separately; the **higher** multiplier is applied.
 */
export type D11BonusMultiplierInfo = {
  runMultiplier: number;
  wicketMultiplier: number;
  appliedMultiplier: number;
  /** Which side supplies the max multiplier (ties when both equal and &gt; 1×). */
  appliedSource: "runs" | "wickets" | "both" | "none";
  runTierLabel: string;
  wicketTierLabel: string;
};

export function d11BonusMultiplierInfo(runs: number, wickets: number): D11BonusMultiplierInfo {
  const r = Math.max(0, Math.floor(Number(runs) || 0));
  const w = Math.max(0, Math.floor(Number(wickets) || 0));

  let runMultiplier = 1;
  let runTierLabel = "Under 25 runs (1×)";
  if (r >= 150) {
    runMultiplier = 4;
    runTierLabel = "150+ runs (4×)";
  } else if (r >= 100) {
    runMultiplier = 3;
    runTierLabel = "100–149 runs (3×)";
  } else if (r >= 75) {
    runMultiplier = 1.75;
    runTierLabel = "75–99 runs (1.75×)";
  } else if (r >= 45) {
    runMultiplier = 1.5;
    runTierLabel = "45–74 runs (1.5×)";
  } else if (r >= 25) {
    runMultiplier = 1.25;
    runTierLabel = "25–44 runs (1.25×)";
  }

  let wicketMultiplier = 1;
  let wicketTierLabel = "0–1 wickets (1×)";
  if (w >= 5) {
    wicketMultiplier = 4;
    wicketTierLabel = "5+ wickets (4×)";
  } else if (w >= 3) {
    wicketMultiplier = 2;
    wicketTierLabel = "3–4 wickets (2×)";
  } else if (w === 2) {
    wicketMultiplier = 1.5;
    wicketTierLabel = "2 wickets (1.5×)";
  }

  const appliedMultiplier = Math.max(runMultiplier, wicketMultiplier);

  let appliedSource: D11BonusMultiplierInfo["appliedSource"];
  if (appliedMultiplier <= 1) {
    appliedSource = "none";
  } else if (runMultiplier === wicketMultiplier && runMultiplier > 1) {
    appliedSource = "both";
  } else if (runMultiplier > wicketMultiplier) {
    appliedSource = "runs";
  } else {
    appliedSource = "wickets";
  }

  return {
    runMultiplier,
    wicketMultiplier,
    appliedMultiplier,
    appliedSource,
    runTierLabel,
    wicketTierLabel,
  };
}

/** Total points after bonus multiplier (does not alter base calculation). */
export function d11PointsAfterMultiplier(basePoints: number, appliedMultiplier: number): number {
  return Math.round(Number(basePoints) * appliedMultiplier * 100) / 100;
}

// PJ Rules — T20 fantasy charts (batting / bowling / fielding / economy / SR) + announced XI +4; no cap multipliers for now.
export function scorePjRulesPlayer(p: IplFantasyPlayerForScoring) {
  const isBowler = pjIsPureBowlerRole(p.playerRole);
  const bat = iplFantasyBattingPoints(p.batting, { isBowler });
  const bw = iplFantasyBowlingPoints(p.bowling);
  const f = iplFantasyFieldingPoints(p.fielding);

  let extra = p.in_announced_lineup ? 4 : 0;
  if (p.is_playing_substitute) extra += 4;

  const base = bat.points + bw.points + f + extra;
  const total = Math.round(base * 100) / 100;

  return {
    batting_pts: bat.points,
    bowling_pts: bw.points,
    fielding_pts: f,
    extra_pts: extra,
    sr_pts: bat.srPoints,
    eco_pts: bw.ecoPoints,
    multiplier: 1,
    total_pts: total,
  };
}

// ============================================================================
// My11Circle (rules per screenshots)
// ============================================================================

export function my11CircleBattingPoints(bat: Partial<IplFantasyBatting> | undefined): { points: number; srPoints: number } {
  const runs = Number(bat?.runs ?? 0) || 0;
  const balls = Number(bat?.balls ?? 0) || 0;
  const fours = Number(bat?.fours ?? 0) || 0;
  const sixes = Number(bat?.sixes ?? 0) || 0;
  const d = String(bat?.dismissal ?? "").toLowerCase();

  const isDismissed = !["", "not out", "retired hurt"].includes(d);

  let pts = 0;
  pts += runs + fours * 4 + sixes * 6;

  if (runs >= 100) pts += 16;
  else if (runs >= 75) pts += 12;
  else if (runs >= 50) pts += 8;
  else if (runs >= 25) pts += 4;

  if (runs === 0 && isDismissed) pts -= 2; // excluding bowlers is handled at callsite if needed

  let srPts = 0;
  // Screenshot: "Minimum 20 runs OR 10 balls"
  if (runs >= 20 || balls >= 10) {
    const sr = balls > 0 ? (runs / balls) * 100 : 0;
    if (sr >= 170) srPts = 6;
    else if (sr >= 150) srPts = 4;
    else if (sr >= 130) srPts = 2;
    else if (sr < 50) srPts = -6;
    else if (sr < 60) srPts = -4;
    else if (sr < 70) srPts = -2;
  }
  pts += srPts;

  return { points: pts, srPoints: srPts };
}

export function my11CircleBowlingPoints(bwl: Partial<IplFantasyBowling> | undefined): { points: number; ecoPoints: number } {
  const overs = Number(bwl?.overs ?? 0) || 0;
  const maidens = Number(bwl?.maidens ?? 0) || 0;
  const runsC = Number(bwl?.runs_conceded ?? 0) || 0;
  const wickets = Number(bwl?.wickets ?? 0) || 0;
  const lbwB = Number(bwl?.lbw_bowled_wickets ?? 0) || 0;
  const dots = Number(bwl?.dot_balls ?? 0) || 0;

  let pts = 0;
  pts += dots + wickets * 30 + lbwB * 8 + maidens * 12;

  if (wickets >= 5) pts += 12;
  else if (wickets === 4) pts += 8;
  else if (wickets === 3) pts += 4;

  let ecoPts = 0;
  // Screenshot: min 2 overs
  if (overs >= 2) {
    const eco = runsC / overs;
    if (eco < 5) ecoPts = 6;
    else if (eco <= 5.99) ecoPts = 4;
    else if (eco <= 6.99) ecoPts = 2;
    else if (eco <= 9.99) ecoPts = 0;
    else if (eco <= 10.99) ecoPts = -2;
    else if (eco <= 11.99) ecoPts = -4;
    else ecoPts = -6;
  }
  pts += ecoPts;

  return { points: pts, ecoPoints: ecoPts };
}

export function my11CircleFieldingPoints(fld: Partial<IplFantasyFielding> | undefined): number {
  const catches = Number(fld?.catches ?? 0) || 0;
  let pts = catches * 8;
  if (catches >= 3) pts += 4;
  pts += (Number(fld?.stumpings ?? 0) || 0) * 12;
  pts += (Number(fld?.runout_direct ?? 0) || 0) * 12;
  pts += (Number(fld?.runout_indirect ?? 0) || 0) * 6;
  return pts;
}

export function scoreMy11CirclePlayer(p: IplFantasyPlayerForScoring, opts?: { excludeDuckForBowlers?: boolean; isBowler?: boolean }) {
  const batting = my11CircleBattingPoints(p.batting);
  let battingPts = batting.points;
  if (opts?.excludeDuckForBowlers && opts?.isBowler) {
    // Undo duck penalty if applied for bowlers (screenshot: duck excluding bowlers)
    const runs = Number(p.batting?.runs ?? 0) || 0;
    const d = String(p.batting?.dismissal ?? "").toLowerCase();
    const isDismissed = !["", "not out", "retired hurt"].includes(d);
    if (runs === 0 && isDismissed) battingPts += 2;
  }

  const bowling = my11CircleBowlingPoints(p.bowling);
  const fieldingPts = my11CircleFieldingPoints(p.fielding);

  const extra = p.in_announced_lineup ? 4 : 0; // user explicitly: Playing 11 Bonus 4
  const total = battingPts + bowling.points + fieldingPts + extra;

  return {
    batting_pts: battingPts,
    bowling_pts: bowling.points,
    fielding_pts: fieldingPts,
    extra_pts: extra,
    sr_pts: batting.srPoints,
    eco_pts: bowling.ecoPoints,
    total_pts: total,
  };
}

// ============================================================================
// IPL Fantasy (rules per screenshots)
// ============================================================================

export function iplFantasyAppBattingPoints(
  bat: Partial<IplFantasyBatting> | undefined,
  opts?: { excludeDuckForBowlers?: boolean; isBowler?: boolean }
): { points: number; srPoints: number } {
  const runs = Number(bat?.runs ?? 0) || 0;
  const balls = Number(bat?.balls ?? 0) || 0;
  const fours = Number(bat?.fours ?? 0) || 0;
  const sixes = Number(bat?.sixes ?? 0) || 0;
  const d = String(bat?.dismissal ?? "").toLowerCase();

  const isDismissed = !["", "not out", "retired hurt"].includes(d);

  let pts = 0;

  // Batting base
  pts += runs * 1;
  pts += fours * 1; // Every Four Bonus = 1
  pts += sixes * 2; // Every Six Bonus = 2

  // Milestones:
  // - 30 runs bonus: +4
  // - Half century: +8
  // - Century: +16 (and does NOT also get half-century bonus)
  if (runs >= 100) pts += 16;
  else if (runs >= 50) pts += 8;
  else if (runs >= 30) pts += 4;

  // Duck: -2 (excluding bowlers)
  if (runs === 0 && isDismissed) {
    const exclude = !!opts?.excludeDuckForBowlers && !!opts?.isBowler;
    if (!exclude) pts -= 2;
  }

  // Strike rate (except bowlers): min 10 balls OR 20 runs
  let srPts = 0;
  if (runs >= 20 || balls >= 10) {
    const sr = balls > 0 ? (runs / balls) * 100 : 0;
    if (sr >= 170) srPts = 6;
    else if (sr >= 150) srPts = 4;
    else if (sr >= 130) srPts = 2;
    else if (sr < 50) srPts = -6;
    else if (sr < 60) srPts = -4;
    else if (sr < 70) srPts = -2;
  }
  pts += srPts;

  return { points: pts, srPoints: srPts };
}

export function iplFantasyAppBowlingPoints(bwl: Partial<IplFantasyBowling> | undefined): { points: number; ecoPoints: number } {
  const overs = Number(bwl?.overs ?? 0) || 0;
  const maidens = Number(bwl?.maidens ?? 0) || 0;
  const runsC = Number(bwl?.runs_conceded ?? 0) || 0;
  const wickets = Number(bwl?.wickets ?? 0) || 0;
  const lbwB = Number(bwl?.lbw_bowled_wickets ?? 0) || 0;

  let pts = 0;
  pts += wickets * 25; // Wicket (except run-out) = 25
  pts += maidens * 12; // Maiden over bonus = 12
  pts += lbwB * 8; // LBW/Bowled bonus = 8

  // Wicket haul bonuses
  if (wickets >= 5) pts += 16;
  else if (wickets === 4) pts += 8;
  else if (wickets === 3) pts += 4;

  // Economy rate: min 2 overs
  let ecoPts = 0;
  if (overs >= 2) {
    const eco = runsC / overs;
    if (eco < 5) ecoPts = 6;
    else if (eco <= 5.99) ecoPts = 4;
    else if (eco <= 6.99) ecoPts = 2;
    else if (eco <= 9.99) ecoPts = 0;
    else if (eco <= 10.99) ecoPts = -2;
    else if (eco <= 11.99) ecoPts = -4;
    else ecoPts = -6;
  }
  pts += ecoPts;

  return { points: pts, ecoPoints: ecoPts };
}

export function scoreIplFantasyPlayer(
  p: IplFantasyPlayerForScoring,
  opts?: { excludeDuckForBowlers?: boolean; isBowler?: boolean; applyStrikeRateForBowlers?: boolean }
) {
  const batting = iplFantasyAppBattingPoints(p.batting, { excludeDuckForBowlers: opts?.excludeDuckForBowlers, isBowler: opts?.isBowler });
  const bowling = iplFantasyAppBowlingPoints(p.bowling);
  const fieldingPts = my11CircleFieldingPoints(p.fielding); // identical per screenshots

  // If the player is a bowler and we should exclude SR penalties/bonuses (except bowlers), remove SR part.
  let battingPts = batting.points;
  if (opts?.isBowler && opts?.applyStrikeRateForBowlers === false) {
    battingPts -= batting.srPoints;
  }

  const extra = p.in_announced_lineup ? 4 : 0; // Playing 11 bonus = 4
  const total = battingPts + bowling.points + fieldingPts + extra;

  return {
    batting_pts: battingPts,
    bowling_pts: bowling.points,
    fielding_pts: fieldingPts,
    extra_pts: extra,
    sr_pts: opts?.isBowler && opts?.applyStrikeRateForBowlers === false ? 0 : batting.srPoints,
    eco_pts: bowling.ecoPoints,
    total_pts: total,
  };
}
