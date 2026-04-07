import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncMatchPointsFromStoredScorecards } from "@/lib/syncMatchPointsFromCricapi";

export const dynamic = "force-dynamic";

/** POST: recompute CricAPI → `match_points` from stored `fixtures_cricapi.scorecard`. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY; cannot batch upsert CricAPI points." },
      { status: 503 }
    );
  }

  try {
    const result = await syncMatchPointsFromStoredScorecards(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}

