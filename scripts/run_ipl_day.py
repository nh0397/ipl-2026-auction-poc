#!/usr/bin/env python3
"""
One entrypoint for a calendar day (IST):

  fixtures_cricapi where match_date = 'YYYY-MM-DD' (same as: select * … where match_date = $day) → api_match_id → …
  → Cricsheet ipl_json.zip → merge dot balls onto each scorecard bowling row (+ aggregate map)
  → Supabase PATCH scorecard + points_synced + fixtureapi_points
  → Upsert public.match_points (needs fixtures_cricapi.match_no + public.matches + name match on players)

Everything lives in this file until you outgrow it.

Usage:
  python3 scripts/run_ipl_day.py --date 2026-04-02
  python3 scripts/run_ipl_day.py                      # today (IST)

Env: .env with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or anon),
     NEXT_PUBLIC_CRICAPI_KEY or CRICAPI_KEY.
Optional: CRICAPI_SCORECARD_SLEEP_SECONDS (default 1.0)

Cricsheet: always downloads a fresh ipl_json.zip each run (URL updates often; CI runners are clean anyway).
"""

from __future__ import annotations

import argparse
import os
import re
import tempfile
import time
import zipfile
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

# ── bootstrap ───────────────────────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "../.env"))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SB_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ACCESS_TOKEN") or SUPABASE_KEY
CRICAPI_KEY = os.getenv("NEXT_PUBLIC_CRICAPI_KEY") or os.getenv("CRICAPI_KEY")
CRICAPI_BASE = "https://api.cricapi.com/v1"
FIXTURES_TABLE = "fixtures_cricapi"
CRICSHEET_ZIP_URL = "https://cricsheet.org/downloads/ipl_json.zip"

HEADERS = {
    "apikey": SB_SERVICE_KEY,
    "Authorization": f"Bearer {SB_SERVICE_KEY}",
    "Content-Type": "application/json",
}


def today_ist_date_str(now_utc: datetime) -> str:
    ist = now_utc.astimezone(timezone(timedelta(hours=5, minutes=30)))
    return ist.strftime("%Y-%m-%d")


def fetch_cricapi_scorecard(api_match_id: str) -> Dict[str, Any]:
    res = requests.get(
        f"{CRICAPI_BASE}/match_scorecard",
        params={"apikey": CRICAPI_KEY, "id": api_match_id},
        timeout=45,
    )
    res.raise_for_status()
    payload = res.json()
    if payload.get("status") != "success":
        raise RuntimeError(f"CricAPI match_scorecard failed: {payload}")
    return dict(payload.get("data") or {})


def list_fixtures_for_day(match_date_ist: Optional[str]) -> List[Dict[str, Any]]:
    """
    Equivalent SQL:

        select * from fixtures_cricapi
        where match_date = 'YYYY-MM-DD'
        order by date_time_gmt asc;

    CricAPI key column: api_match_id. We still need id (and team names) for PATCH + Cricsheet.
    """
    now_utc = datetime.now(timezone.utc)
    target = match_date_ist or today_ist_date_str(now_utc)
    url = f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}"
    params = {
        "select": "*",
        "match_date": f"eq.{target}",
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


def update_fixture_and_sync_flag(fixture_id: str, api_match_id: str, scorecard: Dict[str, Any]) -> None:
    patch_url = f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}?id=eq.{fixture_id}"
    r = requests.patch(
        patch_url,
        headers=HEADERS,
        json={"scorecard": scorecard, "points_synced": True},
        timeout=30,
    )
    r.raise_for_status()
    fap = f"{SUPABASE_URL}/rest/v1/fixtureapi_points"
    r2 = requests.post(
        fap,
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        json={"api_match_id": api_match_id, "synced": True},
        timeout=30,
    )
    r2.raise_for_status()


# ── Cricsheet: readme → id → {id}.json → dots per bowler (PJ-style) ──────────


