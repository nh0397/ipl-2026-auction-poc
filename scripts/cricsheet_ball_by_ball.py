#!/usr/bin/env python3
"""
Cricsheet IPL ball-by-ball: pick a calendar date, resolve the Cricsheet match id from
readme.txt inside ipl_json.zip, open {id}.json, and print (or emit JSON) per-delivery data.

This does not call CricAPI or Supabase — it only uses the public Cricsheet bundle:
  https://cricsheet.org/downloads/ipl_json.zip

Examples:
  python3 scripts/cricsheet_ball_by_ball.py --date 2026-04-02
  python3 scripts/cricsheet_ball_by_ball.py --date 2026-04-02 --team1 "Sunrisers" --team2 "Kolkata"
  python3 scripts/cricsheet_ball_by_ball.py --match-id 1527679
  python3 scripts/cricsheet_ball_by_ball.py --date 2026-04-02 --zip /path/to/ipl_json.zip --format json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import zipfile
from typing import Any, Dict, List, Optional, Tuple

import requests

from cricsheet_dot_logic import is_bowling_dot_ball

CRICSHEET_ZIP_URL = "https://cricsheet.org/downloads/ipl_json.zip"


# ── readme / id resolution (same rules as scripts/run_ipl_day.py) ─────────────


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


def find_readme_member(zf: zipfile.ZipFile) -> Optional[str]:
    for n in zf.namelist():
        low = n.lower()
        if low.endswith("readme.txt") or low.endswith("/readme.txt"):
            return n
    return None


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def teams_match_readme_title(team1: str, team2: str, title_lower: str) -> bool:
    a, b = _norm(team1), _norm(team2)
    if not a or not b:
        return False
    if a in title_lower and b in title_lower:
        return True
    for t in (a, b):
        for tok in t.split():
            if len(tok) >= 4 and tok in title_lower:
                break
        else:
            return False
    return True


def list_matches_on_date(zip_path: str, match_date: str) -> List[Tuple[str, str, str]]:
    """Return [(match_id, readme_line, title), ...] for that YYYY-MM-DD."""
    out: List[Tuple[str, str, str]] = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        rn = find_readme_member(zf)
        if not rn:
            return out
        text = zf.read(rn).decode("utf-8", errors="replace")
    for line in text.splitlines():
        p = parse_readme_line(line)
        if not p:
            continue
        d, cid, title = p
        if d == match_date:
            out.append((cid, line.strip(), title))
    return out


def find_match_id_for_teams(
    zip_path: str, match_date: str, team1: str, team2: str
) -> Tuple[Optional[str], Optional[str]]:
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
        if teams_match_readme_title(team1, team2, title.lower()):
            return cid, line.strip()
    return None, None


def load_match_json_from_zip(zip_path: str, cricsheet_id: str) -> Dict[str, Any]:
    name = f"{cricsheet_id}.json"
    with zipfile.ZipFile(zip_path, "r") as zf:
        candidates = [n for n in zf.namelist() if n.endswith("/" + name) or n.endswith(name)]
        if not candidates:
            raise FileNotFoundError(f"{name} not found in {zip_path}")
        raw = zf.read(candidates[0])
    return json.loads(raw.decode("utf-8"))


def download_zip_to_temp() -> str:
    print("Downloading fresh ipl_json.zip from cricsheet.org …", file=sys.stderr)
    r = requests.get(CRICSHEET_ZIP_URL, timeout=120)
    r.raise_for_status()
    tf = tempfile.NamedTemporaryFile(prefix="ipl_json_", suffix=".zip", delete=False)
    tf.write(r.content)
    tf.close()
    print(f"Saved {len(r.content) // 1024} KB to {tf.name}", file=sys.stderr)
    return tf.name


# ── ball-by-ball extraction ───────────────────────────────────────────────────


def iter_deliveries(
    data: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Flatten innings → overs → deliveries into one list with stable addressing.
    Each row: inning_idx, over_num, ball_idx, delivery (raw dict), meta.
    """
    rows: List[Dict[str, Any]] = []
    innings = data.get("innings") or []
    for inn_i, inning in enumerate(innings, start=1):
        team = inning.get("team") or ""
        overs = inning.get("overs") or []
        for over_idx, over_block in enumerate(overs):
            over_num = over_block.get("over")
            if over_num is None:
                over_num = over_idx
            deliveries = over_block.get("deliveries") or []
            for ball_i, delivery in enumerate(deliveries, start=1):
                runs = delivery.get("runs") or {}
                extras = delivery.get("extras") or {}
                is_batter_dot = is_bowling_dot_ball(runs, extras)
                rows.append(
                    {
                        "inning": inn_i,
                        "batting_team": team,
                        "over": over_num,
                        "ball": ball_i,
                        "batter": (delivery.get("batter") or "").strip(),
                        "bowler": (delivery.get("bowler") or "").strip(),
                        "non_striker": (delivery.get("non_striker") or "").strip(),
                        "runs": dict(runs) if isinstance(runs, dict) else runs,
                        "extras": dict(extras) if isinstance(extras, dict) else extras,
                        "wickets": delivery.get("wickets") or [],
                        "replacements": delivery.get("replacements"),
                        "is_bowling_dot": is_batter_dot,
                    }
                )
    return rows


