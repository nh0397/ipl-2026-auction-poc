/**
 * ## How scorecard data becomes `public.match_points`
 *
 * 1. **Source**: `fixtures_cricapi.scorecard` — CricAPI match scorecard JSON.
 * 2. **Engine**: Per-player fantasy stats → **base points** (runs, wickets, fielding, etc., before any big-score multiplier).
 * 3. **Performance multipliers**: Exceptional innings (e.g. high runs or wicket hauls) apply a **multiplier** on that base.
 * 4. **Stored columns**:
 *    - `base_points` = points **before** that multiplier
 *    - `points` = **base points × multipliers** (what we sync from the scorecard)
 *
 * **Franchise layer** (sheet only): Icon 2× or Captain / Vice on top of `points` — not written back into `match_points`.
 *
 * Manual sheet edits save `points` (and `manual_override`); the UI shows franchise totals and breakdown lines.
 */

export const MATCH_POINTS_PIPELINE_VERSION = 2;
