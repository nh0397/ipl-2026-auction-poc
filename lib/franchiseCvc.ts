export const CAPTAIN_MULT = 2;
export const VICE_CAPTAIN_MULT = 1.5;
/** Franchise Icon pick (not `players.type`) — 2× stored points for every game. */
export const FRANCHISE_ICON_MULT = 2;

export type FranchiseIconRow = {
  team_id: string;
  player_id: string;
  created_at?: string;
};

export type FranchiseCvcRow = {
  id?: string;
  team_id: string;
  slot: number;
  captain_id: string | null;
  vice_captain_id: string | null;
  valid_from: string;
  created_at?: string;
};

/** YYYY-MM-DD in Asia/Kolkata for an ISO match timestamp. */
export function matchDateKeyIST(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return "";
  return `${y}-${m}-${day}`;
}

/**
 * Latest C/VC pair for this franchise that is already in effect on the match calendar day (IST).
 */
/** Normalize DB date / ISO string to YYYY-MM-DD for comparisons. */
export function dateKeyOnly(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).slice(0, 10);
}

export function activeCvcForMatchDate(
  rows: FranchiseCvcRow[],
  teamId: string,
  matchDateKeyIST: string
): Pick<FranchiseCvcRow, "captain_id" | "vice_captain_id"> | null {
  if (!matchDateKeyIST) return null;
  const elig = rows.filter((r) => {
    const vf = dateKeyOnly(r.valid_from);
    return (
      r.team_id === teamId &&
      r.captain_id &&
      r.vice_captain_id &&
      r.captain_id !== r.vice_captain_id &&
      vf <= matchDateKeyIST
    );
  });
  if (elig.length === 0) return null;
  elig.sort((a, b) => (dateKeyOnly(a.valid_from) < dateKeyOnly(b.valid_from) ? 1 : dateKeyOnly(a.valid_from) > dateKeyOnly(b.valid_from) ? -1 : 0));
  const top = elig[0];
  return { captain_id: top.captain_id, vice_captain_id: top.vice_captain_id };
}

export function cvcMultiplierForPlayer(playerId: string, active: ReturnType<typeof activeCvcForMatchDate>): number {
  if (!active) return 1;
  if (playerId === active.captain_id) return CAPTAIN_MULT;
  if (playerId === active.vice_captain_id) return VICE_CAPTAIN_MULT;
  return 1;
}

/** Icon takes precedence over C/VC for the same player. */
export function franchiseFantasyMultiplier(
  playerId: string,
  franchiseIconPlayerId: string | null | undefined,
  activeCvc: ReturnType<typeof activeCvcForMatchDate>
): { mult: number; tag: "icon" | "c" | "vc" | null } {
  if (franchiseIconPlayerId && playerId === franchiseIconPlayerId) {
    return { mult: FRANCHISE_ICON_MULT, tag: "icon" };
  }
  const c = cvcMultiplierForPlayer(playerId, activeCvc);
  if (c === CAPTAIN_MULT) return { mult: c, tag: "c" };
  if (c === VICE_CAPTAIN_MULT) return { mult: c, tag: "vc" };
  return { mult: 1, tag: null };
}

export function isIconPlayer(p: { type?: string | null }): boolean {
  return String(p?.type ?? "")
    .toLowerCase()
    .includes("icon");
}
