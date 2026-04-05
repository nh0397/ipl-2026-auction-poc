"""
Merge Cricsheet ball-by-ball dots onto each CricAPI scorecard bowling row (``0s`` / ``dot_balls``).

Imported by ``ipl_fantasy``, ``run_ipl_day``, and ``sync_scorecards_cricapi``. Matching: Cricsheet
bowler last name + franchise short vs API bowler last token + fielding team short (trailing ``W``
stripped on shortnames). Pass ``match_date`` (YYYY-MM-DD) and a path to ``ipl_json.zip``.
"""

from __future__ import annotations

import copy
import json
import re
import zipfile
from typing import Any, Dict, List, Optional, Tuple

from cricsheet_dot_logic import is_bowling_dot_ball
from cricsheet_player_teams import player_team_rows
from run_ipl_day import find_cricsheet_match_id

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


def _norm_name(s: str) -> str:
    n = (s or "").lower()
    n = re.sub(r"\(c\)|\(wk\)|[†*]", "", n)
    n = n.replace(".", "").strip()
    return re.sub(r"\s+", " ", n)


def _short_norm(raw: str) -> str:
    t = (raw or "").strip().upper()
    return t[:-1] if t.endswith("W") else t


def _last_token(name: str) -> str:
    parts = _norm_name(name).split()
    return parts[-1] if parts else ""


def _franchise_short(full: str, teams: List[str], short_a: str, short_b: str) -> str:
    s = CRICSHEET_TEAM_TO_SHORT.get(full, "")
    if s:
        return _short_norm(s)
    if len(teams) >= 2:
        if full == teams[0]:
            return _short_norm(short_a)
        if full == teams[1]:
            return _short_norm(short_b)
    return ""


def _load_cricsheet_match_json(zip_path: str, cricsheet_id: str) -> Dict[str, Any]:
    name = f"{cricsheet_id}.json"
    with zipfile.ZipFile(zip_path, "r") as zf:
        candidates = [n for n in zf.namelist() if n.endswith("/" + name) or n.endswith(name)]
        if not candidates:
            raise FileNotFoundError(f"{name} not in zip")
        raw = zf.read(candidates[0])
    return json.loads(raw.decode("utf-8"))


def _dots_by_bowler_one_innings(inning: Dict[str, Any]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for over in inning.get("overs") or []:
        for d in over.get("deliveries") or []:
            runs = d.get("runs") or {}
            extras = d.get("extras") or {}
            if not is_bowling_dot_ball(runs, extras):
                continue
            bo = (d.get("bowler") or "").strip()
            if bo:
                out[bo] = out.get(bo, 0) + 1
    return out


def _bowler_franchise_short_map(cr_data: Dict[str, Any]) -> Dict[str, str]:
    info = cr_data.get("info") or {}
    teams = list(info.get("teams") or [])
    short_a = CRICSHEET_TEAM_TO_SHORT.get(teams[0], teams[0]) if len(teams) > 0 else ""
    short_b = CRICSHEET_TEAM_TO_SHORT.get(teams[1], teams[1]) if len(teams) > 1 else ""
    _, _, exact = player_team_rows(cr_data)
    out: Dict[str, str] = {}
    for name, full_fr in exact.items():
        sh = _franchise_short(full_fr, teams, short_a, short_b)
        if sh:
            out[name] = sh
    return out


def _api_batting_team_full(inning_title: str, team_info: List[Dict[str, Any]]) -> str:
    low = (inning_title or "").lower()
    for t in team_info:
        nm = (t.get("name") or "").strip()
        if nm and nm.lower() in low:
            return nm
    return ""


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


def _find_cricsheet_batting_inning(
    cr_innings: List[Dict[str, Any]], batting_team_full: str
) -> Optional[Dict[str, Any]]:
    target = (batting_team_full or "").strip().lower()
    for inn in cr_innings:
        bt = (inn.get("team") or "").strip().lower()
        if bt == target or target in bt or bt in target:
            return inn
    return None


def _match_inning_dots_to_api_bowler(
    inning_dots: Dict[str, int],
    cs_team_by_name: Dict[str, str],
    api_bowler_name: str,
    fielding_short: str,
) -> int:
    """Sum dots for all Cricsheet names that match last name + fielding franchise."""
    api_last = _last_token(api_bowler_name)
    fsn = _short_norm(fielding_short)
    if not api_last or not fsn:
        return 0
    total = 0
    for cs_name, cnt in inning_dots.items():
        if _last_token(cs_name) != api_last:
            continue
        cst = cs_team_by_name.get(cs_name)
        if cst and _short_norm(cst) == fsn:
            total += cnt
    return total


def merge_dots_into_scorecard_data(
    data: Dict[str, Any],
    match_date: str,
    zip_path: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Returns (enriched_data, meta) where meta has cricsheet id, errors, etc.
    """
    meta: Dict[str, Any] = {"match_date": match_date, "cricsheet_match_id": None, "errors": []}
    teams = list(data.get("teams") or [])
    if len(teams) < 2:
        meta["errors"].append("scorecard.data.teams must have 2 teams")
        return data, meta

    t1, t2 = teams[0], teams[1]
    cid, readme_line = find_cricsheet_match_id(zip_path, match_date, t1, t2)
    if not cid:
        meta["errors"].append(f"No Cricsheet readme row for {match_date} {t1!r} vs {t2!r}")
        return data, meta
    meta["cricsheet_match_id"] = cid
    meta["cricsheet_readme_line"] = readme_line

    cr_data = _load_cricsheet_match_json(zip_path, cid)
    cs_team_by_name = _bowler_franchise_short_map(cr_data)
    cr_innings = cr_data.get("innings") or []

    out = copy.deepcopy(data)
    team_info = list(out.get("teamInfo") or [])
    sc = out.get("scorecard") or []

    for block in sc:
        inn_title = str(block.get("inning") or "")
        bat_full = _api_batting_team_full(inn_title, team_info)
        fld_short = _api_fielding_short(bat_full, team_info)
        cr_inn = _find_cricsheet_batting_inning(cr_innings, bat_full) if bat_full else None
        if not cr_inn:
            meta["errors"].append(f"No Cricsheet inning for API inning {inn_title!r}")
            inning_dots = {}
        else:
            inning_dots = _dots_by_bowler_one_innings(cr_inn)

        for row in block.get("bowling") or []:
            if not isinstance(row, dict):
                continue
            bowler = row.get("bowler") or {}
            bname = (bowler.get("name") or "").strip()
            if not bname:
                continue
            n = _match_inning_dots_to_api_bowler(
                inning_dots, cs_team_by_name, bname, fld_short
            )
            row["0s"] = n
            row["dot_balls"] = n

    if meta.get("cricsheet_match_id"):
        out["dots_merged_from_cricsheet"] = True
        out["cricsheet_match_id"] = meta["cricsheet_match_id"]
        if meta.get("cricsheet_readme_line"):
            out["cricsheet_readme_line"] = meta["cricsheet_readme_line"]
        agg: Dict[str, int] = {}
        for inn in cr_innings:
            d = _dots_by_bowler_one_innings(inn)
            for k, v in d.items():
                agg[k] = agg.get(k, 0) + v
        out["cricsheet_bowler_dots"] = agg

    return out, meta
