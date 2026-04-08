/** Fantasy / sheet points: always two decimal places (half-up via `toFixed`). */
export const POINTS_DECIMAL_PLACES = 2;

/** Canonical numeric value with exactly two decimal places (reduces float drift). */
export function toPoints2(n: number): number {
  return Number((Number(n) || 0).toFixed(POINTS_DECIMAL_PLACES));
}

/** String for UI labels, inputs, CSV (always shows two fractional digits). */
export function formatPoints2(n: number): string {
  return (Number(n) || 0).toFixed(POINTS_DECIMAL_PLACES);
}
