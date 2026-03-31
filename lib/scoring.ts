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

  // 4. Efficiency Points (Economy Rate - Min 2 Overs)
  if (stats.oversMoved && stats.oversMoved >= 2 && stats.economyRate !== undefined) {
    if (stats.economyRate < 5) points += 6;
    else if (stats.economyRate < 6) points += 4;
    else if (stats.economyRate < 7) points += 2;
    else if (stats.economyRate >= 12) points -= 6;
    else if (stats.economyRate >= 11) points -= 4;
    else if (stats.economyRate >= 10) points -= 2;
  }

  // 5. Strike Rate Points (Except Bowler - Min 10 Balls faced OR 20 runs scored)
  if ((stats.balls >= 10 || stats.runs >= 20) && stats.strikeRate !== undefined && stats.role !== 'Bowler') {
    if (stats.strikeRate >= 170) points += 6;
    else if (stats.strikeRate >= 150) points += 4;
    else if (stats.strikeRate >= 130) points += 2;
    else if (stats.strikeRate < 50) points -= 6;
    else if (stats.strikeRate < 60) points -= 4;
    else if (stats.strikeRate < 70) points -= 2;
  }
  
  // 6. Others
  if (stats.isAnnounced) points += 4; // +4 for playing 11
  
  // 7. Multipliers (Custom Rules)
  let multiplier = 1.0;
  
  // Batting Multiplier
  if (stats.runs >= 150) multiplier = Math.max(multiplier, 4.0);
  else if (stats.runs >= 100) multiplier = Math.max(multiplier, 3.0);
  else if (stats.runs >= 75) multiplier = Math.max(multiplier, 1.75);
  else if (stats.runs >= 45) multiplier = Math.max(multiplier, 1.5);
  else if (stats.runs >= 25) multiplier = Math.max(multiplier, 1.25);
  
  // Bowling Multiplier
  if (stats.wickets >= 5) multiplier = Math.max(multiplier, 4.0);
  else if (stats.wickets >= 3) multiplier = Math.max(multiplier, 2.0);
  else if (stats.wickets === 2) multiplier = Math.max(multiplier, 1.5);
  
  return points * multiplier;
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
  in_announced_lineup?: boolean;
  is_playing_substitute?: boolean;
  is_captain?: boolean;
  is_vice_captain?: boolean;
}

export function iplFantasyBattingPoints(bat: Partial<IplFantasyBatting> | undefined): number {
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

  if (runs === 0 && isDismissed) pts -= 2;

  if (balls >= 10 && isDismissed) {
    const sr = (runs / balls) * 100;
    if (sr > 170) pts += 6;
    else if (sr >= 150.01) pts += 4;
    else if (sr >= 130) pts += 2;
    else if (sr >= 60 && sr < 70) pts -= 2;
    else if (sr >= 50 && sr < 60) pts -= 4;
    else if (sr < 50) pts -= 6;
  }

  return pts;
}

export function iplFantasyBowlingPoints(bwl: Partial<IplFantasyBowling> | undefined): number {
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

  if (overs >= 2) {
    const eco = runsC / overs;
    if (eco < 5) pts += 6;
    else if (eco <= 5.99) pts += 4;
    else if (eco <= 7) pts += 2;
    else if (eco <= 9) {
      // pass
    } else if (eco <= 11) pts -= 2;
    else if (eco <= 12) pts -= 4;
    else pts -= 6;
  }

  return pts;
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

export function scoreIplFantasyPlayer(p: IplFantasyPlayerForScoring) {
  const b = iplFantasyBattingPoints(p.batting);
  const bw = iplFantasyBowlingPoints(p.bowling);
  const f = iplFantasyFieldingPoints(p.fielding);

  let extra = p.in_announced_lineup ? 4 : 0;
  if (p.is_playing_substitute) extra += 4;

  const base = b + bw + f + extra;
  const mult = p.is_captain ? 2.0 : p.is_vice_captain ? 1.5 : 1.0;
  const total = Math.round(base * mult * 100) / 100;

  return { batting_pts: b, bowling_pts: bw, fielding_pts: f, extra_pts: extra, multiplier: mult, total_pts: total };
}
