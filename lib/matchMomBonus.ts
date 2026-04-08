import { toPoints2 } from "@/lib/pointsPrecision";

/** Default MoM bonus added to PJ base before haul (not stored on match_points). */
export const MOM_BONUS_DEFAULT = 50;

/**
 * Fantasy total after haul, with MoM added to PJ base first:
 * `(base_points + momBonus) × haul_applied` when base + haul exist.
 */
export function syntheticStoredAfterHaulWithMom(args: {
  basePoints: number | null | undefined;
  dbStoredPoints: number;
  haulAppliedMult: number | null | undefined;
  momBonus: number;
}): number {
  const mom = Math.max(0, Number(args.momBonus) || 0);
  const haulRaw = args.haulAppliedMult;
  const haul =
    haulRaw != null && Number.isFinite(Number(haulRaw)) && Number(haulRaw) > 0 ? Number(haulRaw) : null;
  const b =
    args.basePoints != null && Number.isFinite(Number(args.basePoints)) ? Number(args.basePoints) : null;
  const sp = Number(args.dbStoredPoints) || 0;

  if (b !== null && haul !== null) {
    return Math.round((b + mom) * haul * 100) / 100;
  }
  if (b !== null && haul === null) {
    return Math.round((b + mom) * 100) / 100;
  }
  const hFallback = haul ?? (b !== null && b > 0 && sp > 0 ? sp / b : 1);
  return Math.round((sp + mom * hFallback) * 100) / 100;
}

/** Recover DB `points` (pre-MoM, after haul) from post-haul synthetic and MoM. */
export function dbStoredPointsFromSyntheticAfterHaul(args: {
  syntheticAfterHaul: number;
  haulAppliedMult: number | null | undefined;
  momBonus: number;
}): number {
  const mom = Math.max(0, Number(args.momBonus) || 0);
  const haul =
    args.haulAppliedMult != null && Number.isFinite(Number(args.haulAppliedMult)) && Number(args.haulAppliedMult) > 0
      ? Number(args.haulAppliedMult)
      : 1;
  return toPoints2(Number(args.syntheticAfterHaul) - mom * haul);
}