def download_cricsheet_zip_fresh() -> str:
    """Download to a temp path; caller must delete. No disk cache — bundle updates frequently."""
    print("  [cricsheet] downloading fresh ipl_json.zip …")
    r = requests.get(CRICSHEET_ZIP_URL, timeout=120)
    r.raise_for_status()
    tf = tempfile.NamedTemporaryFile(prefix="ipl_json_", suffix=".zip", delete=False)
    try:
        tf.write(r.content)
        tf.close()
        print(f"  [cricsheet] {len(r.content) // 1024} KB (temp, deleted after run)")
        return tf.name
    except Exception:
        tf.close()
        try:
            os.unlink(tf.name)
        except OSError:
            pass
        raise


def read_zip_text(zip_path: str, member_name: str) -> Optional[str]:
    with zipfile.ZipFile(zip_path, "r") as zf:
        try:
            return zf.read(member_name).decode("utf-8", errors="replace")
        except KeyError:
            return None


def find_readme_member(zf: zipfile.ZipFile) -> Optional[str]:
    for n in zf.namelist():
        low = n.lower()
        if low.endswith("readme.txt") or low.endswith("readme"):
            return n
    return None


def parse_readme_line(line: str) -> Optional[Tuple[str, str, str]]:
    """
    Cricsheet IPL readme lines look like:
    2026-04-02 - club - IPL - male - 1527679 - Sunrisers Hyderabad vs Kolkata Knight Riders
    → (2026-04-02, 1527679, full title)
    """
    parts = [p.strip() for p in line.strip().split(" - ")]
    if len(parts) < 6:
        return None
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", parts[0]):
        return None
    if not parts[4].isdigit():
        return None
    title = " - ".join(parts[5:])
    return parts[0], parts[4], title


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def teams_match_readme_title(team1: str, team2: str, title_lower: str) -> bool:
    """Both franchises appear in readme title (handles long names / RCB vs Bengaluru)."""
    a, b = _norm(team1), _norm(team2)
    if not a or not b:
        return False
    if a in title_lower and b in title_lower:
        return True
    # last significant token (e.g. Hyderabad, Riders)
    for t in (a, b):
        for tok in t.split():
            if len(tok) >= 4 and tok in title_lower:
                break
        else:
            return False
    return True


def find_cricsheet_match_id(
    zip_path: str, match_date: str, team1_name: str, team2_name: str
) -> Tuple[Optional[str], Optional[str]]:
    """
    Scan readme inside zip for match_date + both teams → numeric id for {id}.json.
    Returns (match_id, readme_line_matched) or (None, None).
    """
    with zipfile.ZipFile(zip_path, "r") as zf:
        rn = find_readme_member(zf)
        if not rn:
            return None, None
        text = zf.read(rn).decode("utf-8", errors="replace")
    for line in text.splitlines():
        p = parse_readme_line(line)
        if not p:
            continue
        d, cid, title = p
        if d != match_date:
            continue
        tl = title.lower()
        if teams_match_readme_title(team1_name, team2_name, tl):
            return cid, line.strip()
    return None, None


# ── main ────────────────────────────────────────────────────────────────────


