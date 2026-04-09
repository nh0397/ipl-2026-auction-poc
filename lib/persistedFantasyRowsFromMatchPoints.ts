/**
 * Build fantasy rows for UI from persisted match_points / match_points_espn rows
 * (same source as the scoreboard Sheets tab).
 */

export type PersistedFantasyRow = {
  player_id: string;
  player_name: string;
  team: string | null;
  base_points: number | null;
  points: number | null;
  haul_run_mult: number | null;
  haul_wicket_mult: number | null;
  haul_applied_mult: number | null;
  manual_override: boolean;
};

export function buildPersistedFantasyRowsForMatch(
  matchId: string,
  matchPointRows: any[],
  players: { id: string; player_name?: string | null; team?: string | null }[]
): PersistedFantasyRow[] {
  const byId = new Map(players.map((p) => [String(p.id), p]));
  const rows = (matchPointRows || []).filter((pt: any) => String(pt.match_id) === String(matchId));

  const out: PersistedFantasyRow[] = rows.map((pt: any) => {
    const pid = String(pt.player_id ?? "");
    const pl = byId.get(pid);
    const rawPts = pt.points;
    const storedPts = rawPts === null || rawPts === undefined ? null : Number(rawPts);
    const bp = pt.base_points;
    const base = bp === null || bp === undefined ? null : Number(bp);
    const hr = pt.haul_run_mult;
    const hw = pt.haul_wicket_mult;
    const ha = pt.haul_applied_mult;
    return {
      player_id: pid,
      player_name: pl?.player_name?.trim() || `Player ${pid.slice(0, 8)}…`,
      team: pl?.team ?? null,
      base_points: base != null && Number.isFinite(base) ? base : null,
      points: storedPts,
      haul_run_mult: hr === null || hr === undefined ? null : Number(hr),
      haul_wicket_mult: hw === null || hw === undefined ? null : Number(hw),
      haul_applied_mult: ha === null || ha === undefined ? null : Number(ha),
      manual_override: !!pt.manual_override,
    };
  });

  return out.sort((a, b) => {
    const an = a.points == null ? -Infinity : Number(a.points) || 0;
    const bn = b.points == null ? -Infinity : Number(b.points) || 0;
    return bn - an;
  });
}
