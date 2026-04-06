# ============================================================
# ipl_fantasy.py — Config + Cricsheet modules + CricAPI + scoring
# Does not write to Supabase or match_points. For DB + match_points use run_ipl_day.py
# (or sync_scorecards_cricapi.py after this change).
# ============================================================
import argparse
import csv
import io
import json
import os
import re
import time
import zipfile
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

from cricsheet_dot_logic import is_bowling_dot_ball
from cricsheet_player_teams import player_team_rows
from merge_cricsheet_dots_into_scorecard import merge_dots_into_scorecard_data
from run_ipl_day import download_cricsheet_zip_fresh

load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

# ================== CONFIG ==================
API_KEY = os.getenv("NEXT_PUBLIC_CRICAPI_KEY") or os.getenv("CRICAPI_KEY")
BASE_URL = "https://api.cricapi.com/v1"
IPL_2026_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f"
# Optional legacy CSV path; use --csv if you want a spreadsheet export.
CSV_OUTPUT = os.path.expanduser("~/Documents/ipl_2026_fantasy_points7c.csv")
DEFAULT_JSON_OUTPUT = os.path.join(os.path.dirname(__file__), "ipl_fantasy_output.json")
CACHE_DIR = os.path.expanduser("~/Documents/ipl_scorecard_cache")
# Repo-local snapshots (see scripts/save_cricapi_scorecard_snapshot.py)
SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cricapi_scorecard_snapshots")
CRICSHEET_CACHE_DIR = os.path.expanduser("~/Documents/ipl_cricsheet_cache")
CRICSHEET_ZIP_URL = "https://cricsheet.org/downloads/ipl_json.zip"
MODE = "daily"  # "daily" or "season"
# ============================================


os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(CRICSHEET_CACHE_DIR, exist_ok=True)

IST = timezone(timedelta(hours=5, minutes=30))


def today_ist_date_str() -> str:
    """Calendar date YYYY-MM-DD in Asia/Kolkata (IST)."""
    return datetime.now(IST).strftime("%Y-%m-%d")


def normalize_api_date(raw) -> str:
    """CricAPI match `date` or ISO datetime -> YYYY-MM-DD."""
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    if "T" in s:
        return s.split("T")[0][:10]
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return ""


def match_list_calendar_date(m: Dict) -> str:
    return normalize_api_date(m.get("date")) or normalize_api_date(m.get("dateTimeGMT"))


def filter_matches_by_ist_date(matches: List[Dict], target_yyyy_mm_dd: str) -> List[Dict]:
    return [m for m in matches if match_list_calendar_date(m) == target_yyyy_mm_dd]


CRICSHEET_TEAM_TO_SHORT = {
    "Royal Challengers Bengaluru": "RCB",
    "Royal Challengers Bangalore": "RCB",
    "Sunrisers Hyderabad": "SRH",
    "Mumbai Indians": "MI",
    "Kolkata Knight Riders": "KKR",
    "Chennai Super Kings": "CSK",
    "Rajasthan Royals": "RR",
    "Gujarat Titans": "GT",
    "Punjab Kings": "PBKS",
    "Kings XI Punjab": "PBKS",
    "Lucknow Super Giants": "LSG",
    "Delhi Capitals": "DC",
    "Delhi Daredevils": "DC",
}


_cricsheet_index: Optional[Dict] = None
_cricsheet_bbb_index: Optional[Dict] = None  # for dot balls + fielding from BBB


SPECIAL_NAME_MAP = {
    "phil salt": "phil salt",
    "philip salt": "phil salt",
    "so hetmyer": "shimron hetmyer",
}


CRICSHEET_ONLY_PLAYER_MAP = {
    "so hetmyer": ("Shimron Hetmyer", "RR"),
}


def _cricsheet_index_path() -> str:
    # v2: entries include bowler_team_short for last-name + franchise matching to CricAPI
    return os.path.join(CRICSHEET_CACHE_DIR, f"dots_v2_{date.today().strftime('%Y%m%d')}.json")


def _cricsheet_bbb_index_path() -> str:
    return os.path.join(CRICSHEET_CACHE_DIR, f"bbb_{date.today().strftime('%Y%m%d')}.json")


def _norm(name: str) -> str:
    n = name.lower()
    n = re.sub(r"\(c\)|\(wk\)|[†*]", "", n)
    n = n.replace(".", "").strip()
    return re.sub(r"\s+", " ", n)


def _tokens(name: str) -> Tuple[str, str]:
    parts = _norm(name).split()
    if not parts:
        return ("", "")
    last = parts[-1]
    first_initial = parts[0][0] if parts[0] else ""
    return (last, first_initial)


def _fielder_name(f) -> str:
    if isinstance(f, str):
        return f
    if isinstance(f, dict):
        return f.get("name", "") or f.get("player", "") or ""
    return ""


def _build_name_lookups(players: Dict) -> Tuple[Dict, Dict]:
    full_lkp: Dict[str, str] = {}
    token_lkp: Dict[Tuple, str] = {}
    for pid, p in players.items():
        raw = p["player_name"]
        full_lkp[_norm(raw)] = pid
        tok = _tokens(raw)
        if tok[0]:
            token_lkp[tok] = pid
    return full_lkp, token_lkp


