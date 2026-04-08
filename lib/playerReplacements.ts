import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Return a map keyed by `${matchId}_${inPlayerId}` -> outPlayerId.
 * Used during sync so replacement scores can be credited to the auctioned player.
 */
export async function fetchReplacementAttributionMap(
  admin: SupabaseClient
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const { data, error } = await admin
    .from("player_replacements")
    .select("match_id,in_player_id,out_player_id");
  if (error) return out;
  for (const r of data ?? []) {
    const mid = String((r as any).match_id || "");
    const inId = String((r as any).in_player_id || "");
    const outId = String((r as any).out_player_id || "");
    if (mid && inId && outId) out.set(`${mid}_${inId}`, outId);
  }
  return out;
}

