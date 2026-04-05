#!/usr/bin/env python3
"""
Cricsheet IPL: map each player name (as in ball-by-ball / dot maps) to franchise team,
plus normalized keys to match other sources (CricAPI, ESPN) where spellings differ.

Primary source: info.players — { "Team Full Name": ["V Kohli", ...], ... }
Fallback: infer from innings (batting side vs fielding side) for names missing from roster.

Usage:
  python3 scripts/cricsheet_player_teams.py --match-id 1527679
  python3 scripts/cricsheet_player_teams.py --date 2026-04-02 --team1 Sunrisers --team2 Kolkata
  python3 scripts/cricsheet_player_teams.py --json-file /path/to/1527679.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

from cricsheet_ball_by_ball import (
    download_zip_to_temp,
    find_match_id_for_teams,
    list_matches_on_date,
    load_match_json_from_zip,
)
from cricsheet_dot_logic import is_bowling_dot_ball


def norm_key(s: str) -> str:
    """Lowercase, collapse whitespace — use for fuzzy joins."""
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def name_tokens(display_name: str) -> Tuple[str, str]:
    """(last_name_lower, first_initial) e.g. 'V Kohli' -> ('kohli', 'v')."""
    parts = norm_key(display_name).split()
    if not parts:
        return ("", "")
    last = parts[-1]
    first0 = parts[0][0] if parts[0] else ""
    return (last, first0)


def roster_from_info_players(info: Dict[str, Any]) -> Tuple[List[str], Dict[str, str]]:
    """
    Cricsheet: info.players is { team_name: [player_display_name, ...], ... }.
    Returns (ordered_teams, exact_name -> team).
    """
    teams = list(info.get("teams") or [])
    raw = info.get("players")
    out: Dict[str, str] = {}
    if not isinstance(raw, dict):
        return teams, out
    for team_name, names in raw.items():
        if not isinstance(names, list):
            continue
        for n in names:
            if not n or not isinstance(n, str):
                continue
            s = n.strip()
            if s:
                out[s] = str(team_name).strip()
    return teams, out


def _other_team(teams: List[str], batting: str) -> str:
    if len(teams) != 2 or not batting:
        return ""
    for t in teams:
        if t != batting:
            return t
    return ""


def infer_from_innings(data: Dict[str, Any], teams: List[str]) -> Dict[str, str]:
    """
    For each delivery: batter & non-striker → batting team; bowler → other team.
    Wicket player_out → batting team (dismissed striker is from batting side).
    """
    inferred: Dict[str, str] = {}
    for inning in data.get("innings") or []:
        bat_team = (inning.get("team") or "").strip()
        bowl_team = _other_team(teams, bat_team)
        if not bat_team:
            continue
        for over in inning.get("overs") or []:
            for delivery in over.get("deliveries") or []:
                b = (delivery.get("batter") or "").strip()
                ns = (delivery.get("non_striker") or "").strip()
                bo = (delivery.get("bowler") or "").strip()
                if b:
                    inferred[b] = bat_team
                if ns:
                    inferred[ns] = bat_team
                if bo and bowl_team:
                    inferred[bo] = bowl_team
                for w in delivery.get("wickets") or []:
                    po = (w.get("player_out") or "").strip()
                    if po:
                        inferred[po] = bat_team
    return inferred


def merge_roster_and_inferred(
    roster: Dict[str, str], inferred: Dict[str, str]
) -> Dict[str, str]:
    """Roster wins on conflict; inferred fills gaps."""
    out = dict(inferred)
    out.update(roster)
    return out


def build_norm_index(name_to_team: Dict[str, str]) -> Dict[str, str]:
    """norm_key(display_name) -> team (first wins if duplicate norms)."""
    idx: Dict[str, str] = {}
    for name, team in name_to_team.items():
        k = norm_key(name)
        if k and k not in idx:
            idx[k] = team
    return idx


def player_team_rows(
    data: Dict[str, Any],
) -> Tuple[List[str], List[Dict[str, Any]], Dict[str, str]]:
    """
    Returns:
      teams — info.teams order
      rows — one dict per distinct player name with team + matching hints
      exact_name_to_team — map as used for dot / ball-by-ball names
    """
    info = data.get("info") or {}
    teams, roster = roster_from_info_players(info)
    inferred = infer_from_innings(data, teams)
    exact = merge_roster_and_inferred(roster, inferred)

    seen: Set[str] = set()
    rows: List[Dict[str, Any]] = []
    for name in sorted(exact.keys(), key=lambda x: norm_key(x)):
        if name in seen:
            continue
        seen.add(name)
        last, finit = name_tokens(name)
        rows.append(
            {
                "cricsheet_name": name,
                "team": exact[name],
                "norm": norm_key(name),
                "last_name": last,
                "first_initial": finit,
            }
        )
    return teams, rows, exact


def team_for_bowler_name(
    bowler_display_name: str,
    exact_map: Dict[str, str],
    norm_index: Dict[str, str],
) -> Optional[str]:
    """Resolve team for a name string from dot totals / deliveries."""
    if bowler_display_name in exact_map:
        return exact_map[bowler_display_name]
    k = norm_key(bowler_display_name)
    if k in norm_index:
        return norm_index[k]
    last, finit = name_tokens(bowler_display_name)
    if last and finit:
        candidates = [
            (n, t)
            for n, t in exact_map.items()
            if name_tokens(n) == (last, finit)
        ]
        if len(candidates) == 1:
            return candidates[0][1]
    return None


def bowler_dots_with_teams(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Per bowler: dot count + team (for joining to other APIs)."""
    teams, _rows, exact = player_team_rows(data)
    norm_idx = build_norm_index(exact)
    dots: Dict[str, int] = {}
    for inning in data.get("innings") or []:
        for over in inning.get("overs") or []:
            for delivery in over.get("deliveries") or []:
                runs = delivery.get("runs") or {}
                extras = delivery.get("extras") or {}
                if not is_bowling_dot_ball(runs, extras):
                    continue
                bo = (delivery.get("bowler") or "").strip()
                if bo:
                    dots[bo] = dots.get(bo, 0) + 1
    out: List[Dict[str, Any]] = []
    for name in sorted(dots.keys(), key=lambda x: (-dots[x], x)):
        team = team_for_bowler_name(name, exact, norm_idx)
        last, finit = name_tokens(name)
        out.append(
            {
                "bowler": name,
                "dots": dots[name],
                "team": team,
                "norm": norm_key(name),
                "last_name": last,
                "first_initial": finit,
            }
        )
    return out


