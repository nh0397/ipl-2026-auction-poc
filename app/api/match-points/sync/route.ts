import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncMatchPointsFromStoredScorecards } from "@/lib/syncMatchPointsFromCricapi";

export const dynamic = "force-dynamic";

/**
 * POST: recompute and upsert `match_points` from scorecards (base points × performance multipliers).
 * Requires `SUPABASE_SERVICE_ROLE_KEY` on the server and a signed-in user.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY; cannot batch upsert match_points." },
      { status: 503 }
    );
  }

  try {
    const result = await syncMatchPointsFromStoredScorecards(admin);
    return NextResponse.json({
      ok: true,
      fixturesProcessed: result.fixturesProcessed,
      rowsUpserted: result.rowsUpserted,
      rowsSkippedManual: result.rowsSkippedManual,
      rowsSkippedUnmapped: result.rowsSkippedUnmapped,
      unmappedNameSample: result.unmappedNameSample,
      errors: result.errors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
