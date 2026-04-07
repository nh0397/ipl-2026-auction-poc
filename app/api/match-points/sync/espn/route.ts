import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncMatchPointsFromEspnFixtures } from "@/lib/syncMatchPointsFromEspn";

export const dynamic = "force-dynamic";

/** POST: recompute ESPN → `match_points_espn` from stored `fixtures.scorecard`. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY; cannot batch upsert ESPN points." },
      { status: 503 }
    );
  }

  try {
    const result = await syncMatchPointsFromEspnFixtures(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}

