import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncMatchPointsFromStoredScorecards } from "@/lib/syncMatchPointsFromCricapi";
import { syncMatchPointsFromEspnFixtures } from "@/lib/syncMatchPointsFromEspn";
import { USE_CRICAPI_MATCH_POINTS_SYNC } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

/**
 * POST: recompute stored fantasy points (base × haul multipliers).
 * ESPN → `match_points_espn`; CricAPI → `match_points` only if `USE_CRICAPI_MATCH_POINTS_SYNC`.
 * Requires `SUPABASE_SERVICE_ROLE_KEY` and a signed-in user.
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
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY; cannot batch upsert stored match points." },
      { status: 503 }
    );
  }

  try {
    const espn = await syncMatchPointsFromEspnFixtures(admin);
    const cricapi = USE_CRICAPI_MATCH_POINTS_SYNC
      ? await syncMatchPointsFromStoredScorecards(admin)
      : {
          fixturesProcessed: 0,
          rowsUpserted: 0,
          rowsSkippedManual: 0,
          rowsSkippedUnmapped: 0,
          unmappedNameSample: [] as string[],
          errors: [] as string[],
        };
    const rowsUpserted = espn.rowsUpserted + cricapi.rowsUpserted;
    const fixturesProcessed = espn.fixturesProcessed + cricapi.fixturesProcessed;
    const rowsSkippedManual = espn.rowsSkippedManual + cricapi.rowsSkippedManual;
    const rowsSkippedUnmapped = espn.rowsSkippedUnmapped + cricapi.rowsSkippedUnmapped;
    const unmappedNameSample = [...espn.unmappedNameSample, ...cricapi.unmappedNameSample].slice(0, 15);
    const errors = [...espn.errors, ...cricapi.errors];
    return NextResponse.json({
      ok: true,
      fixturesProcessed,
      rowsUpserted,
      rowsSkippedManual,
      rowsSkippedUnmapped,
      unmappedNameSample,
      errors,
      espn: {
        fixturesProcessed: espn.fixturesProcessed,
        rowsUpserted: espn.rowsUpserted,
        rowsSkippedUnmapped: espn.rowsSkippedUnmapped,
      },
      cricapi: {
        fixturesProcessed: cricapi.fixturesProcessed,
        rowsUpserted: cricapi.rowsUpserted,
        rowsSkippedUnmapped: cricapi.rowsSkippedUnmapped,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
