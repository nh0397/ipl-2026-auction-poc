#!/usr/bin/env python3
"""
Backfill dot balls onto `fixtures_cricapi.scorecard` using CricAPI BBB (match_bbb).

Runs across ALL fixtures_cricapi rows that already have a scorecard stored.

For each scorecard:
- If bowling rows already include any dot balls, skip (unless --force).
- Otherwise fetch GET https://api.cricapi.com/v1/match_bbb?id=<api_match_id>
- Compute dot balls per bowler per innings (batter runs == 0; not wide/no-ball)
- Write `0s` and `dot_balls` on each bowling row and PATCH scorecard back to Supabase

This avoids re-scraping and avoids re-fetching scorecards.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

from cricsheet_dot_logic import is_bowling_dot_ball
from run_ipl_day import normalized_scorecard_data

_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "../.env"))

SUPABASE_URL = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ACCESS_TOKEN")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
).strip()

CRICAPI_KEY = (os.getenv("NEXT_PUBLIC_CRICAPI_KEY") or os.getenv("CRICAPI_KEY") or "").strip()
CRICAPI_BASE = "https://api.cricapi.com/v1"

FIXTURES_TABLE = "fixtures_cricapi"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def list_all_scorecards() -> List[Dict[str, Any]]:
    url = f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}"
    params = {
        "select": "id,api_match_id,match_date,team1_name,team2_name,scorecard",
        "not.scorecard": "is.null",
        "order": "date_time_gmt.asc",
    }
    out: List[Dict[str, Any]] = []
    offset = 0
    page = 200
    while True:
        q = dict(params)
        q["limit"] = str(page)
        q["offset"] = str(offset)
        r = requests.get(url, headers=HEADERS, params=q, timeout=45)
        r.raise_for_status()
        rows = r.json() or []
        out.extend(rows)
        if len(rows) < page:
            break
        offset += page
    return out


def fetch_match_bbb(api_match_id: str) -> Tuple[Optional[Any], Optional[str]]:
    res = requests.get(
        f"{CRICAPI_BASE}/match_bbb",
        params={"apikey": CRICAPI_KEY, "id": api_match_id},
        timeout=60,
    )
    res.raise_for_status()
    payload = res.json()
    if payload.get("status") == "success":
        return payload.get("data"), None
    return None, payload.get("reason") or str(payload)


def scorecard_has_any_dots(sc: Dict[str, Any]) -> bool:
    if sc.get("bbb_dots_merged") is True or sc.get("dots_merged_from_cricsheet") is True:
        return True
    for inn in sc.get("scorecard") or []:
        for row in inn.get("bowling") or []:
            if not isinstance(row, dict):
                continue
            v = row.get("dot_balls")
            if v is None:
                v = row.get("0s")
            try:
                if int(v or 0) > 0:
                    return True
            except Exception:
                pass
    return False


def _norm_name(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def _api_batting_team_full(inning_title: str, team_info: List[Dict[str, Any]]) -> str:
    low = (inning_title or "").lower()
    for t in team_info:
        nm = (t.get("name") or "").strip()
        if nm and nm.lower() in low:
            return nm
    return ""


def _short_norm(raw: str) -> str:
    t = (raw or "").strip().upper()
    return t[:-1] if t.endswith("W") else t


def _api_fielding_short(batting_full: str, team_info: List[Dict[str, Any]]) -> str:
    pairs: List[Tuple[str, str]] = []
    for t in team_info:
        nm = (t.get("name") or "").strip()
        sn = _short_norm(t.get("shortname") or "")
        if nm and sn:
            pairs.append((nm, sn))
    if len(pairs) < 2:
        return ""
    for nm, sn in pairs:
        if nm == batting_full:
            for nm2, sn2 in pairs:
                if nm2 != batting_full:
                    return sn2
            return ""
    return ""


def _extract_innings_from_bbb(bbb: Any) -> List[Dict[str, Any]]:
    """
    CricAPI BBB shape varies; we support the common cricsheet-like shape:
      { innings: [ { team: <batting team>, overs: [ { deliveries: [ { bowler, runs, extras, ... } ] } ] } ] }
    """
    if isinstance(bbb, dict) and isinstance(bbb.get("innings"), list):
        return [x for x in bbb.get("innings") or [] if isinstance(x, dict)]
    return []


def _dots_by_bowler_one_innings(inning: Dict[str, Any]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for over in inning.get("overs") or []:
        if not isinstance(over, dict):
            continue
        for d in over.get("deliveries") or []:
            if not isinstance(d, dict):
                continue
            runs = d.get("runs")
            extras = d.get("extras")
            if not is_bowling_dot_ball(runs, extras):
                continue
            bowler = (d.get("bowler") or "").strip()
            if bowler:
                out[bowler] = out.get(bowler, 0) + 1
    return out


def _find_bbb_inning(bbb_innings: List[Dict[str, Any]], batting_full: str) -> Optional[Dict[str, Any]]:
    t = _norm_name(batting_full)
    if not t:
        return None
    for inn in bbb_innings:
        team = _norm_name(str(inn.get("team") or ""))
        if team == t or t in team or team in t:
            return inn
    return None


def _last_token(name: str) -> str:
    parts = _norm_name(name).split()
    return parts[-1] if parts else ""


def _match_bbb_bowler_to_api(bbb_dots: Dict[str, int], api_bowler_name: str) -> int:
    """
    BBB payload is sometimes not franchise-disambiguated. We do a conservative match:
    sum counts for BBB names whose last token matches API bowler last token.
    """
    api_last = _last_token(api_bowler_name)
    if not api_last:
        return 0
    total = 0
    for bname, cnt in bbb_dots.items():
        if _last_token(bname) == api_last:
            total += int(cnt or 0)
    return total


def merge_bbb_dots_into_scorecard(scorecard: Dict[str, Any], bbb: Any) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    out = copy.deepcopy(scorecard)
    meta: Dict[str, Any] = {"errors": []}

    bbb_innings = _extract_innings_from_bbb(bbb)
    if not bbb_innings:
        meta["errors"].append("BBB payload missing innings[]; cannot compute dot balls")
        return out, meta

    team_info = list(out.get("teamInfo") or [])
    sc = out.get("scorecard") or []
    if not isinstance(sc, list) or not sc:
        meta["errors"].append("Scorecard missing scorecard[] blocks")
        return out, meta

    for block in sc:
        inn_title = str(block.get("inning") or "")
        bat_full = _api_batting_team_full(inn_title, team_info)
        fld_short = _api_fielding_short(bat_full, team_info)
        bbb_inn = _find_bbb_inning(bbb_innings, bat_full) if bat_full else None
        if not bbb_inn:
            meta["errors"].append(f"No BBB inning matched for API inning {inn_title!r}")
            inning_dots: Dict[str, int] = {}
        else:
            inning_dots = _dots_by_bowler_one_innings(bbb_inn)

        for row in block.get("bowling") or []:
            if not isinstance(row, dict):
                continue
            bowler = row.get("bowler") or {}
            bname = (bowler.get("name") or "").strip()
            if not bname:
                continue
            n = _match_bbb_bowler_to_api(inning_dots, bname)
            row["0s"] = n
            row["dot_balls"] = n

    out["bbb_dots_merged"] = True
    out["bbb_dots_source"] = "cricapi_match_bbb"
    return out, meta


def patch_scorecard(fixture_id: str, scorecard: Dict[str, Any]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}?id=eq.{fixture_id}"
    r = requests.patch(url, headers=HEADERS, json={"scorecard": scorecard}, timeout=45)
    r.raise_for_status()


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill dot balls into stored fixtures_cricapi.scorecard using CricAPI match_bbb.")
    ap.add_argument("--force", action="store_true", help="Process even if dot balls already appear present")
    ap.add_argument("--limit", type=int, default=0, help="Optional max fixtures to process (0 = no limit)")
    args = ap.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    if not CRICAPI_KEY:
        raise SystemExit("Missing NEXT_PUBLIC_CRICAPI_KEY (or CRICAPI_KEY) in .env")

    rows = list_all_scorecards()
    print(f"Found {len(rows)} fixtures_cricapi scorecards in DB.")
    processed = 0
    updated = 0
    skipped_has_dots = 0
    skipped_no_bbb = 0
    errors: List[str] = []

    for fx in rows:
        if args.limit and processed >= int(args.limit):
            break
        fid = fx.get("id")
        api_mid = fx.get("api_match_id")
        raw_sc = fx.get("scorecard")
        if not fid or not api_mid:
            continue
        sc = normalized_scorecard_data(raw_sc)
        if sc is None:
            continue
        if not args.force and scorecard_has_any_dots(sc):
            skipped_has_dots += 1
            continue

        processed += 1
        print(f"[{processed}] BBB dots for api_match_id={api_mid} …")
        try:
            bbb, reason = fetch_match_bbb(str(api_mid))
            if bbb is None:
                skipped_no_bbb += 1
                msg = f"{api_mid}: BBB unavailable ({reason})"
                print("  -", msg)
                errors.append(msg)
                continue

            enriched, meta = merge_bbb_dots_into_scorecard(sc, bbb)
            for e in meta.get("errors") or []:
                errors.append(f"{api_mid}: {e}")
            patch_scorecard(str(fid), enriched)
            updated += 1
            print("  ✅ patched scorecard with dot balls")
        except Exception as e:
            msg = f"{api_mid}: failed ({e})"
            print("  -", msg)
            errors.append(msg)

    print("")
    print("BBB dot backfill complete")
    print(f"- processed (needed dots): {processed}")
    print(f"- updated:                {updated}")
    print(f"- skipped (already dots): {skipped_has_dots}")
    print(f"- skipped (no BBB):       {skipped_no_bbb}")
    if errors:
        print(f"- notes ({len(errors)}):")
        for e in errors[:15]:
            print("  *", e)


if __name__ == "__main__":
    main()

