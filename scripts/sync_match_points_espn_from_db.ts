import * as dotenv from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";
import { syncMatchPointsFromEspnFixtures } from "../lib/syncMatchPointsFromEspn";
import { MATCH_POINTS_ESPN_TABLE } from "../lib/matchPointsTables";

dotenv.config({ path: ".env" });

async function main() {
  const args = new Set(process.argv.slice(2));
  const truncate = args.has("--truncate");

  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  }

  if (truncate) {
    const { error } = await admin.from(MATCH_POINTS_ESPN_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`Failed clearing ${MATCH_POINTS_ESPN_TABLE}: ${error.message}`);
    console.log(`[sync] Cleared ${MATCH_POINTS_ESPN_TABLE} before recompute.`);
  }

  const t0 = Date.now();
  const res = await syncMatchPointsFromEspnFixtures(admin);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("");
  console.log("ESPN scorecards -> persisted points complete");
  console.log(`- fixturesProcessed:   ${res.fixturesProcessed}`);
  console.log(`- rowsUpserted:        ${res.rowsUpserted}`);
  console.log(`- rowsSkippedManual:   ${res.rowsSkippedManual}`);
  console.log(`- rowsSkippedUnmapped: ${res.rowsSkippedUnmapped}`);
  if (res.unmappedNameSample.length) {
    console.log(`- unmapped sample:     ${res.unmappedNameSample.slice(0, 10).join(", ")}`);
  }
  if (res.errors.length) {
    console.log(`- notes (${res.errors.length}):`);
    for (const e of res.errors.slice(0, 10)) console.log(`  * ${e}`);
  }
  console.log(`- elapsed:             ${elapsed}s`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