def _resolve_pid(cs_name: str, full_lkp: Dict, token_lkp: Dict) -> Optional[str]:
    norm = _norm(cs_name)
    alias = SPECIAL_NAME_MAP.get(norm)
    if alias:
        norm = alias

    pid = full_lkp.get(norm)
    if pid:
        return pid

    tok = _tokens(cs_name)
    pid = token_lkp.get(tok)
    if pid:
        return pid

    last = tok[0]
    if last:
        candidates = [pid for (t_last, _), pid in token_lkp.items() if t_last == last]
        if len(candidates) == 1:
            return candidates[0]

    if len(norm) >= 5:
        for k_norm, pid in full_lkp.items():
            if norm in k_norm or k_norm in norm:
                return pid

    cs_parts = set(t for t in norm.split() if len(t) >= 5)
    if cs_parts:
        overlap_candidates = []
        for k_norm, pid in full_lkp.items():
            api_parts = set(t for t in k_norm.split() if len(t) >= 5)
            if cs_parts & api_parts:
                overlap_candidates.append(pid)
        if len(overlap_candidates) == 1:
            return overlap_candidates[0]

    return None


def _get_or_create_cricsheet_only_player(
    cs_name: str,
    players: Dict,
    team_a: str,
    team_b: str,
    match_id: str,
    match_name: str,
    match_date: str,
    match_winner: str,
) -> Optional[str]:
    norm = _norm(cs_name)
    cfg = CRICSHEET_ONLY_PLAYER_MAP.get(norm)
    if not cfg:
        return None

    canonical_name, default_team = cfg
    pid = f"cs_{match_date}_{default_team}_{norm}"

    if pid not in players:
        players[pid] = {
            "player_id": pid,
            "player_name": canonical_name,
            "team": default_team,
            "match_id": match_id,
            "match_name": match_name,
            "date": match_date,
            "match_winner": match_winner,
            "is_captain": False,
            "is_vice_captain": False,
            "in_announced_lineup": True,
            "is_playing_substitute": False,
            "batting": {
                "runs": 0,
                "balls": 0,
                "fours": 0,
                "sixes": 0,
                "dismissal": "not out",
            },
            "bowling": {
                "overs": 0.0,
                "maidens": 0,
                "runs_conceded": 0,
                "wickets": 0,
                "lbw_bowled_wickets": 0,
                "dot_balls": 0,
            },
            "fielding": {
                "catches": 0,
                "stumpings": 0,
                "runout_direct": 0,
                "runout_indirect": 0,
            },
        }

    return pid


def _cricsheet_franchise_short(full_name: str, teams: List[str], short_a: str, short_b: str) -> str:
    s = CRICSHEET_TEAM_TO_SHORT.get(full_name, "")
    if s:
        return s
    if full_name == teams[0]:
        return short_a
    if full_name == teams[1]:
        return short_b
    return ""


def _build_cricsheet_index() -> Dict:
    print("  [Cricsheet] Downloading IPL zip (~3.9 MB)...")
    r = requests.get(CRICSHEET_ZIP_URL, timeout=60)
    r.raise_for_status()
    print(f"  [Cricsheet] Downloaded {len(r.content) // 1024} KB")
    index: Dict[str, Any] = {}
    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        names = [n for n in zf.namelist() if n.endswith(".json")]
        print(f"  [Cricsheet] Parsing {len(names)} match files...")
        for name in names:
            try:
                data = json.loads(zf.read(name))
                info = data.get("info", {})
                dates = info.get("dates", [])
                teams = info.get("teams", [])
                if not dates or len(teams) < 2:
                    continue
                match_date = dates[0]
                short_a = CRICSHEET_TEAM_TO_SHORT.get(teams[0], teams[0])
                short_b = CRICSHEET_TEAM_TO_SHORT.get(teams[1], teams[1])

                dots: Dict[str, int] = {}
                for inning in data.get("innings", []):
                    for over in inning.get("overs", []):
                        for delivery in over.get("deliveries", []):
                            extras = delivery.get("extras", {})
                            runs = delivery.get("runs", {})
                            bowler = delivery.get("bowler", "")
                            if not bowler:
                                continue
                            if is_bowling_dot_ball(runs, extras):
                                dots[bowler] = dots.get(bowler, 0) + 1

                if dots:
                    _, _, exact_name_team = player_team_rows(data)
                    bowler_team_short: Dict[str, str] = {}
                    for bn in dots:
                        full_fr = exact_name_team.get(bn)
                        if full_fr:
                            sh = _cricsheet_franchise_short(full_fr, teams, short_a, short_b)
                            if sh:
                                bowler_team_short[bn] = sh
                    payload = {"dots": dots, "bowler_team_short": bowler_team_short}
                    key1 = f"{match_date}|{short_a}|{short_b}"
                    key2 = f"{match_date}|{short_b}|{short_a}"
                    index[key1] = payload
                    index[key2] = payload
            except Exception:
                pass
    return index


