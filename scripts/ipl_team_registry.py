"""
IPL franchise labels → canonical short codes (aligned with app `lib/utils.ts` iplColors).

Used by ESPN scraper for toss resolution and `first_innings_batting_short`.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

# Canonical shorts (10 teams). RCBW is CricAPI-only; ESPN uses full "Royal Challengers Bengaluru".
IPL_SHORT_CODES: Tuple[str, ...] = ("CSK", "MI", "RCB", "KKR", "DC", "GT", "LSG", "PBKS", "RR", "SRH")

# (short, substrings to match in lowercased text) — order: more specific first where needed
IPL_ALIASES: List[Tuple[str, Tuple[str, ...]]] = [
    ("CSK", ("chennai super kings", "chennai super king")),
    ("MI", ("mumbai indians", "mumbai indian")),
    ("RCB", ("royal challengers bengaluru", "royal challengers bangalore", "royal challengers")),
    ("KKR", ("kolkata knight riders", "kolkata knight")),
    ("DC", ("delhi capitals", "delhi capital")),
    ("GT", ("gujarat titans", "gujarat titan")),
    ("LSG", ("lucknow super giants", "lucknow super giant")),
    ("PBKS", ("punjab kings", "punjab king")),
    ("RR", ("rajasthan royals", "rajasthan royal")),
    ("SRH", ("sunrisers hyderabad", "sunriser hyderabad")),
]


def normalize_team_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def ipl_short_for_label(label: str) -> str:
    """Return CSK/MI/… if `label` matches a known franchise; else ''."""
    n = normalize_team_text(label)
    if not n:
        return ""
    for short, needles in IPL_ALIASES:
        for needle in needles:
            if needle in n or n in needle:
                return short
    # Already a short code
    up = label.strip().upper()
    if up in IPL_SHORT_CODES:
        return up
    if up == "RCBW":
        return "RCB"
    return ""


def same_franchise(a: str, b: str) -> bool:
    """True if two ESPN/title strings refer to the same IPL franchise."""
    if not a or not b:
        return False
    na, nb = normalize_team_text(a), normalize_team_text(b)
    if na == nb:
        return True
    if na in nb or nb in na:
        return True
    sa, sb = ipl_short_for_label(a), ipl_short_for_label(b)
    return bool(sa and sb and sa == sb)


def first_batting_team_from_toss(toss_value: str, home: str, away: str) -> Optional[str]:
    """
    Parse ESPN Match Details toss cell, e.g. 'Punjab Kings, elected to field first'.
    Returns the **full** franchise string from `home`/`away` that batted first, or None.
    """
    raw = (toss_value or "").strip()
    if not raw:
        return None
    m = re.match(r"^(.+?),\s*elected to\s+(bat|field)\s+first", raw, re.I)
    if not m:
        return None
    winner_fragment = re.sub(r"\s+", " ", m.group(1)).strip()
    elected = m.group(2).lower()
    home_c, away_c = (home or "").strip(), (away or "").strip()
    if not home_c or not away_c:
        return None

    winner_is_home = same_franchise(winner_fragment, home_c)
    winner_is_away = same_franchise(winner_fragment, away_c)
    if not winner_is_home and not winner_is_away:
        return None

    if elected == "bat":
        return home_c if winner_is_home else away_c
    return away_c if winner_is_home else home_c
