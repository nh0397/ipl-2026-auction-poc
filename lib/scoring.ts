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
