type CricApiScorecard = any;

function parseTeamFromInningLabel(label: string | null | undefined): string {
  const s = (label || "").trim();
  if (!s) return "Unknown";
  // Example: "Sunrisers Hyderabad Inning 1"
  return s.replace(/\s+Inning\s+\d+$/i, "").replace(/\s+Inning$/i, "").trim() || s;
}

/**
 * Convert CricAPI `match_scorecard` payload to the format expected by `ScorecardViewer`.
 *
 * `ScorecardViewer` expects:
 * { match_info: any, innings: [{ team, batting[], bowling[], extras, total, fall_of_wickets }] }
 */
export function adaptCricApiToScorecardViewer(scorecard: CricApiScorecard) {
  // Idempotency: if the DB already contains an adapted scorecard,
  // don't try to adapt it again (would produce empty innings).
  if (scorecard?.innings && Array.isArray(scorecard.innings)) {
    return scorecard;
  }

  const innings = ((scorecard?.scorecard || []) as any[]).map((inn) => {
    const team = parseTeamFromInningLabel(inn?.inning);

    const batting = ((inn?.batting || []) as any[]).map((b) => ({
      player: b?.player || b?.batsman?.name || "",
      dismissal: b?.dismissal_text || b?.["dismissal-text"] || b?.dismissal || "not out",
      R: b?.R ?? b?.r ?? "",
      B: b?.B ?? b?.b ?? "",
      M: b?.M ?? "",
      "4s": b?.["4s"] ?? b?.fours ?? "",
      "6s": b?.["6s"] ?? b?.sixes ?? "",
      SR: b?.SR ?? b?.sr ?? "",
    }));

    const bowling = ((inn?.bowling || []) as any[]).map((bw) => ({
      bowler: bw?.bowler?.name || bw?.bowler || "",
      O: bw?.O ?? bw?.o ?? "",
      M: bw?.M ?? bw?.m ?? "",
      R: bw?.R ?? bw?.r ?? "",
      W: bw?.W ?? bw?.w ?? "",
      ECON: bw?.ECON ?? bw?.eco ?? "",
      "0s": bw?.["0s"] ?? bw?.dots ?? 0,
      WD: bw?.WD ?? bw?.wd ?? 0,
      NB: bw?.NB ?? bw?.nb ?? 0,
    }));

    const extrasTotal = Number(inn?.extras?.r ?? inn?.extras?.total ?? 0) || 0;
    const extrasText = inn?.extras
      ? Object.entries(inn.extras)
          .filter(([k, v]) => k !== "r" && v)
          .map(([k, v]) => `${k.toUpperCase()} ${v}`)
          .join(", ")
      : "";

    const totalRuns = inn?.totals?.r ?? "";
    const totalWkts = inn?.totals?.w ?? "";
    const totalOvers = inn?.totals?.o ?? "";
    const totalScore = totalRuns !== "" && totalWkts !== "" ? `${totalRuns}/${totalWkts}` : "";

    return {
      team,
      batting,
      bowling,
      extras: { text: extrasText, total: extrasTotal },
      total: { score: totalScore, overs: String(totalOvers ?? ""), run_rate: "" },
      fall_of_wickets: [],
      yet_to_bat: [],
    };
  });

  return {
    match_info: {
      title: scorecard?.name || scorecard?.match_info?.title || "",
      status: scorecard?.status || scorecard?.match_info?.status || "",
      teams: scorecard?.teams || scorecard?.match_info?.teams,
      matchWinner: scorecard?.matchWinner,
    },
    innings,
  };
}

