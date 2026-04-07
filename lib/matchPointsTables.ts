/** CricAPI + `run_ipl_day.py` — persisted points from `fixtures_cricapi` scorecards. */
export const MATCH_POINTS_CRICAPI_TABLE = "match_points" as const;

/** ESPN scraper — persisted points from `fixtures.scorecard` (same PJ + haul rules). */
export const MATCH_POINTS_ESPN_TABLE = "match_points_espn" as const;

export type MatchPointsTableName = typeof MATCH_POINTS_CRICAPI_TABLE | typeof MATCH_POINTS_ESPN_TABLE;
