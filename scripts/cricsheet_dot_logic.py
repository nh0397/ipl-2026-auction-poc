"""
Cricsheet JSON: bowling "dot" = striker scores 0 off the bat (runs.batter == 0), and the
ball is not a wide or no-ball. Leg-byes / byes (batter 0, total 1) count as dots here.
"""

from __future__ import annotations

from typing import Any


def is_bowling_dot_ball(runs: Any, extras: Any) -> bool:
    if not isinstance(runs, dict):
        return False
    ex = extras if isinstance(extras, dict) else {}
    if "wides" in ex or "noballs" in ex:
        return False
    return int(runs.get("batter", 0) or 0) == 0
