"""
CricAPI scorecard → Supabase, with Cricsheet dot balls merged onto each bowling row
(same logic as merge_cricsheet_dots_into_scorecard.py / run_ipl_day).

For a full-day fixtures pass (all rows on a date), prefer:
  scripts/run_ipl_day.py
"""

import os
import tempfile
import time
import requests
from typing import Any, Dict, List, Optional, Tuple
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import argparse
import re

load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SB_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ACCESS_TOKEN") or SUPABASE_KEY

# Prefer NEXT_PUBLIC_CRICAPI_KEY (Next.js .env); CRICAPI_KEY is a fallback.
CRICAPI_KEY = os.getenv("NEXT_PUBLIC_CRICAPI_KEY") or os.getenv("CRICAPI_KEY")
CRICAPI_BASE_URL = "https://api.cricapi.com/v1"

FIXTURES_TABLE = "fixtures_cricapi"

HEADERS = {
    "apikey": SB_SERVICE_KEY,
    "Authorization": f"Bearer {SB_SERVICE_KEY}",
    "Content-Type": "application/json",
}

CRICSHEET_ZIP_URL = "https://cricsheet.org/downloads/ipl_json.zip"


def download_cricsheet_zip_to_temp() -> str:
    r = requests.get(CRICSHEET_ZIP_URL, timeout=120)
    r.raise_for_status()
    tf = tempfile.NamedTemporaryFile(prefix="ipl_json_", suffix=".zip", delete=False)
    try:
        tf.write(r.content)
        tf.close()
        return tf.name
    except Exception:
        tf.close()
        try:
            os.unlink(tf.name)
        except OSError:
            pass
        raise


def fetch_match_bbb(match_id: str) -> Tuple[Optional[Any], Optional[str]]:
    """
    CricAPI exposes ball-by-ball on a separate endpoint: GET /v1/match_bbb?id=…
    (Passing bbb=true on match_scorecard does not add BBB to that payload in practice.)
    Returns (data, None) on success, (None, reason) on failure.
    """
    res = requests.get(
        f"{CRICAPI_BASE_URL}/match_bbb",
        params={"apikey": CRICAPI_KEY, "id": match_id},
        timeout=60,
    )
    res.raise_for_status()
    payload = res.json()
    if payload.get("status") == "success":
        return payload.get("data"), None
    reason = payload.get("reason") or str(payload)
    return None, reason


def fetch_scorecard(match_id: str, include_bbb: bool = False) -> Dict[str, Any]:
    params: Dict[str, Any] = {"apikey": CRICAPI_KEY, "id": match_id}
    if include_bbb:
        params["bbb"] = "true"
    res = requests.get(
        f"{CRICAPI_BASE_URL}/match_scorecard",
        params=params,
        timeout=30,
    )
    res.raise_for_status()
    payload = res.json()
    if payload.get("status") != "success":
        raise RuntimeError(f"CricAPI match_scorecard error: {payload}")
    data = dict(payload.get("data") or {})
    if include_bbb:
        bbb, err = fetch_match_bbb(match_id)
        if bbb is not None:
            data["ballByBall"] = bbb
        elif err:
            data["ballByBallError"] = err
    return data


def today_ist_date_str(now_utc: datetime) -> str:
    # IST = UTC+05:30
    ist = now_utc.astimezone(timezone(timedelta(hours=5, minutes=30)))
    return ist.strftime("%Y-%m-%d")


