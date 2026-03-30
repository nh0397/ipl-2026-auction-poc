export interface MatchStats {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  maidens: number;
  dotBalls: number;
  economyRate?: number;
  lbwBowled: number;
  catches: number;
  stumpings: number;
  runOutDirect: number;
  runOutIndirect: number;
  oversMoved: number;
  isAnnounced: boolean;
  strikeRate?: number;
  isDuck: boolean;
  role: string;
}

export interface ScoringBreakdown {
  total: number;
  multiplier: number;
  categories: {
    batting: { total: number; details: string[] };
    bowling: { total: number; details: string[] };
    fielding: { total: number; details: string[] };
    others: { total: number; details: string[] };
  };
}

export const calculateDetailedPoints = (
  stats: MatchStats,
  multiplier: number = 1.0
): ScoringBreakdown => {
  let battingTotal = 0;
  const battingDetails: string[] = [];

  let bowlingTotal = 0;
  const bowlingDetails: string[] = [];

  let fieldingTotal = 0;
  const fieldingDetails: string[] = [];

  let othersTotal = 0;
  const othersDetails: string[] = [];

  // 1. OTHERS (Announced Logic)
  if (stats.isAnnounced) {
    othersTotal += 4;
    othersDetails.push("Playing XI (+4.0)");
  }

  // 2. BATTING (IPL Fantasy Rules)
  if (stats.runs > 0) {
    battingTotal += stats.runs;
    battingDetails.push(`${stats.runs} Runs (+${stats.runs.toFixed(1)})`);
  }

  if (stats.fours > 0) {
    battingTotal += stats.fours * 1;
    battingDetails.push(`${stats.fours} Fours (+${(stats.fours * 1).toFixed(1)})`);
  }
  if (stats.sixes > 0) {
    battingTotal += stats.sixes * 2;
    battingDetails.push(`${stats.sixes} Sixes (+${(stats.sixes * 2).toFixed(1)})`);
  }

  if (stats.runs >= 100) {
    battingTotal += 16;
    battingDetails.push("Century Bonus (+16.0)");
  } else if (stats.runs >= 50) {
    battingTotal += 8;
    battingDetails.push("Half-Century Bonus (+8.0)");
  }
  
  if (stats.runs >= 30) {
    battingTotal += 4;
    battingDetails.push("30-Runs Bonus (+4.0)");
  }

  if (stats.isDuck && stats.role !== 'Bowler') {
    battingTotal -= 2;
    battingDetails.push("Duck Penalty (-2.0)");
  }

  // Strike Rate (Excluding Bowlers) - Min 10 balls or 20 runs
  if (stats.role !== 'Bowler' && (stats.balls >= 10 || stats.runs >= 20)) {
    const sr = (stats.runs / (stats.balls || 1)) * 100;
    let srPoints = 0;
    if (sr >= 170) srPoints = 6;
    else if (sr >= 150) srPoints = 4;
    else if (sr >= 130) srPoints = 2;
    else if (sr < 50) srPoints = -6;
    else if (sr < 60) srPoints = -4;
    else if (sr < 70) srPoints = -2;

    if (srPoints !== 0) {
      battingTotal += srPoints;
      battingDetails.push(`SR ${srPoints > 0 ? 'Bonus' : 'Penalty'} (${sr.toFixed(1)}) (${srPoints > 0 ? '+' : ''}${srPoints.toFixed(1)})`);
    }
  }

  // 3. BOWLING (IPL Fantasy Rules)
  if (stats.wickets > 0) {
    const wPoints = stats.wickets * 25;
    bowlingTotal += wPoints;
    bowlingDetails.push(`${stats.wickets} Wicket(s) (+${wPoints.toFixed(1)})`);
    
    // Hauls
    if (stats.wickets >= 5) {
      bowlingTotal += 16;
      bowlingDetails.push("5-Wicket Haul (+16.0)");
    } else if (stats.wickets >= 4) {
      bowlingTotal += 8;
      bowlingDetails.push("4-Wicket Haul (+8.0)");
    } else if (stats.wickets >= 3) {
      bowlingTotal += 4;
      bowlingDetails.push("3-Wicket Haul (+4.0)");
    }
  }

  if (stats.lbwBowled > 0) {
    const bonus = stats.lbwBowled * 8;
    bowlingTotal += bonus;
    bowlingDetails.push(`LBW/Bowled Bonus (+${bonus.toFixed(1)})`);
  }

  if (stats.maidens > 0) {
    const mPoints = stats.maidens * 12;
    bowlingTotal += mPoints;
    bowlingDetails.push(`${stats.maidens} Maiden(s) (+${mPoints.toFixed(1)})`);
  }

  // Economy Rate - Min 2 overs
  if (stats.oversMoved >= 2) {
    const eco = stats.economyRate !== undefined ? stats.economyRate : 0;
    let ecoPoints = 0;
    if (eco < 5) ecoPoints = 6;
    else if (eco < 6) ecoPoints = 4;
    else if (eco < 7) ecoPoints = 2;
    else if (eco >= 12) ecoPoints = -6;
    else if (eco >= 11) ecoPoints = -4;
    else if (eco >= 10) ecoPoints = -2;

    if (ecoPoints !== 0) {
      bowlingTotal += ecoPoints;
      bowlingDetails.push(`Eco ${ecoPoints > 0 ? 'Bonus' : 'Penalty'} (${eco.toFixed(1)}) (${ecoPoints > 0 ? '+' : ''}${ecoPoints.toFixed(1)})`);
    }
  }

  // 4. FIELDING (IPL Fantasy Rules)
  if (stats.catches > 0) {
    const cPoints = stats.catches * 8;
    fieldingTotal += cPoints;
    fieldingDetails.push(`${stats.catches} Catch(es) (+${cPoints.toFixed(1)})`);
    
    if (stats.catches >= 3) {
      fieldingTotal += 4;
      fieldingDetails.push("3-Catch Bonus (+4.0)");
    }
  }

  if (stats.stumpings > 0) {
    const sPoints = stats.stumpings * 12;
    fieldingTotal += sPoints;
    fieldingDetails.push(`${stats.stumpings} Stumping(s) (+${sPoints.toFixed(1)})`);
  }

  if (stats.runOutDirect > 0) {
    const roPoints = stats.runOutDirect * 12;
    fieldingTotal += roPoints;
    fieldingDetails.push(`${stats.runOutDirect} Direct Run-out (+${roPoints.toFixed(1)})`);
  }

  if (stats.runOutIndirect > 0) {
    const roiPoints = stats.runOutIndirect * 6;
    fieldingTotal += roiPoints;
    fieldingDetails.push(`${stats.runOutIndirect} Indirect Run-out (+${roiPoints.toFixed(1)})`);
  }

  const finalScore = (othersTotal + battingTotal + bowlingTotal + fieldingTotal) * multiplier;

  return {
    total: finalScore,
    multiplier,
    categories: {
      batting: { total: battingTotal, details: battingDetails },
      bowling: { total: bowlingTotal, details: bowlingDetails },
      fielding: { total: fieldingTotal, details: fieldingDetails },
      others: { total: othersTotal, details: othersDetails }
    }
  };
};

export const calculateDream11Points = (stats: MatchStats): number => {
  return calculateDetailedPoints(stats).total;
};
