export const CAPTAIN_MULT = 2;
export const VICE_CAPTAIN_MULT = 1.5;
/** Franchise Icon pick (not `players.type`) — 2× stored points for every game. */
export const FRANCHISE_ICON_MULT = 2;

/** On a franchise booster day (IST calendar): sheet uses base × this (C/VC and normal Icon 2× are ignored). */
export const BOOSTER_DAY_MULT = 3;
/** Franchise Icon on a booster day: base × this (not 3× and not 2× on stored). */
export const BOOSTER_DAY_ICON_MULT = 6;

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
  /** Legacy: original paired effective date. */
  valid_from: string;
  /** New: captain and vice dates can differ. */
  captain_valid_from?: string | null;
  vice_valid_from?: string | null;
  created_at?: string;
};

/** Up to 3 IST calendar dates per franchise when booster applies (base × 3, or × 6 for franchise Icon). */
export type FranchiseBoosterRow = {
  team_id: string;
  slot: number;
  booster_date: string;
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
  const cands = rows.filter((r) => r.team_id === teamId);

  const captainElig = cands
    .filter((r) => {
      const vf = dateKeyOnly(r.captain_valid_from ?? r.valid_from);
      return !!r.captain_id && vf && vf <= matchDateKeyIST;
    })
    .sort((a, b) =>
      dateKeyOnly(a.captain_valid_from ?? a.valid_from) < dateKeyOnly(b.captain_valid_from ?? b.valid_from)
        ? 1
        : dateKeyOnly(a.captain_valid_from ?? a.valid_from) > dateKeyOnly(b.captain_valid_from ?? b.valid_from)
          ? -1
          : 0
    );

  const viceElig = cands
    .filter((r) => {
      const vf = dateKeyOnly(r.vice_valid_from ?? r.valid_from);
      return !!r.vice_captain_id && vf && vf <= matchDateKeyIST;
    })
    .sort((a, b) =>
      dateKeyOnly(a.vice_valid_from ?? a.valid_from) < dateKeyOnly(b.vice_valid_from ?? b.valid_from)
        ? 1
        : dateKeyOnly(a.vice_valid_from ?? a.valid_from) > dateKeyOnly(b.vice_valid_from ?? b.valid_from)
          ? -1
          : 0
    );

  const captain_id = captainElig[0]?.captain_id ?? null;
  const vice_captain_id = viceElig[0]?.vice_captain_id ?? null;
  if (!captain_id || !vice_captain_id) return null;
  if (captain_id === vice_captain_id) return null;
  return { captain_id, vice_captain_id };
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

export function isFranchiseBoosterDay(
  rows: FranchiseBoosterRow[],
  teamId: string,
  matchDateKeyIST: string
): boolean {
  if (!matchDateKeyIST) return false;
  return rows.some((r) => r.team_id === teamId && dateKeyOnly(r.booster_date) === matchDateKeyIST);
}

function effectiveBaseForSheet(
  basePoints: number | null | undefined,
  storedPoints: number
): number {
  if (basePoints != null && Number.isFinite(Number(basePoints))) return Number(basePoints);
  return storedPoints;
}

export type FranchiseMatchSheetBreakdown =
  | { mode: "booster"; sheetMult: number; baseUsed: number; isFranchiseIcon: boolean }
  | {
      mode: "franchise_mult";
      mult: number;
      tag: "icon" | "c" | "vc" | null;
      storedPoints: number;
    };

/**
 * Franchise-facing points for one played cell: booster day → base × 3 (or × 6 for franchise Icon);
 * otherwise stored fantasy × Icon / C / VC.
 */
export function franchiseMatchSheetDisplay(args: {
  storedPoints: number;
  basePoints: number | null | undefined;
  franchiseId: string;
  playerId: string;
  franchiseIconPlayerId: string | null;
  matchDateKeyIST: string;
  boosterRows: FranchiseBoosterRow[];
  activeCvc: ReturnType<typeof activeCvcForMatchDate>;
}): { display: number; breakdown: FranchiseMatchSheetBreakdown } {
  const booster = isFranchiseBoosterDay(args.boosterRows, args.franchiseId, args.matchDateKeyIST);
  const isFIcon = !!(args.franchiseIconPlayerId && args.playerId === args.franchiseIconPlayerId);

  if (booster) {
    const baseUsed = effectiveBaseForSheet(args.basePoints, args.storedPoints);
    const sheetMult = isFIcon ? BOOSTER_DAY_ICON_MULT : BOOSTER_DAY_MULT;
    return {
      display: Math.round(baseUsed * sheetMult * 100) / 100,
      breakdown: { mode: "booster", sheetMult, baseUsed, isFranchiseIcon: isFIcon },
    };
  }

  const { mult, tag } = franchiseFantasyMultiplier(
    args.playerId,
    args.franchiseIconPlayerId,
    args.activeCvc
  );
  return {
    display: Math.round(args.storedPoints * mult * 100) / 100,
    breakdown: { mode: "franchise_mult", mult, tag, storedPoints: args.storedPoints },
  };
}

/** Inverse of franchise sheet display when the owner edits the cell (saves underlying stored points — see `SHEET_MATCH_POINTS_TABLE`). */
export function storedPointsFromFranchiseSheetDisplay(args: {
  displayPts: number;
  storedPoints: number;
  basePoints: number | null | undefined;
  franchiseId: string;
  playerId: string;
  franchiseIconPlayerId: string | null;
  matchDateKeyIST: string;
  boosterRows: FranchiseBoosterRow[];
  activeCvc: ReturnType<typeof activeCvcForMatchDate>;
}): number {
  const booster = isFranchiseBoosterDay(args.boosterRows, args.franchiseId, args.matchDateKeyIST);
  const isFIcon = !!(args.franchiseIconPlayerId && args.playerId === args.franchiseIconPlayerId);

  if (booster) {
    const baseUsed = effectiveBaseForSheet(args.basePoints, args.storedPoints);
    const perfMult = baseUsed > 0 ? args.storedPoints / baseUsed : 1;
    const sheetMult = isFIcon ? BOOSTER_DAY_ICON_MULT : BOOSTER_DAY_MULT;
    return Math.round((args.displayPts / sheetMult) * perfMult * 100) / 100;
  }

  const { mult } = franchiseFantasyMultiplier(
    args.playerId,
    args.franchiseIconPlayerId,
    args.activeCvc
  );
  if (mult <= 0) return args.displayPts;
  return Math.round((args.displayPts / mult) * 100) / 100;
}

export function isIconPlayer(p: { type?: string | null }): boolean {
  return String(p?.type ?? "")
    .toLowerCase()
    .includes("icon");
}