def list_targets(match_date_ist: Optional[str]) -> List[Dict[str, Any]]:
    """
    Pick fixtures to sync scorecards for.

    Rules:
    - Only matches that have ended (match_ended=true)
    - Only rows with scorecard IS NULL (not already stored)
    - Always filter by the target date (IST calendar date).
    - Always require scheduled start time <= now (UTC) so a run at (say) 20:00 local time
      only picks matches that should have started by then (works for double-headers).
    - Only matches that have ended and are not yet points-synced.
    - Only rows with scorecard IS NULL (not already stored).
    """
    now_utc = datetime.now(timezone.utc)
    target_ist = match_date_ist or today_ist_date_str(now_utc)

    # IMPORTANT: don't manually embed ISO timestamps with "+" into the URL query string.
    # Use params so requests handles encoding correctly (PostgREST interprets "+" as space otherwise).
    url = f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}"
    base_params = {
        "select": "id,api_match_id,match_no,match_date,date_time_gmt,match_ended,scorecard,title,match_name,team1_short,team2_short",
        "match_ended": "eq.true",
        "points_synced": "eq.false",
        "scorecard": "is.null",
        "match_date": f"eq.{target_ist}",
        "order": "date_time_gmt.asc",
    }
    now_iso_utc = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    base_params["date_time_gmt"] = f"lte.{now_iso_utc}"

    all_rows: List[Dict[str, Any]] = []
    page_size = 200
    offset = 0
    while True:
        params = dict(base_params)
        params["limit"] = str(page_size)
        params["offset"] = str(offset)
        res = requests.get(url, headers=HEADERS, params=params, timeout=30)
        res.raise_for_status()
        rows = res.json() or []
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    return all_rows


def update_fixture_scorecard_and_mark_synced(fixture_id: str, api_match_id: str, scorecard: Dict[str, Any]) -> None:
    # Patch by primary key
    url = f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}?id=eq.{fixture_id}"
    res = requests.patch(
        url,
        headers=HEADERS,
        json={"scorecard": scorecard, "points_synced": True},
        timeout=30,
    )
    res.raise_for_status()
    # UI reads `public.fixtureapi_points.synced` only (not fixtures_cricapi.points_synced).
    fap = f"{SUPABASE_URL}/rest/v1/fixtureapi_points"
    r2 = requests.post(
        fap,
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        json={"api_match_id": api_match_id, "synced": True},
        timeout=30,
    )
    r2.raise_for_status()