def bowler_dot_totals_from_data(data: Dict[str, Any]) -> Dict[str, int]:
    """+1 per ball where runs.batter==0, not wide/no-ball (leg-byes count; see cricsheet_dot_logic)."""
    dots: Dict[str, int] = {}
    for row in iter_deliveries(data):
        if not row.get("is_bowling_dot"):
            continue
        b = row.get("bowler") or ""
        if b:
            dots[b] = dots.get(b, 0) + 1
    return dots


def format_text_line(row: Dict[str, Any]) -> str:
    inn = row["inning"]
    ov = row["over"]
    b = row["ball"]
    bowl = row["bowler"]
    bat = row["batter"]
    r = row["runs"]
    ex = row["extras"] or {}
    wk = row["wickets"] or []
    dot = " DOT" if row.get("is_bowling_dot") else ""
    wk_s = f" W:{wk}" if wk else ""
    return (
        f"{inn}.{ov}.{b}  {bowl} → {bat}  "
        f"runs={r} extras={ex}{dot}{wk_s}"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Cricsheet IPL ball-by-ball from {id}.json in ipl_json.zip")
    ap.add_argument("--date", help="Match date YYYY-MM-DD (readme calendar date)")
    ap.add_argument("--match-id", dest="match_id", help="Cricsheet numeric id (skips readme date lookup)")
    ap.add_argument("--team1", help="Substring to match first team in readme title (with --date)")
    ap.add_argument("--team2", help="Substring to match second team in readme title (with --date)")
    ap.add_argument("--zip", help="Path to existing ipl_json.zip (skip download)")
    ap.add_argument(
        "--format",
        choices=("text", "json"),
        default="text",
        help="Output format (default: text)",
    )
    ap.add_argument(
        "--list-only",
        action="store_true",
        help="Only list match ids/lines for --date, then exit",
    )
    ap.add_argument(
        "--no-dots-summary",
        action="store_true",
        help="Skip printing bowler dot totals at end (text mode)",
    )
    args = ap.parse_args()

    if not args.match_id and not args.date:
        ap.error("Provide --date YYYY-MM-DD or --match-id ID")

    zip_path = args.zip
    tmp_zip: Optional[str] = None
    if not zip_path:
        tmp_zip = download_zip_to_temp()
        zip_path = tmp_zip

    try:
        match_id: Optional[str] = args.match_id
        readme_line: Optional[str] = None

        if match_id:
            readme_line = f"(direct --match-id {match_id})"
        elif args.date:
            matches = list_matches_on_date(zip_path, args.date.strip())
            if not matches:
                print(f"No readme entries for date {args.date!r}.", file=sys.stderr)
                sys.exit(1)

            if args.list_only:
                for cid, line, title in matches:
                    print(f"{cid}\t{title}")
                    print(f"  {line}")
                return

            if len(matches) > 1 and not (args.team1 and args.team2):
                print(
                    f"Multiple matches on {args.date} — pick one with "
                    f"--team1 and --team2, or use --match-id:\n",
                    file=sys.stderr,
                )
                for cid, line, title in matches:
                    print(f"  id={cid}  {title}", file=sys.stderr)
                sys.exit(2)

            if args.team1 and args.team2:
                match_id, readme_line = find_match_id_for_teams(
                    zip_path, args.date.strip(), args.team1, args.team2
                )
                if not match_id:
                    print(
                        f"No readme row for {args.date!r} with teams "
                        f"{args.team1!r} vs {args.team2!r}.",
                        file=sys.stderr,
                    )
                    sys.exit(1)
            else:
                match_id, readme_line, _title = matches[0]
                if len(matches) > 1:
                    print(
                        "Warning: multiple matches on that date; using first in readme. "
                        "Pass --team1/--team2 to disambiguate.",
                        file=sys.stderr,
                    )

        assert match_id is not None
        data = load_match_json_from_zip(zip_path, match_id)
        info = data.get("info") or {}
        rows = iter_deliveries(data)
        dots = bowler_dot_totals_from_data(data)

        if args.format == "json":
            out = {
                "cricsheet_match_id": match_id,
                "readme_line": readme_line,
                "info": info,
                "deliveries": rows,
                "bowler_dot_totals": dots,
            }
            print(json.dumps(out, indent=2, default=str))
            return

        # text
        print(f"Cricsheet match id: {match_id}")
        if readme_line:
            print(f"Readme: {readme_line}")
        print(f"Teams: {info.get('teams')}")
        print(f"Dates: {info.get('dates')}")
        print(f"Venue: {info.get('venue')}")
        print("--- ball-by-ball ---")
        for row in rows:
            print(format_text_line(row))
        if not args.no_dots_summary:
            print("--- bowler dot totals (PJ-style legal 0-run balls) ---")
            for name in sorted(dots.keys(), key=lambda x: (-dots[x], x)):
                print(f"  {name}: {dots[name]}")
    finally:
        if tmp_zip and os.path.isfile(tmp_zip):
            try:
                os.unlink(tmp_zip)
            except OSError:
                pass


if __name__ == "__main__":
    main()
