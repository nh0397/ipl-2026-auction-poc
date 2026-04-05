#!/usr/bin/env python3
"""
Fetch CricAPI v1/match_scorecard once and write a JSON snapshot under
scripts/cricapi_scorecard_snapshots/ so ipl_fantasy.fetch_scorecard can load it
without burning API hits.

  python3 scripts/save_cricapi_scorecard_snapshot.py --fixture-id 55fe0f15-6eb0-4ad5-835b-5564be4f6a21
  python3 scripts/save_cricapi_scorecard_snapshot.py --cricapi-id <id-from-api>

--fixture-id: Supabase public.fixtures_cricapi.id (UUID) → looks up api_match_id via REST.

Requires .env: NEXT_PUBLIC_CRICAPI_KEY (or CRICAPI_KEY); for --fixture-id also
NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon if RLS allows read).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
_SNAPSHOT_DIR = os.path.join(_HERE, "cricapi_scorecard_snapshots")
load_dotenv(os.path.join(_HERE, "../.env"))

CRICAPI_BASE = "https://api.cricapi.com/v1"
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SB_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ACCESS_TOKEN")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)
CRICAPI_KEY = os.getenv("NEXT_PUBLIC_CRICAPI_KEY") or os.getenv("CRICAPI_KEY")

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)


def resolve_api_match_id_from_fixture(fixture_uuid: str) -> str:
    if not SUPABASE_URL or not SB_KEY:
        raise SystemExit(
            "Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in .env (needed for --fixture-id)."
        )
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/fixtures_cricapi"
    params = {"id": f"eq.{fixture_uuid}", "select": "id,api_match_id,title,match_name"}
    headers = {
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
    }
    r = requests.get(url, headers=headers, params=params, timeout=30)
    r.raise_for_status()
    rows = r.json() or []
    if not rows:
        raise SystemExit(f"No fixtures_cricapi row for id={fixture_uuid!r}")
    api_mid = rows[0].get("api_match_id")
    if not api_mid:
        raise SystemExit(f"fixtures_cricapi row has no api_match_id: {rows[0]!r}")
    return str(api_mid).strip()


def fetch_scorecard_envelope(api_match_id: str) -> dict:
    if not CRICAPI_KEY:
        raise SystemExit("Set NEXT_PUBLIC_CRICAPI_KEY (or CRICAPI_KEY) in .env")
    r = requests.get(
        f"{CRICAPI_BASE}/match_scorecard",
        params={"apikey": CRICAPI_KEY, "id": api_match_id},
        timeout=45,
    )
    r.raise_for_status()
    return r.json()


def main() -> None:
    ap = argparse.ArgumentParser(description="Save CricAPI match_scorecard JSON snapshot")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--fixture-id", help="Supabase fixtures_cricapi.id (UUID)")
    g.add_argument("--cricapi-id", help="CricAPI match id (match_scorecard id=)")
    args = ap.parse_args()

    supabase_fixture_id: str | None = None
    if args.fixture_id:
        if not UUID_RE.match(args.fixture_id.strip()):
            ap.error("--fixture-id must be a UUID")
        supabase_fixture_id = args.fixture_id.strip()
        api_match_id = resolve_api_match_id_from_fixture(supabase_fixture_id)
        print(f"Resolved api_match_id={api_match_id!r} from fixtures_cricapi.id={supabase_fixture_id!r}")
    else:
        api_match_id = str(args.cricapi_id).strip()

    envelope = fetch_scorecard_envelope(api_match_id)
    # Never persist apikey / token-like fields from the API envelope
    if isinstance(envelope, dict):
        envelope = {k: v for k, v in envelope.items() if k.lower() != "apikey"}
    data = envelope.get("data") if isinstance(envelope.get("data"), dict) else {}

    os.makedirs(_SNAPSHOT_DIR, exist_ok=True)
    # Prefer filename by fixture UUID when provided (stable for your workflow)
    if supabase_fixture_id:
        out_name = f"{supabase_fixture_id}.json"
    else:
        out_name = f"{api_match_id}.json"
    out_path = os.path.join(_SNAPSHOT_DIR, out_name)

    payload = {
        "cricapi_match_id": api_match_id,
        "supabase_fixture_id": supabase_fixture_id,
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "api_response": envelope,
        "data": data,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Wrote {out_path}")
    print(f"ipl_fantasy.fetch_scorecard will load this when called with id={api_match_id!r} (see load_cache).")


if __name__ == "__main__":
    main()