def _build_cricsheet_bbb_index() -> Dict:
    print("  [Cricsheet] Downloading IPL BBB zip (~3.9 MB)...")
    r = requests.get(CRICSHEET_ZIP_URL, timeout=60)
    r.raise_for_status()
    print(f"  [Cricsheet] Downloaded {len(r.content) // 1024} KB for BBB")
    idx: Dict[str, Dict] = {}
    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        names = [n for n in zf.namelist() if n.endswith(".json")]
        print(f"  [Cricsheet] Parsing {len(names)} match BBB files...")
        for name in names:
            try:
                data = json.loads(zf.read(name))
                info = data.get("info", {})
                dates = info.get("dates", [])
                teams = info.get("teams", [])
                if not dates or len(teams) < 2:
                    continue
                match_date = dates[0]
                short_a = CRICSHEET_TEAM_TO_SHORT.get(teams[0], teams[0])
                short_b = CRICSHEET_TEAM_TO_SHORT.get(teams[1], teams[1])

                key1 = f"{match_date}|{short_a}|{short_b}"
                key2 = f"{match_date}|{short_b}|{short_a}"

                bowl_dots: Dict[str, int] = {}
                fielding: Dict[str, Dict[str, int]] = {}

                for inning in data.get("innings", []):
                    for over in inning.get("overs", []):
                        for delivery in over.get("deliveries", []):
                            runs = delivery.get("runs", {})
                            extras = delivery.get("extras", {})
                            bowler = delivery.get("bowler", "")

                            if bowler and is_bowling_dot_ball(runs, extras):
                                bowl_dots[bowler] = bowl_dots.get(bowler, 0) + 1

                            for w in delivery.get("wickets", []):
                                kind = w.get("kind", "")
                                fld_list = w.get("fielders", []) or []

                                if kind not in (
                                    "caught",
                                    "caught and bowled",
                                    "stumped",
                                    "run out",
                                ):
                                    continue

                                if kind == "caught":
                                    for f in fld_list:
                                        name_f = _fielder_name(f)
                                        if not name_f:
                                            continue
                                        dct = fielding.setdefault(
                                            name_f,
                                            {
                                                "catches": 0,
                                                "stumpings": 0,
                                                "runout_direct": 0,
                                                "runout_indirect": 0,
                                            },
                                        )
                                        dct["catches"] += 1

                                elif kind == "caught and bowled":
                                    name_f = bowler
                                    if name_f:
                                        dct = fielding.setdefault(
                                            name_f,
                                            {
                                                "catches": 0,
                                                "stumpings": 0,
                                                "runout_direct": 0,
                                                "runout_indirect": 0,
                                            },
                                        )
                                        dct["catches"] += 1

                                elif kind == "stumped":
                                    for f in fld_list:
                                        name_f = _fielder_name(f)
                                        if not name_f:
                                            continue
                                        dct = fielding.setdefault(
                                            name_f,
                                            {
                                                "catches": 0,
                                                "stumpings": 0,
                                                "runout_direct": 0,
                                                "runout_indirect": 0,
                                            },
                                        )
                                        dct["stumpings"] += 1

                                elif kind == "run out":
                                    if not fld_list:
                                        continue
                                    for i, f in enumerate(fld_list):
                                        name_f = _fielder_name(f)
                                        if not name_f:
                                            continue
                                        dct = fielding.setdefault(
                                            name_f,
                                            {
                                                "catches": 0,
                                                "stumpings": 0,
                                                "runout_direct": 0,
                                                "runout_indirect": 0,
                                            },
                                        )
                                        if i == 0:
                                            dct["runout_direct"] += 1
                                        else:
                                            dct["runout_indirect"] += 1

                if "Royal Challengers" in " ".join(teams) and "Sunrisers Hyderabad" in " ".join(teams):
                    print("  [debug BBB] match_date:", match_date, "teams:", teams)
                    print("  [debug BBB] fielding keys:", list(fielding.keys())[:20])

                if bowl_dots or fielding:
                    idx[key1] = {"dots": bowl_dots, "fielding": fielding}
                    idx[key2] = {"dots": bowl_dots, "fielding": fielding}
            except Exception as e:
                print("  [Cricsheet] ERROR parsing BBB file", name, ":", e)
    print("  [Cricsheet] BBB index built, total keys:", len(idx))
    return idx


def get_cricsheet_index() -> Dict:
    global _cricsheet_index
    if _cricsheet_index is not None:
        return _cricsheet_index
    path = _cricsheet_index_path()
    if os.path.exists(path):
        print("  [Cricsheet] Loading cached dot-ball index")
        with open(path, "r", encoding="utf-8") as f:
            _cricsheet_index = json.load(f)
        return _cricsheet_index
    _cricsheet_index = _build_cricsheet_index()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(_cricsheet_index, f)
    print(f"  [Cricsheet] Index built & saved ({len(_cricsheet_index) // 2} matches)")
    return _cricsheet_index


def get_cricsheet_bbb_index() -> Dict:
    global _cricsheet_bbb_index
    if _cricsheet_bbb_index is not None:
        return _cricsheet_bbb_index
    path = _cricsheet_bbb_index_path()
    if os.path.exists(path):
        print("  [Cricsheet] Loading cached BBB index")
        with open(path, "r", encoding="utf-8") as f:
            _cricsheet_bbb_index = json.load(f)
        return _cricsheet_bbb_index
    _cricsheet_bbb_index = _build_cricsheet_bbb_index()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(_cricsheet_bbb_index, f)
    print(f"  [Cricsheet] BBB index built & saved ({len(_cricsheet_bbb_index) // 2} matches)")
    return _cricsheet_bbb_index


def _parse_cricsheet_dot_entry(entry: Any) -> Tuple[Dict[str, int], Dict[str, str]]:
    """New index: { dots, bowler_team_short }. Legacy: flat name -> int."""
    if not isinstance(entry, dict):
        return {}, {}
    if "dots" in entry:
        raw = entry.get("dots") or {}
        try:
            dots_clean = {str(k): int(v) for k, v in raw.items()}
        except (TypeError, ValueError):
            dots_clean = {}
        teams_short = entry.get("bowler_team_short") or {}
        return dots_clean, dict(teams_short) if isinstance(teams_short, dict) else {}
    if entry and all(isinstance(v, int) for v in entry.values()):
        return dict(entry), {}
    return {}, {}


