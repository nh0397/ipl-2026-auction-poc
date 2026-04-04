"""
When two innings exist, batting table N is sometimes paired with the wrong bowling table
from the DOM. Swap bowling (and optional squad_bowling) between innings[0] and [1]
if dismissal text `b <bowler>` matches the bowling rows better after swap.

Used by sync_scorecards_espn.py (and sync_engine.py) before persisting JSON.
"""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, List, Optional


def _clean_name(name: str) -> str:
    n = (name or "").replace("†", "").replace("(c)", "").replace("(vc)", "").replace("(s/r)", "")
    return n.strip()


def bowler_token_from_dismissal(dismissal: str) -> Optional[str]:
    d = (dismissal or "").strip()
    if not d or re.search(r"not out", d, re.I):
        return None
    m = re.search(r"\bb\s+([A-Za-zÀ-ÿ .'-]+?)\s*$", d, re.I) or re.search(r"\bb\s+([A-Za-zÀ-ÿ .'-]+)", d, re.I)
    if not m:
        return None
    parts = m.group(1).strip().split()
    if not parts:
        return None
    last = parts[-1].lower()
    return last if len(last) >= 2 else None


def bowling_rows_match_token(token: str, bowling: List[Dict[str, Any]]) -> bool:
    if not token:
        return False
    for bw in bowling or []:
        n = str(bw.get("bowler") or bw.get("name") or "").strip().lower()
        if not n or n == "bowling":
            continue
        parts = n.split()
        last = parts[-1].lower() if parts else ""
        if n == token or last == token or token in n:
            return True
    return False


def dismissal_bowling_consistency(inn: Dict[str, Any]) -> float:
    matched = 0
    total = 0
    for b in inn.get("batting") or []:
        tok = bowler_token_from_dismissal(str(b.get("dismissal") or ""))
        if not tok:
            continue
        total += 1
        if bowling_rows_match_token(tok, inn.get("bowling") or []):
            matched += 1
    if total == 0:
        return 0.5
    return matched / total


def squad_bowling_from_rows(bowling: List[Dict[str, Any]]) -> List[str]:
    out: List[str] = []
    for bw in bowling or []:
        raw = bw.get("bowler") or bw.get("name")
        if not raw:
            continue
        n = _clean_name(str(raw))
        if n and n != "BOWLING":
            out.append(n)
    return list(dict.fromkeys(out))


def align_bowling_opposition_innings(
    innings: List[Dict[str, Any]],
    *,
    on_swapped_refresh_bowling_team: Optional[Callable[[Dict[str, Any]], None]] = None,
    log_fn: Optional[Callable[[str], None]] = None,
) -> List[Dict[str, Any]]:
    """
    If exactly two innings and swapping bowling arrays improves dismissal↔bowler agreement,
    swap them. Optionally refresh `bowling_team` on each innings after swap via callback.
    """
    if len(innings) != 2:
        return innings

    a, b = innings[0], innings[1]
    bow_a = list(a.get("bowling") or [])
    bow_b = list(b.get("bowling") or [])

    as_is = dismissal_bowling_consistency(a) + dismissal_bowling_consistency(b)

    swapped_a = {**a, "bowling": bow_b, "squad_bowling": squad_bowling_from_rows(bow_b)}
    swapped_b = {**b, "bowling": bow_a, "squad_bowling": squad_bowling_from_rows(bow_a)}
    if_swapped = dismissal_bowling_consistency(swapped_a) + dismissal_bowling_consistency(swapped_b)

    if if_swapped > as_is + 0.01:
        if log_fn:
            log_fn(
                f"scorecard_innings_align: swapped bowling between innings "
                f"(dismissal match {as_is:.3f} -> {if_swapped:.3f})"
            )
        if on_swapped_refresh_bowling_team:
            on_swapped_refresh_bowling_team(swapped_a)
            on_swapped_refresh_bowling_team(swapped_b)
        return [swapped_a, swapped_b]

    return innings
