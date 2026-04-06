"""
Upsert public.match_points from a merged CricAPI scorecard (PJ rules via ipl_fantasy.transform).

Used by run_ipl_day.py and sync_scorecards_cricapi.py only — no separate CLI.
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SB_SERVICE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ACCESS_TOKEN")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)
HEADERS_GET = {
    "apikey": SB_SERVICE_KEY,
    "Authorization": f"Bearer {SB_SERVICE_KEY}",
    "Content-Type": "application/json",
}
HEADERS_UPSERT = {
    **HEADERS_GET,
    "Prefer": "resolution=merge-duplicates",
}


def norm_name(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower().strip())


def fetch_players_name_map() -> Dict[str, str]:
    url = f"{SUPABASE_URL}/rest/v1/players"
    r = requests.get(url, headers=HEADERS_GET, params={"select": "id,player_name"}, timeout=60)
    r.raise_for_status()
    out: Dict[str, str] = {}
    for row in r.json() or []:
        pid = row.get("id")
        nm = row.get("player_name")
        if pid and nm:
            out[norm_name(str(nm))] = str(pid)
    return out


def fetch_match_uuid_for_match_no(match_no: int) -> Optional[str]:
    url = f"{SUPABASE_URL}/rest/v1/matches"
    r = requests.get(
        url,
        headers=HEADERS_GET,
        params={"select": "id", "match_no": f"eq.{match_no}"},
        timeout=30,
    )
    r.raise_for_status()
    rows = r.json() or []
    if not rows:
        return None
    return str(rows[0]["id"])


def persist_match_points_from_scorecard(
    api_match_id: str,
    scorecard: Dict[str, Any],
    match_no: Any,
    players_by_norm: Dict[str, str],
) -> Tuple[int, List[str], Optional[str]]:
    if not SUPABASE_URL or not SB_SERVICE_KEY:
        return 0, [], "missing Supabase URL or service key"

    if not isinstance(scorecard, dict) or not scorecard.get("scorecard"):
        return 0, [], "scorecard JSON missing scorecard[]"

    if match_no is None:
        return 0, [], "fixtures_cricapi.match_no is null (cannot link to public.matches)"

    try:
        mn = int(match_no)
    except (TypeError, ValueError):
        return 0, [], f"invalid match_no: {match_no!r}"

    match_uuid = fetch_match_uuid_for_match_no(mn)
    if not match_uuid:
        return 0, [], f"no public.matches row for match_no={mn}"

    from ipl_fantasy import pj_points_with_haul_multiplier, transform

    rows = transform(str(api_match_id), scorecard)
    locked_url = f"{SUPABASE_URL}/rest/v1/match_points"
    lr = requests.get(
        locked_url,
        headers=HEADERS_GET,
        params={
            "select": "player_id",
            "match_id": f"eq.{match_uuid}",
            "manual_override": "eq.true",
        },
        timeout=30,
    )
    locked_ids: set[str] = set()
    if lr.ok:
        locked_ids = {str(row["player_id"]) for row in (lr.json() or []) if row.get("player_id")}

    upserts: List[Dict[str, Any]] = []
    skipped: List[str] = []
    for p in rows:
        nm = norm_name(p.get("player_name") or "")
        pid = players_by_norm.get(nm)
        if not pid:
            skipped.append(p.get("player_name") or "?")
            continue
        if pid in locked_ids:
            continue
        base_pts, total = pj_points_with_haul_multiplier(p)
        upserts.append(
            {
                "match_id": match_uuid,
                "player_id": pid,
                "points": total,
                "base_points": base_pts,
            }
        )

    if not upserts:
        return 0, skipped, None

    url = f"{SUPABASE_URL}/rest/v1/match_points?on_conflict=player_id,match_id"
    r = requests.post(url, headers=HEADERS_UPSERT, json=upserts, timeout=60)
    if not r.ok:
        return 0, skipped, f"match_points POST {r.status_code}: {r.text[:500]}"

    return len(upserts), skipped, None