def main() -> None:
    if not SUPABASE_URL or not SB_SERVICE_KEY:
        raise SystemExit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    if not CRICAPI_KEY:
        raise SystemExit("Missing NEXT_PUBLIC_CRICAPI_KEY (or CRICAPI_KEY) in .env")

    ap = argparse.ArgumentParser(
        description="Select fixtures_cricapi by match_date, then CricAPI scorecard + optional Cricsheet dots."
    )
    ap.add_argument("--date", default=None, help="IST YYYY-MM-DD (default: today IST)")
    ap.add_argument(
        "--skip-cricsheet",
        action="store_true",
        help="Only CricAPI scorecard (no zip / readme / dots).",
    )
    ap.add_argument(
        "--skip-match-points",
        action="store_true",
        help="Do not upsert public.match_points after saving the scorecard.",
    )
    args = ap.parse_args()
    if args.date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(args.date).strip()):
        raise SystemExit(f"Bad --date (want YYYY-MM-DD): {args.date!r}")

    sleep_s = float(os.getenv("CRICAPI_SCORECARD_SLEEP_SECONDS", "1.0"))
    target = str(args.date).strip() if args.date else None
    label = target or today_ist_date_str(datetime.now(timezone.utc))
    fixtures = list_fixtures_for_day(target)
    print(f"IST date: {label} — {len(fixtures)} row(s) from fixtures_cricapi where match_date = {label!r}.")

    zip_path: Optional[str] = None
    zip_ready = False
    if fixtures and not args.skip_cricsheet:
        try:
            zip_path = download_cricsheet_zip_fresh()
            zip_ready = True
        except Exception as e:
            print(f"  WARNING: cricsheet zip unavailable ({e}); continuing without dots.")

    players_by_name: Dict[str, str] = {}
    if not args.skip_match_points:
        try:
            from cricapi_match_points import fetch_players_name_map

            players_by_name = fetch_players_name_map()
            print(f"  [match_points] loaded {len(players_by_name)} player name(s) for catalog match")
        except Exception as e:
            print(f"  WARNING: match_points disabled (could not load players): {e}")

    updated: List[Dict[str, Any]] = []
    try:
        for i, fx in enumerate(fixtures, start=1):
            fid = fx.get("id")
            api_mid = fx.get("api_match_id")
            if not fid or not api_mid:
                continue
            md = fx.get("match_date") or label
            t1 = fx.get("team1_name") or fx.get("team1_short") or ""
            t2 = fx.get("team2_name") or fx.get("team2_short") or ""
            print(f"[{i}/{len(fixtures)}] CricAPI scorecard api_match_id={api_mid} …")
            sc = fetch_cricapi_scorecard(str(api_mid))

            if zip_ready and zip_path and not args.skip_cricsheet:
                from merge_cricsheet_dots_into_scorecard import merge_dots_into_scorecard_data

                sc, dot_meta = merge_dots_into_scorecard_data(sc, str(md), zip_path)
                if dot_meta.get("cricsheet_match_id"):
                    print(
                        f"  cricsheet {dot_meta['cricsheet_match_id']} — "
                        f"dots on bowling rows + aggregate map"
                    )
                for err in dot_meta.get("errors") or []:
                    print(f"  [dots] {err}")

            update_fixture_and_sync_flag(str(fid), str(api_mid), sc)
            print(f"  stored + synced fixture_id={fid}")

            if not args.skip_match_points and players_by_name:
                from cricapi_match_points import persist_match_points_from_scorecard

                n_pts, skipped, mp_err = persist_match_points_from_scorecard(
                    str(api_mid), sc, fx.get("match_no"), players_by_name
                )
                if mp_err:
                    print(f"  [match_points] {mp_err}")
                elif n_pts:
                    print(f"  [match_points] upserted {n_pts} row(s)")
                    if skipped:
                        print(f"  [match_points] {len(skipped)} name(s) not in players table")
                elif skipped:
                    print(
                        f"  [match_points] 0 rows — no catalog match for scorecard names "
                        f"(sample: {skipped[:5]})"
                    )
            updated.append(
                {
                    "api_match_id": api_mid,
                    "match_date": fx.get("match_date") or "",
                    "title": fx.get("title") or fx.get("match_name") or "",
                    "team1_short": fx.get("team1_short") or "",
                    "team2_short": fx.get("team2_short") or "",
                }
            )
            time.sleep(sleep_s)
    finally:
        if zip_path and os.path.isfile(zip_path):
            try:
                os.unlink(zip_path)
            except OSError:
                pass

    gh_out = os.getenv("GITHUB_OUTPUT")
    if gh_out:
        try:
            with open(gh_out, "a", encoding="utf-8") as fh:
                fh.write(f"target_date={target or today_ist_date_str(datetime.now(timezone.utc))}\n")
                fh.write(f"updated_count={len(updated)}\n")
                details_lines = []
                for u in updated:
                    md = u.get("match_date") or ""
                    teams = ""
                    if u.get("team1_short") or u.get("team2_short"):
                        teams = f"{u.get('team1_short', '')} vs {u.get('team2_short', '')}".strip()
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
