/** Normalized key for matching scorecard names to `players.player_name`. */
export function normPlayerName(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Scorecard label (normalized) → try these DB `player_name` normalizations in order.
 * CricAPI/ESPN spelling often differs from auction DB (Phil vs Philip, Chakaravarthy vs Chakravarthy).
 */
export const SCORECARD_NAME_FALLBACKS: Record<string, readonly string[]> = {
  "philip salt": ["phil salt"],
  "varun chakaravarthy": ["varun chakravarthy"],
  "digvesh singh rathi": ["digvesh rathi"],
};

export function lookupDbPlayerId(
  scorecardPlayerName: string,
  nameToDbPlayerId: Map<string, string>
): string | undefined {
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
