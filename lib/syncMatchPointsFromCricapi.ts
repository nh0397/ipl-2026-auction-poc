import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateFantasyRowsFromCricApiMatchData } from "@/lib/cricapiFantasyAggregate";

/** Match `scripts/cricapi_match_points.py` / `ipl_fantasy` name lookup — CricAPI player IDs are not `public.players.id`. */
function normPlayerName(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Scorecard label (normalized) → try these DB `player_name` normalizations in order.
 * CricAPI/ESPN spelling often differs from auction DB (Phil vs Philip, Chakaravarthy vs Chakravarthy).
 */
const SCORECARD_NAME_FALLBACKS: Record<string, readonly string[]> = {
  "philip salt": ["phil salt"],
  "varun chakaravarthy": ["varun chakravarthy"],
  "digvesh singh rathi": ["digvesh rathi"],
};

function lookupDbPlayerId(scorecardPlayerName: string, nameToDbPlayerId: Map<string, string>): string | undefined {
  const n = normPlayerName(scorecardPlayerName);
  const direct = nameToDbPlayerId.get(n);
  if (direct) return direct;
  const fallbacks = SCORECARD_NAME_FALLBACKS[n];
  if (fallbacks) {
    for (const fb of fallbacks) {
      const id = nameToDbPlayerId.get(fb);
      if (id) return id;
    }
  }
  return undefined;
}

/** Normalize DB `fixtures_cricapi.scorecard` to the shape expected by `aggregateFantasyRowsFromCricApiMatchData` (CricAPI `data` object). */
function toMatchScorecardData(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  let o: unknown = raw;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object") return null;
  const rec = o as Record<string, unknown>;
  if (Array.isArray(rec.scorecard) || (rec.data && typeof rec.data === "object")) {
    const inner = rec.data as Record<string, unknown> | undefined;
    if (inner && (Array.isArray(inner.scorecard) || inner.teamInfo)) return inner as Record<string, unknown>;
  }
  if (Array.isArray(rec.scorecard) || rec.teamInfo) return rec;
  return null;
}

/**
 * Upsert `match_points` from stored CricAPI scorecards: `points` = base × performance multipliers,
 * `base_points` = before those multipliers. Skips manual_override rows and fixtures without `match_no`.
 */
export async function syncMatchPointsFromStoredScorecards(admin: SupabaseClient): Promise<{
  fixturesProcessed: number;
  rowsUpserted: number;
  rowsSkippedManual: number;
  rowsSkippedUnmapped: number;
  unmappedNameSample: string[];
  errors: string[];
}> {
  const errors: string[] = [];

  const { data: playerRows, error: playersErr } = await admin.from("players").select("id, player_name");
  if (playersErr) {
    errors.push(`players: ${playersErr.message}`);
    return { fixturesProcessed: 0, rowsUpserted: 0, rowsSkippedManual: 0, rowsSkippedUnmapped: 0, unmappedNameSample: [], errors };
  }
  const nameToDbPlayerId = new Map<string, string>();
  for (const pr of playerRows ?? []) {
    const nm = normPlayerName(String(pr.player_name ?? ""));
    if (nm) nameToDbPlayerId.set(nm, String(pr.id));
  }

  let includeHaulColumns = true;
  const { error: haulColProbeErr } = await admin.from("match_points").select("haul_applied_mult").limit(1);
  if (haulColProbeErr) {
    if (/haul_applied|schema cache|could not find.*column/i.test(String(haulColProbeErr.message))) {
      includeHaulColumns = false;
      errors.push(
        "match_points is missing haul_* columns — run SQL migration 20260403240000_match_points_haul_mults.sql in Supabase, then sync again for haul tier breakdown. Syncing points + base_points only for now."
      );
    } else {
      errors.push(`match_points column probe: ${haulColProbeErr.message}`);
    }
  }

  const { data: lockedRows, error: lockErr } = await admin
    .from("match_points")
    .select("player_id, match_id")
    .eq("manual_override", true);
  if (lockErr) {
    errors.push(`manual_override query: ${lockErr.message}`);
    return { fixturesProcessed: 0, rowsUpserted: 0, rowsSkippedManual: 0, rowsSkippedUnmapped: 0, unmappedNameSample: [], errors };
  }
  const manualLocked = new Set((lockedRows ?? []).map((r) => `${r.player_id}_${r.match_id}`));
  const { data: fixtures, error: fxErr } = await admin
    .from("fixtures_cricapi")
    .select("id, match_no, scorecard")
    .not("scorecard", "is", null)
    .not("match_no", "is", null);

  if (fxErr) {
    errors.push(fxErr.message);
    return { fixturesProcessed: 0, rowsUpserted: 0, rowsSkippedManual: 0, rowsSkippedUnmapped: 0, unmappedNameSample: [], errors };
  }

  const { data: matchRows, error: mErr } = await admin.from("matches").select("id, match_no");
  if (mErr) {
    errors.push(mErr.message);
    return { fixturesProcessed: 0, rowsUpserted: 0, rowsSkippedManual: 0, rowsSkippedUnmapped: 0, unmappedNameSample: [], errors };
  }

  const matchNoToId = new Map<number, string>();
  for (const m of matchRows || []) {
    const n = Number(m.match_no);
    if (Number.isFinite(n)) matchNoToId.set(n, String(m.id));
  }

  const batch: Record<string, string | number>[] = [];
  let rowsSkippedManual = 0;
  let rowsSkippedUnmapped = 0;
  const unmappedSample: string[] = [];

  for (const fx of fixtures || []) {
    const mn = Number(fx.match_no);
    if (!Number.isFinite(mn)) continue;
    const matchId = matchNoToId.get(mn);
    if (!matchId) {
      errors.push(`No public.matches for match_no=${mn} (fixture ${fx.id})`);
      continue;
    }
    const payload = toMatchScorecardData(fx.scorecard);
    if (!payload) {
      errors.push(`Unusable scorecard JSON for fixture ${fx.id}`);
      continue;
    }

    let rows: ReturnType<typeof aggregateFantasyRowsFromCricApiMatchData>;
    try {
      rows = aggregateFantasyRowsFromCricApiMatchData(payload);
    } catch (e) {
      errors.push(`aggregate failed fixture ${fx.id}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const row of rows) {
      const dbPlayerId = lookupDbPlayerId(row.player_name, nameToDbPlayerId);
      if (!dbPlayerId) {
        rowsSkippedUnmapped += 1;
        if (unmappedSample.length < 15) unmappedSample.push(row.player_name);
        continue;
      }
      const key = `${dbPlayerId}_${matchId}`;
      if (manualLocked.has(key)) {
        rowsSkippedManual += 1;
        continue;
      }
      const rowPayload: Record<string, string | number> = {
        player_id: dbPlayerId,
        match_id: matchId,
        points: row.d11.multipliedTotal,
        base_points: row.scoring.total_pts,
      };
      if (includeHaulColumns) {
        rowPayload.haul_run_mult = row.d11.runMultiplier;
        rowPayload.haul_wicket_mult = row.d11.wicketMultiplier;
        rowPayload.haul_applied_mult = row.d11.appliedMultiplier;
      }
      batch.push(rowPayload);
    }
  }

  let rowsUpserted = 0;
  const chunk = 200;
  for (let i = 0; i < batch.length; i += chunk) {
    const slice = batch.slice(i, i + chunk);
    if (slice.length === 0) continue;
    const { error: upErr } = await admin.from("match_points").upsert(slice, {
      onConflict: "player_id,match_id",
    });
    if (upErr) {
      errors.push(`upsert ${i}-${i + slice.length}: ${upErr.message}`);
    } else {
      rowsUpserted += slice.length;
    }
  }

  return {
    fixturesProcessed: fixtures?.length ?? 0,
    rowsUpserted,
    rowsSkippedManual,
    rowsSkippedUnmapped,
    unmappedNameSample: unmappedSample.slice(0, 15),
    errors,
  };
}