def get_dot_balls_for_match(match_date_str: str, team_a: str, team_b: str) -> Dict[str, int]:
    idx = get_cricsheet_index()
    print("  [debug] dot key lookup:", match_date_str, team_a, team_b)
    entry = idx.get(f"{match_date_str}|{team_a}|{team_b}") or idx.get(
        f"{match_date_str}|{team_b}|{team_a}", {}
    )
    dots, _ = _parse_cricsheet_dot_entry(entry)
    if not dots:
        print(f"  [Cricsheet] No dot data for {match_date_str}|{team_a}|{team_b}")
    return dots


def _api_team_short_norm(team: str) -> str:
    t = (team or "").strip().upper()
    return t[:-1] if t.endswith("W") else t


def _last_name_for_dots_match(name: str) -> str:
    parts = _norm(name).split()
    return parts[-1] if parts else ""


def enrich_dot_balls(players: Dict, match_date: str, team_a: str, team_b: str) -> None:
    idx = get_cricsheet_index()
    entry = idx.get(f"{match_date}|{team_a}|{team_b}") or idx.get(
        f"{match_date}|{team_b}|{team_a}", {}
    )
    dots_map, cs_bowler_team_short = _parse_cricsheet_dot_entry(entry)
    if not dots_map:
        return

    full_lkp, token_lkp = _build_name_lookups(players)
    matched, unmatched = 0, []

    for cs_name, dot_count in dots_map.items():
        pid: Optional[str] = None
        cs_short = _api_team_short_norm(cs_bowler_team_short.get(cs_name, ""))
        cs_last = _last_name_for_dots_match(cs_name)

        if cs_short and cs_last:
            candidates = [
                p_id
                for p_id, p in players.items()
                if _last_name_for_dots_match(p["player_name"]) == cs_last
                and _api_team_short_norm(p.get("team", "")) == cs_short
            ]
            if len(candidates) == 1:
                pid = candidates[0]
            elif len(candidates) > 1:
                pid = _resolve_pid(cs_name, full_lkp, token_lkp)
                if pid not in candidates:
                    pid = None
            else:
                pid = None

        if not pid:
            pid = _resolve_pid(cs_name, full_lkp, token_lkp)

        if pid:
            players[pid]["bowling"]["dot_balls"] += dot_count
            matched += 1
        else:
            unmatched.append(cs_name)

    mode = "last+team" if any(cs_bowler_team_short.values()) else "legacy"
    print(
        f"  [dots] {matched}/{len(dots_map)} bowlers matched ({mode})"
        + (f" | unmatched: {unmatched}" if unmatched else "")
    )


def enrich_fielding_from_cricsheet(players: Dict, match_date: str, team_a: str, team_b: str) -> None:
    idx = get_cricsheet_bbb_index()
    print("  [debug] BBB keys sample:", list(idx.keys())[:10])
    entry = idx.get(f"{match_date}|{team_a}|{team_b}") or idx.get(
        f"{match_date}|{team_b}|{team_a}", {}
    )
    field_map = entry.get("fielding", {})
    print("  [debug] fielding entry keys:", entry.keys())
    print("  [debug] fielders:", list(field_map.keys())[:50])
    if not field_map:
        print(f"  [Cricsheet] No fielding BBB data for {match_date}|{team_a}|{team_b}")
        return

    full_lkp, token_lkp = _build_name_lookups(players)

    api_names = {_norm(p["player_name"]) for p in players.values() if p["player_name"]}
    cs_names = {_norm(n) for n in field_map.keys()}
    only_in_cs = sorted(cs_names - api_names)
    only_in_api = sorted(api_names - cs_names)
    print(f"  [debug] Cricsheet-only fielders: {only_in_cs}")
    print(f"  [debug] API-only players (no CS fielding entry): {only_in_api[:20]}")

    matched, unmatched = 0, []
    sample_p = next(iter(players.values())) if players else {
        "match_id": "",
        "match_name": "",
        "match_winner": "",
    }

    for cs_name, stats in field_map.items():
        pid = _resolve_pid(cs_name, full_lkp, token_lkp)

        if not pid:
            pid = _get_or_create_cricsheet_only_player(
                cs_name,
                players,
                team_a,
                team_b,
                sample_p.get("match_id", ""),
                sample_p.get("match_name", ""),
                match_date,
                sample_p.get("match_winner", ""),
            )
            if pid and pid not in full_lkp.values():
                full_lkp, token_lkp = _build_name_lookups(players)

        if not pid:
            unmatched.append(cs_name)
            continue

        fld = players[pid]["fielding"]
        for k in ("catches", "stumpings", "runout_direct", "runout_indirect"):
            api_val = fld.get(k, 0) or 0
            cs_val = stats.get(k, 0) or 0
            if api_val == 0 and cs_val > 0:
                fld[k] = cs_val
        matched += 1

    print(
        f"  [fielding] {matched}/{len(field_map)} fielders matched"
        + (f" | unmatched: {unmatched}" if unmatched else "")
    )


# --- CricAPI fetchers + transform ---


def overs_to_float(raw_overs) -> float:
    o = float(raw_overs or 0)
    full = int(o)
    balls = round((o - full) * 10)
    return full + balls / 6.0


