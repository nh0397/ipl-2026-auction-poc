import { MATCH_POINTS_ESPN_TABLE, type MatchPointsTableName } from "@/lib/matchPointsTables";

/** Set true when CricAPI is reliable again — shows fixture “CricAPI” modals (DB-backed scorecard). */
export const SHOW_CRICAPI_FIXTURE_UI = false;

/**
 * When true, POST /api/match-points/sync also runs CricAPI → `match_points`.
 * ESPN sync always writes to `match_points_espn` only (never `match_points`).
 */
export const USE_CRICAPI_MATCH_POINTS_SYNC = false;

/**
 * Which table the scoreboard **Sheets** tab loads/saves after Sync.
 * Default: ESPN table. To use CricAPI rows instead: import `MATCH_POINTS_CRICAPI_TABLE` from `./matchPointsTables` and assign it here.
 */
export const SHEET_MATCH_POINTS_TABLE: MatchPointsTableName = MATCH_POINTS_ESPN_TABLE;

/**
 * When true, any row with `manual_override = true` is treated as a "final sheet total" override:
 * the entered value is displayed as-is and no sheet auto-compute (Icon/C/VC/booster) is applied.
 */
export const DISABLE_SHEET_AUTOCOMPUTE_ON_MANUAL_OVERRIDE = true;
