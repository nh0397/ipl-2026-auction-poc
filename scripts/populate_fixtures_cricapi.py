import os
import re
import requests
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
# Service role key may be provided as either `SUPABASE_SERVICE_ROLE_KEY`
# or `SUPABASE_ACCESS_TOKEN` depending on how you stored secrets in GitHub.
SB_SERVICE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ACCESS_TOKEN")
    or SUPABASE_KEY
)

# Prefer NEXT_PUBLIC_CRICAPI_KEY (Next.js .env); CRICAPI_KEY is a fallback.
CRICAPI_KEY = os.getenv("NEXT_PUBLIC_CRICAPI_KEY") or os.getenv("CRICAPI_KEY")
CRICAPI_BASE_URL = "https://api.cricapi.com/v1"

IPL_2026_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f"

FIXTURES_TABLE = "fixtures_cricapi"

HEADERS = {
    "apikey": SB_SERVICE_KEY,
    "Authorization": f"Bearer {SB_SERVICE_KEY}",
    "Content-Type": "application/json",
    # Upsert behavior for "unique (api_match_id)" conflicts
    "Prefer": "resolution=merge-duplicates",
}


def parse_match_no(match_name: str) -> Optional[int]:
    # Examples: "31st Match", "8th Match", "1st Match", "70th Match"
    m = re.search(r"(\d+)(st|nd|rd|th)\s+Match", match_name or "", flags=re.IGNORECASE)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def fetch_series_matches(series_id: str) -> List[Dict[str, Any]]:
    if not CRICAPI_KEY:
        raise RuntimeError("Missing NEXT_PUBLIC_CRICAPI_KEY (or CRICAPI_KEY) in .env")

    res = requests.get(
        f"{CRICAPI_BASE_URL}/series_info",
        params={"apikey": CRICAPI_KEY, "id": series_id},
        timeout=30,
    )
    res.raise_for_status()
    payload = res.json()
    if payload.get("status") != "success":
        raise RuntimeError(f"CricAPI error: {payload}")
    match_list = payload.get("data", {}).get("matchList", []) or []
    return match_list


def to_fixture_row(m: Dict[str, Any]) -> Dict[str, Any]:
    team_info = m.get("teamInfo", []) or []

    t1 = team_info[0] if len(team_info) > 0 else {}
    t2 = team_info[1] if len(team_info) > 1 else {}

    match_name = m.get("name", "") or ""
    match_no = parse_match_no(match_name)

    return {
        "api_series_id": IPL_2026_SERIES_ID,
        "api_match_id": str(m.get("id", "")),
        "match_name": match_name,
        "title": f"Match {match_no}" if match_no else match_name,
        "match_no": match_no or 0,
        "match_type": m.get("matchType", ""),
        "status": m.get("status", ""),
        "venue": m.get("venue", ""),
        "match_date": m.get("date", None),
        "date_time_gmt": m.get("dateTimeGMT", None),
        "team1_name": t1.get("name", ""),
        "team1_short": t1.get("shortname", ""),
        "team1_img": t1.get("img", None),
        "team2_name": t2.get("name", ""),
        "team2_short": t2.get("shortname", ""),
        "team2_img": t2.get("img", None),
        "match_started": bool(m.get("matchStarted", False)),
        "match_ended": bool(m.get("matchEnded", False)),
        "has_squad": bool(m.get("hasSquad", False)),
        "fantasy_enabled": bool(m.get("fantasyEnabled", False)),
        "bbb_enabled": bool(m.get("bbbEnabled", False)),
        "teams": m.get("teams", []) or [],
        "team_info": team_info,
        "raw_match": m,
        # IMPORTANT:
        # Do NOT include scorecard/points_synced in the fixtures upsert payload.
        # This job runs repeatedly and would otherwise overwrite already-synced
        # scorecards/points flags (making prior days look "wiped").
    }


def upsert_fixtures(rows: List[Dict[str, Any]], batch_size: int = 50) -> None:
    if not rows:
        return

    # PostgREST upsert requires both:
    # - Prefer: resolution=merge-duplicates (header)
    # - on_conflict (query param)
    upsert_url = f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}?on_conflict=api_match_id"

    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        res = requests.post(
            upsert_url,
            headers=HEADERS,
            json=batch,
        )
        # Supabase returns 2xx/4xx; include body for debugging
        if res.status_code >= 400:
            body = res.text or ""
            # Common when you just altered the table: PostgREST schema cache hasn't refreshed yet.
            # Retry without the newly added columns so population can proceed.
            if res.status_code == 400 and "PGRST204" in body and "match_no" in body:
                print("  ⚠️  Schema cache missing 'match_no'. Retrying batch without match_no/title…")
                trimmed = []
                for r in batch:
                    r2 = dict(r)
                    r2.pop("match_no", None)
                    r2.pop("title", None)
                    trimmed.append(r2)
                res2 = requests.post(
                    f"{SUPABASE_URL}/rest/v1/{FIXTURES_TABLE}",
                    headers=HEADERS,
                    json=trimmed,
                )
                if res2.status_code >= 400:
                    raise RuntimeError(f"Upsert failed after retry: {res2.status_code}: {res2.text}")
            else:
                raise RuntimeError(f"Upsert failed: {res.status_code}: {res.text}")
        print(f"  ✅ upserted batch {i//batch_size + 1}/{(len(rows)-1)//batch_size + 1}")


def main() -> None:
    match_list = fetch_series_matches(IPL_2026_SERIES_ID)
    print(f"CricAPI returned matchList length={len(match_list)}")

    rows: List[Dict[str, Any]] = []
    for m in match_list:
        api_match_id = str(m.get("id", "")).strip()
        if not api_match_id:
            continue
        rows.append(to_fixture_row(m))

    print(f"Prepared rows: {len(rows)}")
    upsert_fixtures(rows)
    print("Done populating fixtures_cricapi.")


if __name__ == "__main__":
    main()

