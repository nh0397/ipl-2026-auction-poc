/**
 * ## How scorecard data becomes stored fantasy points
 *
 * Two **separate** tables (do not mix writes):
 *
 * 1. **`public.match_points`** — CricAPI / `fixtures_cricapi.scorecard` + `run_ipl_day.py` / TS sync when `USE_CRICAPI_MATCH_POINTS_SYNC`.
 * 2. **`public.match_points_espn`** — ESPN scraper / `fixtures.scorecard` + `syncMatchPointsFromEspnFixtures` (always on Sync).
 *
 * Per row: **base_points** (PJ before haul) and **points** (base × max(batting haul, bowling haul)).
 *
 * **Franchise layer** (sheet only): Icon 2× or Captain / Vice on top of stored `points` — not written back into either table.
 *
 * The scoreboard **Sheets** tab reads **`SHEET_MATCH_POINTS_TABLE`** in `lib/featureFlags.ts` (`match_points_espn` vs `match_points`).
 */

export const MATCH_POINTS_PIPELINE_VERSION = 3;