def export_payload(
    cricsheet_match_id: str,
    readme_line: Optional[str],
    data: Dict[str, Any],
) -> Dict[str, Any]:
    info = data.get("info") or {}
    teams, players, exact = player_team_rows(data)
    norm_idx = build_norm_index(exact)
    return {
        "cricsheet_match_id": cricsheet_match_id,
        "readme_line": readme_line,
        "teams": teams,
        "venue": info.get("venue"),
        "dates": info.get("dates"),
        "players": players,
        "norm_to_team": norm_idx,
        "bowler_dots_with_teams": bowler_dots_with_teams(data),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Cricsheet player → team map + matching hints")
    ap.add_argument("--date", help="Readme date YYYY-MM-DD")
    ap.add_argument("--match-id", dest="match_id")
    ap.add_argument("--team1", help="With --date when multiple matches")
    ap.add_argument("--team2", help="With --date when multiple matches")
    ap.add_argument("--zip", help="Path to ipl_json.zip")
    ap.add_argument("--json-file", dest="json_file", help="Use local match JSON instead of zip")
    args = ap.parse_args()

    if not args.json_file and not args.match_id and not args.date:
        ap.error("Provide --json-file, or --match-id, or --date")

    tmp_zip: Optional[str] = None
    zip_path = args.zip
    match_id: Optional[str] = args.match_id
    readme_line: Optional[str] = None
    data: Dict[str, Any]

    if args.json_file:
        with open(args.json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        match_id = match_id or (data.get("info") or {}).get("id") or os.path.splitext(os.path.basename(args.json_file))[0]
        readme_line = readme_line or args.json_file
    else:
        if not zip_path:
            tmp_zip = download_zip_to_temp()
            zip_path = tmp_zip
        assert zip_path is not None
        try:
            if match_id:
                readme_line = f"(direct --match-id {match_id})"
            elif args.date:
                matches = list_matches_on_date(zip_path, args.date.strip())
                if not matches:
                    print(f"No readme entries for date {args.date!r}.", file=sys.stderr)
                    sys.exit(1)
                if len(matches) > 1 and not (args.team1 and args.team2):
                    for cid, line, title in matches:
                        print(f"{cid}\t{title}", file=sys.stderr)
                    sys.exit(2)
                if args.team1 and args.team2:
                    match_id, readme_line = find_match_id_for_teams(
                        zip_path, args.date.strip(), args.team1, args.team2
                    )
                    if not match_id:
                        sys.exit(1)
                else:
                    match_id, readme_line, _ = matches[0]
            assert match_id is not None
            data = load_match_json_from_zip(zip_path, match_id)
        finally:
            if tmp_zip:
                try:
                    os.unlink(tmp_zip)
                except OSError:
                    pass

    payload = export_payload(str(match_id), readme_line, data)
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