def check_hits(data: dict):
    info = data.get("info", {})
    used = info.get("hitsToday", 0)
    limit = info.get("hitsLimit", 100)
    left = limit - used
    print(f"    [API] {used}/{limit} hits used today ({left} remaining)")
    if left <= 5:
        raise RuntimeError(
            f"API hits nearly exhausted: {used}/{limit}. "
            "Quota resets midnight IST (~6:30 PM CDT)."
        )


def _unwrap_snapshot_payload(raw: Any) -> Optional[Dict]:
    """Snapshot file may be { data, cricapi_match_id, ... } or raw scorecard `data` only."""
    if not isinstance(raw, dict):
        return None
    if "data" in raw and isinstance(raw["data"], dict):
        return raw["data"]
    return raw


def _load_scorecard_snapshot_for_cricapi_id(match_id: str) -> Optional[Dict]:
    """Load from SNAPSHOT_DIR: direct {match_id}.json or any file whose cricapi_match_id / data.id matches."""
    if not os.path.isdir(SNAPSHOT_DIR):
        return None
    mid = str(match_id).strip()

    direct = os.path.join(SNAPSHOT_DIR, f"{mid}.json")
    if os.path.isfile(direct):
        try:
            with open(direct, "r", encoding="utf-8") as f:
                raw = json.load(f)
            data = _unwrap_snapshot_payload(raw)
            if data:
                print(f"    [snapshot] loaded {direct}")
                return data
        except (OSError, json.JSONDecodeError):
            pass

    try:
        names = sorted(os.listdir(SNAPSHOT_DIR))
    except OSError:
        return None
    for fn in names:
        if not fn.endswith(".json"):
            continue
        p = os.path.join(SNAPSHOT_DIR, fn)
        try:
            with open(p, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(raw, dict):
            continue
        cid = str(raw.get("cricapi_match_id") or "").strip()
        inner = raw.get("data") if isinstance(raw.get("data"), dict) else {}
        data_id = str(inner.get("id") or "").strip()
        if cid == mid or data_id == mid:
            print(f"    [snapshot] loaded {p} (cricapi_match_id match)")
            return inner
    return None


def load_cache(match_id: str):
    path = os.path.join(CACHE_DIR, f"{match_id}.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            print(f"    [cache] loaded {match_id}")
            return json.load(f)
    snap = _load_scorecard_snapshot_for_cricapi_id(match_id)
    if snap is not None:
        return snap
    return None


def save_cache(match_id: str, data: dict):
    path = os.path.join(CACHE_DIR, f"{match_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)


def fetch_current_matches() -> List[Dict]:
    if not API_KEY:
        raise RuntimeError("Set NEXT_PUBLIC_CRICAPI_KEY (or CRICAPI_KEY) in .env")
    r = requests.get(
        f"{BASE_URL}/currentMatches", params={"apikey": API_KEY, "offset": 0}, timeout=15
    )
    r.raise_for_status()
    d = r.json()
    check_hits(d)
    all_m = d.get("data", [])
    ipl = []
    for m in all_m:
        sid = m.get("series_id", "")
        if isinstance(sid, list):
            if IPL_2026_SERIES_ID in sid:
                ipl.append(m)
        elif IPL_2026_SERIES_ID in str(sid):
            ipl.append(m)
    print(f"IPL matches found: {len(ipl)} (of {len(all_m)} total)")
    return ipl


def fetch_series_matches() -> List[Dict]:
    if not API_KEY:
        raise RuntimeError("Set NEXT_PUBLIC_CRICAPI_KEY (or CRICAPI_KEY) in .env")
    r = requests.get(
        f"{BASE_URL}/series_info",
        params={"apikey": API_KEY, "id": IPL_2026_SERIES_ID},
        timeout=15,
    )
    r.raise_for_status()
    d = r.json()
    check_hits(d)
    ml = d.get("data", {}).get("matchList", [])
    started = [m for m in ml if m.get("matchStarted")]
    print(f"IPL 2026: {len(started)} of {len(ml)} matches started")
    return started


def fetch_scorecard(match_id: str) -> Dict:
    if not API_KEY:
        raise RuntimeError("Set NEXT_PUBLIC_CRICAPI_KEY (or CRICAPI_KEY) in .env")
    cached = load_cache(match_id)
    if cached:
        return cached
    time.sleep(1)
    r = requests.get(
        f"{BASE_URL}/match_scorecard",
        params={"apikey": API_KEY, "id": match_id},
        timeout=15,
    )
    r.raise_for_status()
    d = r.json()
    check_hits(d)
    if d.get("status") != "success":
        reason = d.get("reason", "")
        if "hits" in reason.lower() or "blocked" in reason.lower():
            raise RuntimeError("API daily limit reached. Resets midnight IST.")
        raise RuntimeError(f"Scorecard error {match_id}: {d}")
    data = d.get("data", {})
    save_cache(match_id, data)
    return data


def transform(
    match_id: str, sc: Dict, *, skip_legacy_dot_enrich: bool = False
) -> List[Dict]:
    team_info = sc.get("teamInfo", [])
    players: Dict[str, Dict] = {}

    def get_p(pid: str, name: str) -> Dict:
        if pid not in players:
            players[pid] = {
                "player_id": pid,
                "player_name": name,
                "team": "",
                "match_id": sc.get("id", match_id),
                "match_name": sc.get("name", ""),
                "date": sc.get("date", ""),
                "match_winner": sc.get("matchWinner", ""),
                "is_captain": False,
                "is_vice_captain": False,
                "in_announced_lineup": True,
                "is_playing_substitute": False,
                "batting": {
                    "runs": 0,
                    "balls": 0,
                    "fours": 0,
                    "sixes": 0,
                    "dismissal": "not out",
                },
                "bowling": {
                    "overs": 0.0,
                    "maidens": 0,
                    "runs_conceded": 0,
                    "wickets": 0,
                    "lbw_bowled_wickets": 0,
                    "dot_balls": 0,
                },
                "fielding": {
                    "catches": 0,
                    "stumpings": 0,
                    "runout_direct": 0,
                    "runout_indirect": 0,
                },
            }
        return players[pid]

    team_map: Dict[str, str] = {}
    for inning in sc.get("scorecard", []):
        inn_name = inning.get("inning", "")
        inn_team = ""
        for t in team_info:
            t_name = t.get("name", "").lower()
            if t_name and t_name in inn_name.lower():
                inn_team = t.get("shortname", "")
                break
        for b in inning.get("batting", []):
            pid = b.get("batsman", {}).get("id", "")
            if pid and inn_team:
                team_map[pid] = inn_team

    for squad_entry in sc.get("squadData", []):
        s_team = ""
        for t in team_info:
            if t.get("name", "").lower() in squad_entry.get("team", "").lower():
                s_team = t.get("shortname", "")
                break
        if not s_team:
            s_team = squad_entry.get("shortname", "")
        for player in squad_entry.get("players", []):
            pid = player.get("id", "")
            if pid and pid not in team_map and s_team:
                team_map[pid] = s_team

    for squad_entry in sc.get("squadData", []):
        for player in squad_entry.get("players", []):
            pid = player.get("id", "")
            name = player.get("name", "")
            if not pid:
                continue
            p = get_p(pid, name)
            if not p["team"]:
                p["team"] = team_map.get(pid, "")

    bowler_pid_map: Dict[str, str] = {}
    for inning in sc.get("scorecard", []):
        for b in inning.get("bowling", []):
            bpid = b.get("bowler", {}).get("id", "")
            bname = b.get("bowler", {}).get("name", "")
            if bpid and bname:
                bowler_pid_map[bname.lower()] = bpid

    for inning in sc.get("scorecard", []):
        for b in inning.get("batting", []):
            pid = b.get("batsman", {}).get("id", "")
            name = b.get("batsman", {}).get("name", "")
            if not pid:
                continue
            p = get_p(pid, name)
            p["team"] = team_map.get(pid, "")
            bat = p["batting"]
            bat["runs"] += b.get("r", 0) or 0
            bat["balls"] += b.get("b", 0) or 0
            bat["fours"] += b.get("4s", 0) or 0
            bat["sixes"] += b.get("6s", 0) or 0
            d = b.get("dismissal", "")
            if d:
                bat["dismissal"] = d
            dismissal_type = d.lower().strip()
            if dismissal_type in ("bowled", "lbw"):
                bowler_pid = b.get("bowler", {}).get("id", "")
                bowler_name = b.get("bowler", {}).get("name", "")
                if not bowler_pid and bowler_name:
                    bowler_pid = bowler_pid_map.get(bowler_name.lower(), "")
                if bowler_pid:
                    get_p(bowler_pid, bowler_name)["bowling"]["lbw_bowled_wickets"] += 1

        for b in inning.get("bowling", []):
            pid = b.get("bowler", {}).get("id", "")
            name = b.get("bowler", {}).get("name", "")
            if not pid:
                continue
            p = get_p(pid, name)
            if not p["team"]:
                p["team"] = team_map.get(pid, "")
            bwl = p["bowling"]
            bwl["overs"] += overs_to_float(b.get("o", 0))
            bwl["maidens"] += b.get("m", 0) or 0
            bwl["runs_conceded"] += b.get("r", 0) or 0
            bwl["wickets"] += b.get("w", 0) or 0
            dots_row = b.get("dot_balls")
            if dots_row is None:
                dots_row = b.get("0s")
            try:
                bwl["dot_balls"] += int(dots_row or 0)
            except (TypeError, ValueError):
                pass

        for c in inning.get("catching", []):
            catcher = c.get("catcher", {})
            pid = catcher.get("id", "")
            name = catcher.get("name", "")
            if not pid:
                continue
            p = get_p(pid, name)
            if not p["team"]:
                p["team"] = team_map.get(pid, "")
            fld = p["fielding"]
            fld["catches"] += (c.get("catch", 0) or 0) + (c.get("cb", 0) or 0)
            fld["stumpings"] += c.get("stumped", 0) or 0
            fld["runout_direct"] += c.get("runout", 0) or 0

    for pid, p in players.items():
        if not p["team"]:
            p["team"] = team_map.get(pid, "")

    match_date = sc.get("date", "")
    shorts = [
        re.sub(r"W$", "", t.get("shortname", "")) for t in team_info if t.get("shortname")
    ]
    print("  [debug] match_date:", match_date, "shorts:", shorts)
    effective_skip_dots = skip_legacy_dot_enrich or bool(
        (sc or {}).get("dots_merged_from_cricsheet")
    )
    if len(shorts) >= 2 and match_date:
        if not effective_skip_dots:
            enrich_dot_balls(players, match_date, shorts[0], shorts[1])
        enrich_fielding_from_cricsheet(players, match_date, shorts[0], shorts[1])
    else:
        print("  [Cricsheet] Skipping dots/fielding - missing date or team shorts")

    return list(players.values())


# --- Scoring ---


def bat_pts(bat: Dict) -> int:
    runs = bat.get("runs", 0) or 0
    balls = bat.get("balls", 0) or 0
    fours = bat.get("fours", 0) or 0
    sixes = bat.get("sixes", 0) or 0
    d = (bat.get("dismissal") or "").lower()
    is_dismissed = d not in ("", "not out", "retired hurt")

    pts = runs + fours * 4 + sixes * 6

    if runs >= 100:
        pts += 16
    elif runs >= 75:
        pts += 12
    elif runs >= 50:
        pts += 8
    elif runs >= 25:
        pts += 4

    if runs == 0 and is_dismissed:
        pts -= 2

    if balls >= 10:
        sr = (runs / balls) * 100
        if sr > 170:
            pts += 6
        elif sr >= 150.01:
            pts += 4
        elif sr >= 130:
            pts += 2
        elif 60 <= sr < 70:
            pts -= 2
        elif 50 <= sr < 60:
            pts -= 4
        elif sr < 50:
            pts -= 6

    return pts


def bowl_pts(bwl: Dict) -> int:
    overs = bwl.get("overs", 0) or 0
    maidens = bwl.get("maidens", 0) or 0
    runs_c = bwl.get("runs_conceded", 0) or 0
    wickets = bwl.get("wickets", 0) or 0
    lbw_b = bwl.get("lbw_bowled_wickets", 0) or 0
    dots = bwl.get("dot_balls", 0) or 0

    pts = dots + wickets * 30 + lbw_b * 8

    if wickets >= 5:
        pts += 12
    elif wickets == 4:
        pts += 8
    elif wickets == 3:
        pts += 4

    pts += maidens * 12

    if overs >= 2:
        eco = runs_c / overs
        if eco < 5:
            pts += 6
        elif eco <= 5.99:
            pts += 4
        elif eco <= 7:
            pts += 2
        elif eco <= 9:
            pass
        elif eco <= 11:
            pts -= 2
        elif eco <= 12:
            pts -= 4
        else:
            pts -= 6

    return pts


def field_pts(fld: Dict) -> int:
    catches = fld.get("catches", 0) or 0
    pts = catches * 8
    if catches >= 3:
        pts += 4
    pts += (fld.get("stumpings", 0) or 0) * 12
    pts += (fld.get("runout_direct", 0) or 0) * 12
    pts += (fld.get("runout_indirect", 0) or 0) * 6
    return pts


def d11_applied_multiplier(runs: int, wickets: int) -> float:
    """Dream11-style haul tiers on total base (must match lib/scoring.ts d11BonusMultiplierInfo)."""
    r = max(0, int(runs) if runs is not None else 0)
    w = max(0, int(wickets) if wickets is not None else 0)

    run_mult = 1.0
    if r >= 150:
        run_mult = 4.0
    elif r >= 100:
        run_mult = 3.0
    elif r >= 75:
        run_mult = 1.75
    elif r >= 45:
        run_mult = 1.5
    elif r >= 25:
        run_mult = 1.25

    wk_mult = 1.0
    if w >= 5:
        wk_mult = 4.0
    elif w >= 3:
        wk_mult = 2.0
    elif w == 2:
        wk_mult = 1.5

    return max(run_mult, wk_mult)


def pj_base_total(p: Dict) -> float:
    """PJ rules base only (no haul, no C/VC) — matches score_player when C/VC are false."""
    b = bat_pts(p.get("batting", {}))
    bw = bowl_pts(p.get("bowling", {}))
    f = field_pts(p.get("fielding", {}))
    extra = 4 if p.get("in_announced_lineup") else 0
    if p.get("is_playing_substitute"):
        extra += 4
    return float(b + bw + f + extra)


def pj_points_with_haul_multiplier(p: Dict) -> tuple[float, float]:
    """(base_pts, points_after_haul) — aligns with aggregateFantasyRowsFromCricApiMatchData + sync."""
    base = pj_base_total(p)
    bat = p.get("batting") or {}
    bwl = p.get("bowling") or {}
    r = int(bat.get("runs", 0) or 0)
    w = int(bwl.get("wickets", 0) or 0)
    haul = d11_applied_multiplier(r, w)
    total = round(base * haul * 100) / 100
    return round(base * 100) / 100, total


def score_player(p: Dict):
    b = bat_pts(p.get("batting", {}))
    bw = bowl_pts(p.get("bowling", {}))
    f = field_pts(p.get("fielding", {}))
    extra = 4 if p.get("in_announced_lineup") else 0
    if p.get("is_playing_substitute"):
        extra += 4
    base = b + bw + f + extra
    mult = 2.0 if p.get("is_captain") else (1.5 if p.get("is_vice_captain") else 1.0)
    return b, bw, f, extra, mult, round(base * mult, 2)


def extract_match_number(match_name: str) -> int:
    m = re.search(r"(\d+)(?:st|nd|rd|th)\s+Match", match_name, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return 0


def main():
    global MODE
    parser = argparse.ArgumentParser(description="IPL fantasy points from CricAPI + Cricsheet enrich.")
    parser.add_argument(
        "--mode",
        choices=("daily", "season"),
        default=None,
        help='Override MODE (default: config MODE or "daily").',
    )
    parser.add_argument(
        "--json-out",
        default=DEFAULT_JSON_OUTPUT,
        help=f"Write full parsed rows as JSON (default: {DEFAULT_JSON_OUTPUT}).",
    )
    parser.add_argument(
        "--csv",
        dest="csv_path",
        default=None,
        metavar="PATH",
        help=f"Optional: also write CSV (e.g. {CSV_OUTPUT}).",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=3,
        help="Print this many sample rows to stdout after parsing (0 to skip).",
    )
    parser.add_argument(
        "--date",
        default=None,
        metavar="YYYY-MM-DD",
        help="Only process matches on this calendar date (IST). Default: today (IST).",
    )
    parser.add_argument(
        "--skip-scorecard-dots",
        action="store_true",
        help="Do not merge Cricsheet dots into scorecard bowling rows (use legacy index only).",
    )
    args = parser.parse_args()
    if args.mode:
        MODE = args.mode

    if args.date:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(args.date).strip()):
            parser.error("--date must be YYYY-MM-DD")
        target_date = str(args.date).strip()
    else:
        target_date = today_ist_date_str()

    print(f"MODE: {MODE}")
    print(f"Target match date (IST calendar): {target_date}")

    matches = fetch_current_matches() if MODE == "daily" else fetch_series_matches()

    if not matches:
        print("No IPL matches found. Exiting.")
        return

    before = len(matches)
    matches = filter_matches_by_ist_date(matches, target_date)
    print(f"Matches on {target_date}: {len(matches)} (of {before} in list)")

    if not matches:
        print(f"No IPL matches scheduled/found for {target_date}. Exiting.")
        return

    all_rows = []

    cr_zip_path: Optional[str] = None
    if not args.skip_scorecard_dots:
        try:
            cr_zip_path = download_cricsheet_zip_fresh()
        except Exception as e:
            print(f"  [dots/scorecard] Cricsheet zip failed ({e}); legacy dot enrichment only")

    try:
        for m in matches:
            mid = m.get("id", "")
            name = m.get("name", "Unknown")
            if not mid:
                continue
            print(f"  Processing: {name} [{mid}]")
            try:
                sc = fetch_scorecard(mid)
                skip_legacy_dots = False
                if cr_zip_path and not args.skip_scorecard_dots:
                    md = normalize_api_date(sc.get("date"))
                    if md:
                        sc, dot_meta = merge_dots_into_scorecard_data(sc, md, cr_zip_path)
                        if dot_meta.get("cricsheet_match_id"):
                            skip_legacy_dots = True
                            print(
                                f"    [dots/scorecard] Cricsheet id {dot_meta['cricsheet_match_id']} "
                                f"(per-innings → bowling rows)"
                            )
                        for err in dot_meta.get("errors") or []:
                            print(f"    [dots/scorecard] {err}")
                match_number = extract_match_number(sc.get("name", name))
                players = transform(mid, sc, skip_legacy_dot_enrich=skip_legacy_dots)
                for p in players:
                    b, bw, f, ex, mult, total = score_player(p)
                    bat = p.get("batting", {})
                    bwl = p.get("bowling", {})
                    fld = p.get("fielding", {})
                    all_rows.append(
                        {
                            "match_number": match_number,
                            "match_id": p["match_id"],
                            "match_name": p["match_name"],
                            "date": p["date"],
                            "match_winner": p["match_winner"],
                            "team": p["team"],
                            "player_name": p["player_name"],
                            "runs": bat.get("runs", 0),
                            "balls": bat.get("balls", 0),
                            "fours": bat.get("fours", 0),
                            "sixes": bat.get("sixes", 0),
                            "dismissal": bat.get("dismissal", "not out"),
                            "overs": round(bwl.get("overs", 0.0), 2),
                            "maidens": bwl.get("maidens", 0),
                            "runs_conceded": bwl.get("runs_conceded", 0),
                            "wickets": bwl.get("wickets", 0),
                            "lbw_bowled_wickets": bwl.get("lbw_bowled_wickets", 0),
                            "dot_balls": bwl.get("dot_balls", 0),
                            "catches": fld.get("catches", 0),
                            "stumpings": fld.get("stumpings", 0),
                            "runout_direct": fld.get("runout_direct", 0),
                            "runout_indirect": fld.get("runout_indirect", 0),
                            "batting_pts": b,
                            "bowling_pts": bw,
                            "fielding_pts": f,
                            "extra_pts": ex,
                            "multiplier": mult,
                            "total_pts": total,
                        }
                    )
                print(f"    {len(players)} players scored")
            except Exception as e:
                print(f"    ERROR processing {name}: {e}")
    finally:
        if cr_zip_path and os.path.isfile(cr_zip_path):
            try:
                os.unlink(cr_zip_path)
            except OSError:
                pass

    if not all_rows:
        print("No data to write.")
        return

    all_rows.sort(key=lambda x: (x["match_number"], -x["total_pts"]))

    fields = list(all_rows[0].keys())
    print("\n--- Parsed row schema (field order) ---")
    for i, k in enumerate(fields, start=1):
        print(f"  {i:2}. {k}")

    json_path = os.path.abspath(args.json_out)
    os.makedirs(os.path.dirname(json_path) or ".", exist_ok=True)
    payload = {
        "target_date_ist": target_date,
        "row_count": len(all_rows),
        "fields": fields,
        "rows": all_rows,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"\nWrote JSON: {json_path} ({len(all_rows)} player rows)")

    if args.sample > 0:
        n = min(args.sample, len(all_rows))
        print(f"\n--- Sample rows (first {n}) ---")
        print(json.dumps(all_rows[:n], indent=2, ensure_ascii=False))

    if args.csv_path:
        csv_path = os.path.abspath(args.csv_path)
        os.makedirs(os.path.dirname(csv_path) or ".", exist_ok=True)
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            writer.writerows(all_rows)
        print(f"Also wrote CSV: {csv_path}")


if __name__ == "__main__":
    main()