def main() -> None:
    if not SUPABASE_URL or not SB_SERVICE_KEY:
        raise RuntimeError("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
    if not CRICAPI_KEY:
        raise RuntimeError("Missing CricAPI key (set NEXT_PUBLIC_CRICAPI_KEY or CRICAPI_KEY).")

    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="IST date (YYYY-MM-DD). Defaults to today (IST).", default=None)
    parser.add_argument(
        "--bbb",
        action="store_true",
        help="Request BBB: pass bbb=true on match_scorecard and merge GET /match_bbb into scorecard as ballByBall (or ballByBallError).",
    )
    parser.add_argument(
        "--skip-cricsheet-dots",
        action="store_true",
        help="Store raw CricAPI scorecard only (no Cricsheet zip / per-row dot merge).",
    )
    parser.add_argument(
        "--skip-match-points",
        action="store_true",
        help="Do not upsert public.match_points after saving each scorecard.",
    )
    args = parser.parse_args()
    if args.date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(args.date).strip()):
        raise RuntimeError(f"Invalid --date value (expected YYYY-MM-DD): {args.date!r}")

    sleep_s = float(os.getenv("CRICAPI_SCORECARD_SLEEP_SECONDS", "1.0"))
    include_bbb = bool(args.bbb) or os.getenv("CRICAPI_INCLUDE_BBB", "").strip().lower() in ("1", "true", "yes")

    target_date = str(args.date).strip() if args.date else None
    targets = list_targets(target_date)
    target_label = target_date or "today (IST)"
    print(f"Target date: {target_label}. Found {len(targets)} ended fixtures missing scorecard.")

    updated: List[Dict[str, Any]] = []

    players_by_name: Dict[str, str] = {}
    if targets and not args.skip_match_points:
        try:
            from cricapi_match_points import fetch_players_name_map

            players_by_name = fetch_players_name_map()
            print(f"  [match_points] loaded {len(players_by_name)} player name(s)")
        except Exception as e:
            print(f"  WARNING: match_points disabled (could not load players): {e}")

    cr_zip: Optional[str] = None
    if targets and not args.skip_cricsheet_dots:
        try:
            print("  [cricsheet] downloading ipl_json.zip for dot merge …")
            cr_zip = download_cricsheet_zip_to_temp()
        except Exception as e:
            print(f"  [cricsheet] zip failed ({e}); storing scorecards without dot merge")

    try:
        for idx, f in enumerate(targets, start=1):
            fixture_id = f.get("id")
            match_id = f.get("api_match_id")
            if not fixture_id or not match_id:
                continue
            print(f"[{idx}/{len(targets)}] Fetching scorecard {match_id} …" + (" (with BBB)" if include_bbb else ""))
            sc = fetch_scorecard(match_id, include_bbb=include_bbb)
            if cr_zip and not args.skip_cricsheet_dots:
                from merge_cricsheet_dots_into_scorecard import merge_dots_into_scorecard_data

                md = str(sc.get("date") or f.get("match_date") or "").strip()
                if len(md) >= 10 and re.match(r"^\d{4}-\d{2}-\d{2}", md):
                    md = md[:10]
                    sc, dm = merge_dots_into_scorecard_data(sc, md, cr_zip)
                    if dm.get("cricsheet_match_id"):
                        print(f"  merged Cricsheet dots (match {dm['cricsheet_match_id']})")
                    for err in dm.get("errors") or []:
                        print(f"  [dots] {err}")
            update_fixture_scorecard_and_mark_synced(fixture_id, str(match_id), sc)
            print(f"  ✅ stored scorecard + set points_synced=true for fixture_id={fixture_id}")

            if not args.skip_match_points and players_by_name:
                from cricapi_match_points import persist_match_points_from_scorecard

                n_pts, skipped, mp_err = persist_match_points_from_scorecard(
                    str(match_id), sc, f.get("match_no"), players_by_name
                )
                if mp_err:
                    print(f"  [match_points] {mp_err}")
                elif n_pts:
                    print(f"  [match_points] upserted {n_pts} row(s)")
                    if skipped:
                        print(f"  [match_points] {len(skipped)} name(s) not in players table")
                elif skipped:
                    print(
                        f"  [match_points] 0 rows — no catalog match "
                        f"(sample: {skipped[:5]})"
                    )
            updated.append(
                {
                    "api_match_id": match_id,
                    "match_date": f.get("match_date") or "",
                    "title": f.get("title") or f.get("match_name") or "",
                    "team1_short": f.get("team1_short") or "",
                    "team2_short": f.get("team2_short") or "",
                }
            )
            time.sleep(sleep_s)
    finally:
        if cr_zip and os.path.isfile(cr_zip):
            try:
                os.unlink(cr_zip)
            except OSError:
                pass

    # Expose outputs for GitHub Actions (used to decide whether to email participants)
    gh_out = os.getenv("GITHUB_OUTPUT")
    if gh_out:
        try:
            with open(gh_out, "a", encoding="utf-8") as fh:
                fh.write(f"target_date={target_date or today_ist_date_str(datetime.now(timezone.utc))}\n")
                fh.write(f"updated_count={len(updated)}\n")
                details_lines = []
                for u in updated:
                    md = u.get("match_date") or ""
                    teams = ""
                    if u.get("team1_short") or u.get("team2_short"):
                        teams = f"{u.get('team1_short','')} vs {u.get('team2_short','')}".strip()
                    title = u.get("title") or ""
                    core = title or teams or (u.get("api_match_id") or "")
                    date_prefix = f"{md} — " if md else ""
                    team_suffix = f" — {teams}" if teams and teams not in core else ""
                    details_lines.append(f"- {date_prefix}{core}{team_suffix} ({u.get('api_match_id')})")
                fh.write("updated_details<<EOF\n")
                fh.write("\n".join(details_lines) + ("\n" if details_lines else ""))
                fh.write("EOF\n")
        except Exception as e:
            print(f"WARNING: failed writing GITHUB_OUTPUT: {e}")

    print("Done.")


if __name__ == "__main__":
    main()

