#!/usr/bin/env python3
"""
Backfill Cricsheet dot balls into already-stored `fixtures_cricapi.scorecard`.

Use when:
- CricAPI scorecard is already in DB, but BBB was unavailable and/or dot balls are missing.
- You do NOT want to re-hit CricAPI (save API keys).

What it does:
- Select fixtures_cricapi rows where points_synced=true (scorecard is expected to be stored).
- Download fresh Cricsheet `ipl_json.zip` once.
- Merge dot balls into each bowling row (`0s` / `dot_balls`) via merge_cricsheet_dots_into_scorecard.
- PATCH the enriched scorecard back to Supabase.

It does NOT:
- Call CricAPI
- Touch match_points
"""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

from merge_cricsheet_dots_into_scorecard import merge_dots_into_scorecard_data
from run_ipl_day import download_cricsheet_zip_fresh, normalized_scorecard_data

_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "../.env"))

SUPABASE_URL = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ACCESS_TOKEN")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
).strip()

FIXTURES_TABLE = "fixtures_cricapi"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def list_synced_fixtures() -> List[Dict[str, Any]]:
    url = f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}"
    params = {
        "select": "id,api_match_id,match_date,team1_name,team2_name,points_synced,scorecard",
        "points_synced": "eq.true",
        "order": "date_time_gmt.asc",
    }
    out: List[Dict[str, Any]] = []
    offset = 0
    page = 200
    while True:
        q = dict(params)
        q["limit"] = str(page)
        q["offset"] = str(offset)
        r = requests.get(url, headers=HEADERS, params=q, timeout=30)
        r.raise_for_status()
        rows = r.json() or []
        out.extend(rows)
        if len(rows) < page:
            break
        offset += page
    return out


def scorecard_has_any_dots(sc: Dict[str, Any]) -> bool:
    """Heuristic: if any bowling row has dot fields present or merge flag exists."""
    if sc.get("dots_merged_from_cricsheet") is True:
        return True
    for inn in sc.get("scorecard") or []:
        for row in inn.get("bowling") or []:
            if not isinstance(row, dict):
                continue
            if row.get("dot_balls") is not None or row.get("0s") is not None:
                return True
    return False


def patch_scorecard(fixture_id: str, scorecard: Dict[str, Any]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}?id=eq.{fixture_id}"
    r = requests.patch(url, headers=HEADERS, json={"scorecard": scorecard}, timeout=30)
    r.raise_for_status()


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill Cricsheet dot balls into fixtures_cricapi.scorecard (no CricAPI calls).")
    ap.add_argument("--force", action="store_true", help="Re-merge even if scorecard already shows dots_merged_from_cricsheet / dot balls")
    ap.add_argument("--limit", type=int, default=0, help="Optional max fixtures to process (0 = no limit)")
    args = ap.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")

    fixtures = list_synced_fixtures()
    print(f"{len(fixtures)} fixture(s) from {FIXTURES_TABLE} where points_synced=true.")
    if not fixtures:
        return

    zip_path: Optional[str] = None
    try:
        zip_path = download_cricsheet_zip_fresh()
        updated = 0
        skipped_no_scorecard = 0
        skipped_has_dots = 0
        skipped_no_date = 0
        errors: List[str] = []

        processed = 0
        for fx in fixtures:
            if args.limit and processed >= int(args.limit):
                break
            fid = fx.get("id")
            api_mid = fx.get("api_match_id")
            md = str(fx.get("match_date") or "").strip()[:10]
            raw_sc = fx.get("scorecard")
            if not fid or not api_mid:
                continue
            sc = normalized_scorecard_data(raw_sc)
            if sc is None:
                skipped_no_scorecard += 1
                continue
            if not md or len(md) != 10:
                skipped_no_date += 1
                continue

            if not args.force and scorecard_has_any_dots(sc):
                skipped_has_dots += 1
                continue

            processed += 1
            enriched, meta = merge_dots_into_scorecard_data(sc, md, zip_path)
            if meta.get("errors"):
                # Still patch if we got a cricsheet id (partial merge is better than nothing)
                for e in meta["errors"]:
                    errors.append(f"{api_mid}: {e}")
            if meta.get("cricsheet_match_id"):
                print(f"- {api_mid}: cricsheet {meta['cricsheet_match_id']} merged")
            else:
                print(f"- {api_mid}: no cricsheet match id found (skipping patch)")
                continue

            patch_scorecard(str(fid), enriched)
            updated += 1

        print("")
        print("Backfill complete")
        print(f"- processed (needed dots): {processed}")
        print(f"- updated fixtures:        {updated}")
        print(f"- skipped (no scorecard):  {skipped_no_scorecard}")
        print(f"- skipped (no match_date): {skipped_no_date}")
        print(f"- skipped (already dots):  {skipped_has_dots}")
        if errors:
            print(f"- notes ({len(errors)}):")
            for e in errors[:12]:
                print(f"  * {e}")
    finally:
        if zip_path and os.path.isfile(zip_path):
            try:
                os.unlink(zip_path)
            except OSError:
                pass


if __name__ == "__main__":
    main()

