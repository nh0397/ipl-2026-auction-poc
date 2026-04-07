import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeEspnPjBreakdownRows,
  type PlayerCatalogRow,
} from "@/lib/espnPjBreakdownFromScorecard";
import { lookupDbPlayerId, normPlayerName } from "@/lib/matchPointsPlayerLookup";
import { MATCH_POINTS_ESPN_TABLE } from "@/lib/matchPointsTables";

function parseScorecardJson(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

/** ESPN scraper shape: top-level `innings[]` with batting/bowling (not CricAPI `scorecard[]`). */
export function isEspnShapedScorecard(raw: unknown): raw is Record<string, unknown> {
  const o = parseScorecardJson(raw);
  if (!o || typeof o !== "object") return false;
  const inn = (o as Record<string, unknown>).innings;
  return Array.isArray(inn) && inn.length > 0;
}

export type EspnSyncResult = {
  fixturesProcessed: number;
  rowsUpserted: number;
  rowsSkippedManual: number;
  rowsSkippedUnmapped: number;
  unmappedNameSample: string[];
  errors: string[];
};

/**
 * Upsert `match_points_espn` only (never `match_points`) from ESPN-shaped scorecards in `public.fixtures`.
 * Same PJ + haul math as the ESPN fantasy modal. Skips rows with `manual_override` on the ESPN table.
 */
export async function syncMatchPointsFromEspnFixtures(admin: SupabaseClient): Promise<EspnSyncResult> {
  const errors: string[] = [];

  const { data: playerRows, error: playersErr } = await admin
    .from("players")
    .select("id, player_name, team, type, role");
  if (playersErr) {
    errors.push(`players: ${playersErr.message}`);
    return { fixturesProcessed: 0, rowsUpserted: 0, rowsSkippedManual: 0, rowsSkippedUnmapped: 0, unmappedNameSample: [], errors };
  }

  const nameToDbPlayerId = new Map<string, string>();
  const catalog: PlayerCatalogRow[] = [];
  for (const pr of playerRows ?? []) {
    const nm = normPlayerName(String(pr.player_name ?? ""));
    if (nm) nameToDbPlayerId.set(nm, String(pr.id));
    catalog.push({
      player_name: String(pr.player_name ?? ""),
      team: String(pr.team ?? ""),
      type: pr.type != null ? String(pr.type) : null,
      role: pr.role != null ? String(pr.role) : null,
    });
  }

  let includeHaulColumns = true;
  const { error: haulColProbeErr } = await admin.from(MATCH_POINTS_ESPN_TABLE).select("haul_applied_mult").limit(1);
  if (haulColProbeErr) {
    if (/haul_applied|schema cache|could not find.*column|relation.*does not exist/i.test(String(haulColProbeErr.message))) {
      includeHaulColumns = false;
      errors.push(
        `${MATCH_POINTS_ESPN_TABLE} missing or no haul_* columns — apply migration 20260407180000_match_points_espn.sql; syncing base fields only if possible.`
      );
    } else {
      errors.push(`${MATCH_POINTS_ESPN_TABLE} column probe: ${haulColProbeErr.message}`);
    }
  }

  const { data: lockedRows, error: lockErr } = await admin
    .from(MATCH_POINTS_ESPN_TABLE)
    .select("player_id, match_id")
    .eq("manual_override", true);
  if (lockErr) {
    errors.push(`manual_override query: ${lockErr.message}`);
    return { fixturesProcessed: 0, rowsUpserted: 0, rowsSkippedManual: 0, rowsSkippedUnmapped: 0, unmappedNameSample: [], errors };
  }
  const manualLocked = new Set((lockedRows ?? []).map((r) => `${r.player_id}_${r.match_id}`));

  const { data: fixtures, error: fxErr } = await admin
    .from("fixtures")
    .select("match_no, scorecard, team1_short, team2_short, team1_name, team2_name")
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
  let fixturesProcessed = 0;

  for (const fx of fixtures || []) {
    const mn = Number(fx.match_no);
    if (!Number.isFinite(mn)) continue;
    const scRaw = parseScorecardJson(fx.scorecard);
    if (!isEspnShapedScorecard(scRaw)) continue;

    const matchId = matchNoToId.get(mn);
    if (!matchId) {
      errors.push(`No public.matches for match_no=${mn} (fixtures ESPN row)`);
      continue;
    }

    fixturesProcessed += 1;
    const matchMeta = {
      team1_short: fx.team1_short,
      team1_name: fx.team1_name,
      team2_short: fx.team2_short,
      team2_name: fx.team2_name,
    };

    let rows: ReturnType<typeof computeEspnPjBreakdownRows>;
    try {
      rows = computeEspnPjBreakdownRows(scRaw, matchMeta, catalog);
    } catch (e) {
      errors.push(`ESPN aggregate failed match_no=${mn}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const row of rows) {
      const displayName = row.n || "";
      const dbPlayerId = lookupDbPlayerId(displayName, nameToDbPlayerId);
      if (!dbPlayerId) {
        rowsSkippedUnmapped += 1;
        if (unmappedSample.length < 15) unmappedSample.push(displayName || "?");
        continue;
      }
      const key = `${dbPlayerId}_${matchId}`;
      if (manualLocked.has(key)) {
        rowsSkippedManual += 1;
        continue;
      }
      const pj = row.pjScoring;
      const basePts = pj?.total_pts ?? row.total ?? 0;
      const d11 = row.d11;
      if (!d11) continue;

      const rowPayload: Record<string, string | number> = {
        player_id: dbPlayerId,
        match_id: matchId,
        points: d11.multipliedTotal,
        base_points: basePts,
      };
      if (includeHaulColumns) {
        rowPayload.haul_run_mult = d11.runMultiplier;
        rowPayload.haul_wicket_mult = d11.wicketMultiplier;
        rowPayload.haul_applied_mult = d11.appliedMultiplier;
      }
      batch.push(rowPayload);
    }
  }

  let rowsUpserted = 0;
  const chunk = 200;
  for (let i = 0; i < batch.length; i += chunk) {
    const slice = batch.slice(i, i + chunk);
    if (slice.length === 0) continue;
    const { error: upErr } = await admin.from(MATCH_POINTS_ESPN_TABLE).upsert(slice, {
      onConflict: "player_id,match_id",
    });
    if (upErr) {
      errors.push(`ESPN upsert ${i}-${i + slice.length}: ${upErr.message}`);
    } else {
      rowsUpserted += slice.length;
    }
  }

  return {
    fixturesProcessed,
    rowsUpserted,
    rowsSkippedManual,
    rowsSkippedUnmapped,
    unmappedNameSample: unmappedSample.slice(0, 15),
    errors,
  };
}
