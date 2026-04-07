import asyncio
import json
import re
import sys
import os
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from playwright.async_api import async_playwright, Page, Locator
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

import argparse

from scorecard_innings_align import align_bowling_opposition_innings, squad_bowling_from_rows
from ipl_team_registry import (
    first_batting_team_from_toss,
    ipl_short_for_label,
    same_franchise,
)

try:
    from playwright_stealth import stealth  # type: ignore
except Exception:
    stealth = None

# Supabase Config for Dynamic URL Discovery (Stripped of whitespace for safety)
SUPABASE_URL = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ACCESS_TOKEN")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
).strip()

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

SERIES_ID = "1510719"
OUTFILE = "scraped_scorecard.json"
DEBUG_HTML = "debug_scorecard.html"
DEBUG_PNG = "debug_scorecard.png"


def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def clean(value: Optional[str]) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def to_num(value: str) -> Any:
    value = clean(value)
    if value in {"", "-"}:
        return None
    try:
        if re.fullmatch(r"\d+", value):
            return int(value)
        if re.fullmatch(r"\d+\.\d+", value):
            return float(value)
    except Exception:
        pass
    return value


async def safe_text(locator: Locator) -> str:
    try:
        return clean(await locator.inner_text())
    except Exception:
        return ""


async def save_debug(page: Page, reason: str) -> None:
    log(f"Saving debug artifacts because: {reason}")
    try:
        await page.screenshot(path=DEBUG_PNG, full_page=True)
        log(f"Debug screenshot saved: {DEBUG_PNG}")
    except Exception as e:
        log(f"Could not save screenshot: {e}")

    try:
        html = await page.content()
        Path(DEBUG_HTML).write_text(html, encoding="utf-8")
        log(f"Debug HTML saved: {DEBUG_HTML}")
    except Exception as e:
        log(f"Could not save HTML: {e}")


async def dismiss_popups(page: Page) -> None:
    log("Checking for cookie/consent popups")
    selectors = [
        "button:has-text('Accept')",
        "button:has-text('I Agree')",
        "button:has-text('Agree')",
        "button:has-text('Continue')",
        "button:has-text('Got it')",
        "[aria-label='Accept']",
    ]
    for sel in selectors:
        try:
            btn = page.locator(sel).first
            if await btn.count() > 0 and await btn.is_visible():
                await btn.click(timeout=1500)
                log(f"Clicked popup button: {sel}")
                await page.wait_for_timeout(700)
                return
        except Exception:
            pass
    log("No popup action needed")


async def scroll_page(page: Page) -> None:
    log("Scrolling page to trigger lazy rendering")
    await page.evaluate(
        """
        async () => {
            for (let i = 0; i < 6; i++) {
                window.scrollBy(0, window.innerHeight);
                await new Promise(r => setTimeout(r, 700));
            }
            window.scrollTo(0, 0);
        }
        """
    )
    await page.wait_for_timeout(1500)
    log("Scrolling complete")


async def wait_for_scorecard_signals(page: Page) -> None:
    log("Waiting for scorecard signals")

    signal_selectors = [
        "table.ci-scorecard-table",
        "table.ds-table-auto",
        "text=Fall of wickets",
        "text=Extras",
        "text=Bowling",
    ]

    last_error = None
    for sel in signal_selectors:
        try:
            await page.wait_for_selector(sel, timeout=12000)
            log(f"Scorecard signal found: {sel}")
            return
        except Exception as e:
            last_error = e
            log(f"Signal not ready yet: {sel}")

    raise RuntimeError(f"Scorecard did not render. Last error: {last_error}")


async def get_title(page: Page) -> str:
    log("Extracting match title")
    for sel in ["h1", "title"]:
        try:
            if sel == "h1":
                loc = page.locator("h1").first
                if await loc.count() > 0:
                    txt = await safe_text(loc)
                    if txt:
                        log(f"Title found from h1: {txt}")
                        return txt
            else:
                txt = clean(await page.title())
                if txt:
                    log(f"Title found from page.title(): {txt}")
                    return txt
        except Exception:
            pass

    log("Title not found")
    return ""


def parse_teams_from_title(title: str) -> Dict[str, str]:
    m = re.search(r"^(.*?)\s+vs\s+(.*?)(?:,|$)", clean(title), flags=re.I)
    if m:
        teams = {"home": clean(m.group(1)), "away": clean(m.group(2))}
        log(f"Teams inferred from title: {teams}")
        return teams

    teams = {"home": "", "away": ""}
    log("Could not infer teams from title")
    return teams


def parse_toss_cell(raw: str) -> Dict[str, str]:
    """Split ESPN toss cell into winner + decision for match_info."""
    s = clean(raw)
    if not s:
        return {"raw": "", "winner": "", "elected": ""}
    m = re.match(r"^(.+?),\s*elected to\s+(bat|field)\s+first", s, re.I)
    if not m:
        return {"raw": s, "winner": "", "elected": ""}
    return {"raw": s, "winner": clean(m.group(1)), "elected": m.group(2).lower()}


async def scrape_match_context(page: Page) -> Dict[str, Any]:
    """
    Match Details toss line + innings banner lines (T: target = chase innings).
    Used to order innings chronologically when DOM order differs.
    """
    script = r"""
    () => {
      function tossFromDom() {
        const spans = Array.from(document.querySelectorAll("span.ds-text-overline-2"));
        for (const s of spans) {
          const label = (s.textContent || "").trim();
          if (!/^Toss$/i.test(label)) continue;
          let p = s.parentElement;
          for (let depth = 0; depth < 6 && p; depth++) {
            const row = p.parentElement;
            if (row) {
              const cand = row.querySelector(".ds-text-link-3");
              if (cand) {
                const txt = (cand.textContent || "").replace(/\s+/g, " ").trim();
                if (/elected to (?:bat|field) first/i.test(txt)) return txt;
              }
            }
            const sib = p.nextElementSibling;
            if (sib) {
              const inner = sib.querySelector(".ds-text-link-3") || sib;
              const txt = (inner.textContent || "").replace(/\s+/g, " ").trim();
              if (/elected to (?:bat|field) first/i.test(txt)) return txt;
            }
            p = p.parentElement;
          }
        }
        const body = document.body.innerText || "";
        const m = body.match(
          /Toss\s*\n+\s*([^\n]+?elected to (?:bat|field) first[^\n]*)/i
        );
        return m ? m[1].replace(/\s+/g, " ").trim() : "";
      }

      const tossRaw = tossFromDom();

      const banners = [];
      const blocks = Array.from(
        document.querySelectorAll(".ds-bg-color-primary-bg.ds-p-3")
      );
      for (const div of blocks) {
        const teamEl = div.querySelector(".ds-text-title-1");
        if (!teamEl) continue;
        const team = (teamEl.textContent || "").replace(/\s+/g, " ").trim();
        if (!team) continue;
        const t = (div.innerText || "").replace(/\s+/g, " ").trim();
        const isChase = /\(\s*T\s*:/i.test(t);
        banners.push({ team, banner: t, isChase });
      }

      return { tossRaw, inningsBanners: banners };
    }
    """
    try:
        raw = await page.evaluate(script)
    except Exception as e:
        log(f"scrape_match_context evaluate failed: {e}")
        raw = {"tossRaw": "", "inningsBanners": []}

    toss_raw = clean(str(raw.get("tossRaw") or ""))
    banners = raw.get("inningsBanners") or []
    norm_banners: List[Dict[str, Any]] = []
    for b in banners:
        if not isinstance(b, dict):
            continue
        norm_banners.append(
            {
                "team": clean(str(b.get("team") or "")),
                "banner": clean(str(b.get("banner") or "")),
                "is_chase": bool(b.get("isChase")),
            }
        )

    if toss_raw:
        log(f"Match context: toss={toss_raw!r}")
    if norm_banners:
        log(
            "Match context: innings banners="
            + json.dumps(norm_banners, ensure_ascii=False)
        )

    return {"toss_raw": toss_raw, "innings_banners": norm_banners}


def reorder_innings_chronological(
    innings: List[Dict[str, Any]],
    teams: Dict[str, str],
    match_ctx: Dict[str, Any],
) -> List[Dict[str, Any]]:
    if len(innings) != 2:
        return innings

    home, away = teams.get("home") or "", teams.get("away") or ""
    first_from_toss: Optional[str] = None
    if match_ctx.get("toss_raw"):
        first_from_toss = first_batting_team_from_toss(match_ctx["toss_raw"], home, away)

    b0 = innings[0].get("batting_team") or innings[0].get("team") or ""
    b1 = innings[1].get("batting_team") or innings[1].get("team") or ""

    need_swap = False

    if first_from_toss:
        m0 = same_franchise(b0, first_from_toss)
        m1 = same_franchise(b1, first_from_toss)
        if m1 and not m0:
            need_swap = True
        elif m0 and not m1:
            need_swap = False
        elif m0 and m1:
            log("Innings reorder: toss matched both sides ambiguously; skipping toss-based swap")
    else:
        banners: List[Dict[str, Any]] = match_ctx.get("innings_banners") or []
        if len(banners) >= 2:
            c0, c1 = banners[0].get("is_chase"), banners[1].get("is_chase")
            if c0 is True and c1 is False:
                need_swap = True
                log("Innings reorder: banner (T:) indicates DOM chase-first; swapping")

    if need_swap:
        log("Reordering innings to chronological batting order")
        return [innings[1], innings[0]]
    return innings


def is_plausible_match_result(text: str) -> bool:
    """
    Reject sidebar/SEO/script noise. The old full-body regex used [^\\n.]+ which could
    capture megabytes from a single minified line before the first period.
    """
    t = clean(text)
    if len(t) < 12 or len(t) > 280:
        return False
    tl = t.lower()
    noise = (
        "elected to",
        "won the toss",
        "privacy policy",
        "cookie",
        "subscribe",
        "sign in",
        "terms of use",
        "javascript",
        "function(",
        "=>",
        "{",
    )
    if any(n in tl for n in noise):
        return False
    if re.search(r"\bmatch\s+(tied|drawn|abandoned|called off)\b", tl):
        return True
    if re.match(r"no result\b", tl):
        return True
    if not re.search(r"\bwon\s+by\b", tl):
        return False
    idx = tl.find("won by")
    tail = tl[idx + 6 : idx + 160]
    if re.search(r"\d", tail):
        return True
    if re.search(r"boundary|dls|super over|eliminator|virtue|higher net", tail):
        return True
    return False


def first_plausible_result_line(text: str) -> str:
    for line in (text or "").split("\n"):
        line = clean(line)
        if len(line) > 280:
            continue
        if is_plausible_match_result(line):
            return line
    return ""


async def get_result(page: Page) -> str:
    log("Extracting match result")

    js = r"""
    () => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const selectors = [
        "p.ds-text-tight-m.ds-font-bold.ds-text-typo",
        "p.ds-text-tight-s.ds-font-bold.ds-text-typo",
        "p.ds-font-bold.ds-text-typo",
        "h2.ds-text-title-xs",
      ];
      const out = [];
      const seen = new Set();
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          const t = norm(el.textContent);
          if (t.length < 12 || t.length > 280) return;
          if (seen.has(t)) return;
          seen.add(t);
          out.push(t);
        });
      }
      return out;
    }
    """
    candidates: List[str] = []
    try:
        raw = await page.evaluate(js)
        if isinstance(raw, list):
            candidates = [str(x) for x in raw if x]
    except Exception as e:
        log(f"get_result DOM evaluate failed: {e}")

    for c in candidates:
        if is_plausible_match_result(c):
            r = clean(c)
            log(f"Result from score header: {r!r}")
            return r

    try:
        main = page.locator("main").first
        if await main.count() > 0:
            hit = first_plausible_result_line(await safe_text(main))
            if hit:
                log(f"Result from <main> line scan: {hit!r}")
                return hit
    except Exception:
        pass

    body = await safe_text(page.locator("body"))
    hit = first_plausible_result_line(body)
    if hit:
        log(f"Result from body line scan: {hit!r}")
        return hit

    log("Result not found")
    return ""


async def get_cells(row: Locator) -> List[str]:
    cells = row.locator("th, td")
    count = await cells.count()
    values = []
    for i in range(count):
        values.append(clean(await safe_text(cells.nth(i))))
    return values


def classify_headers(headers: List[str], class_attr: str) -> str:
    h = [x.lower() for x in headers]
    header_line = " | ".join(h)
    class_attr = class_attr.lower()

    batting_score = 0
    bowling_score = 0

    if "ci-scorecard-table" in class_attr:
        batting_score += 2

    if "batter" in header_line or "batsman" in header_line:
        batting_score += 3
    if "r" in h:
        batting_score += 1
    if "b" in h:
        batting_score += 1
    if "sr" in h:
        batting_score += 1
    if "4s" in h:
        batting_score += 1
    if "6s" in h:
        batting_score += 1

    if "bowler" in header_line:
        bowling_score += 3
    if "o" in h:
        bowling_score += 1
    if "w" in h:
        bowling_score += 1
    if "econ" in h:
        bowling_score += 2
    if "0s" in h:
        bowling_score += 1

    if batting_score > bowling_score and batting_score >= 3:
        return "batting"
    if bowling_score > batting_score and bowling_score >= 3:
        return "bowling"
    return "unknown"


async def get_table_headers(table: Locator) -> List[str]:
    selectors = ["thead tr th", "thead tr td", "tr th", "tr td"]
    for sel in selectors:
        try:
            loc = table.locator(sel)
            if await loc.count() > 0:
                vals = [clean(x) for x in await loc.all_inner_texts()]
                vals = [x for x in vals if x]
                if vals:
                    return vals
        except Exception:
            pass
    return []


async def nearest_heading(table: Locator) -> str:
    script = """
    (table) => {
      function txt(el) {
        return (el?.textContent || "").replace(/\\s+/g, " ").trim();
      }
      let cur = table;
      for (let depth = 0; depth < 8 && cur; depth++) {
        let sib = cur.previousElementSibling;
        while (sib) {
          const h = sib.matches?.("h1,h2,h3,h4,h5,h6")
            ? sib
            : sib.querySelector?.("h1,h2,h3,h4,h5,h6");
          if (h) {
            const t = txt(h);
            if (t) return t;
          }
          sib = sib.previousElementSibling;
        }
        cur = cur.parentElement;
      }
      return "";
    }
    """
    try:
        return clean(await table.evaluate(script))
    except Exception:
        return ""


async def inspect_tables(page: Page) -> List[Dict[str, Any]]:
    log("Scanning candidate tables: table.ds-table-auto")
    tables = page.locator("table.ds-table-auto")
    count = await tables.count()
    log(f"Candidate table count: {count}")

    results = []

    for i in range(count):
        table = tables.nth(i)
        headers = await get_table_headers(table)
        class_attr = ""
        try:
            class_attr = clean(await table.get_attribute("class") or "")
        except Exception:
            pass

        kind = classify_headers(headers, class_attr)
        heading = await nearest_heading(table)

        log(f"Table {i + 1}: class='{class_attr}'")
        log(f"Table {i + 1}: headers={headers}")
        log(f"Table {i + 1}: heading='{heading}'")
        log(f"Table {i + 1}: classified as {kind}")

        results.append(
            {
                "index": i,
                "locator": table,
                "class_attr": class_attr,
                "headers": headers,
                "heading": heading,
                "kind": kind,
            }
        )

    return results


def choose_innings_tables(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    log("Choosing main 4 scorecard tables")
    chosen = []

    for item in candidates:
        expected = "batting" if len(chosen) % 2 == 0 else "bowling"
        if item["kind"] == expected:
            chosen.append(item)
            log(f"Selected table {item['index'] + 1} as {expected}")
        if len(chosen) == 4:
            break

    if len(chosen) < 4:
        log("Could not form a perfect batting/bowling sequence from candidates")
        filtered = [x for x in candidates if x["kind"] in {"batting", "bowling"}]
        chosen = filtered[:4]

    if len(chosen) == 0:
        raise RuntimeError("No scorecard tables found.")

    if len(chosen) < 4:
        log(f"Note: Only found {len(chosen)} tables. Match might be in progress.")

    return chosen


async def extract_nearby_meta(table: Locator) -> Dict[str, Any]:
    script = r"""
    (table) => {
      function txt(el) {
        return (el?.textContent || "").replace(/\s+/g, " ").trim();
      }
      let cur = table;
      for (let i = 0; i < 7 && cur; i++) {
        const whole = txt(cur);
        if (/Extras/i.test(whole) || /Total/i.test(whole) || /Fall of wickets/i.test(whole)) {
          let extras = { text: "", total: null };
          let total = { score: "", overs: "", run_rate: "" };
          let fall = [];

          const em = whole.match(/Extras\s*(\([^)]+\))?\s*(\d+)/i);
          if (em) extras = { text: (em[1] || "").trim(), total: Number(em[2]) };

          const tm = whole.match(/Total\s*(\d+\/\d+|\d+)\s*\(([^)]*)\)/i);
          if (tm) {
            total.score = tm[1].trim();
            const inside = tm[2].trim();
            const om = inside.match(/([\d.]+)\s*overs?/i);
            const rm = inside.match(/RR\s*:?\s*([\d.]+)/i);
            if (om) total.overs = om[1].trim();
            if (rm) total.run_rate = rm[1].trim();
          }

          const f = whole.match(/\d+-\d+\s*\([^)]+?\)/g);
          if (f) fall = [...new Set(f.map(x => x.replace(/\s+/g, " ").trim()))];

          return { extras, total, fall_of_wickets: fall };
        }
        cur = cur.parentElement;
      }

      return {
        extras: { text: "", total: null },
        total: { score: "", overs: "", run_rate: "" },
        fall_of_wickets: []
      };
    }
    """
    return await table.evaluate(script)


async def parse_batting(table: Locator, innings_no: int) -> Dict[str, Any]:
    log(f"Parsing batting table for innings {innings_no}")
    rows = table.locator("tr")
    row_count = await rows.count()
    log(f"Innings {innings_no} batting row count: {row_count}")

    batting = []
    yet_to_bat = []
    extras = {"text": "", "total": None}
    total = {"score": "", "overs": "", "run_rate": ""}

    for i in range(row_count):
        vals = await get_cells(rows.nth(i))
        if not vals:
            continue

        row_text = " ".join(vals)
        first = vals[0].lower() if vals else ""

        if "did not bat" in row_text.lower():
            names = []
            try:
                a_tags = rows.nth(i).locator(".ds-popper-wrapper a, a")
                count = await a_tags.count()
                if count > 0:
                    for j in range(count):
                        name = await safe_text(a_tags.nth(j))
                        name = name.rstrip(", ").strip()
                        if name:
                            names.append(name)
                if not names:
                    names_part = row_text.split(":", 1)[1] if ":" in row_text else row_text.replace("Did not bat", "", 1)
                    names = [p.strip().rstrip(",") for p in names_part.split(",") if p.strip()]
            except Exception as e:
                log(f"Innings {innings_no}: Error extracting 'Did not bat' names: {e}")

            yet_to_bat.extend(names)
            log(f"Innings {innings_no}: parsed yet_to_bat: {names}")
            continue

        if "fall of wickets" in row_text.lower():
            continue

        if "extras" in first or row_text.lower().startswith("extras"):
            m = re.search(r"Extras\s*(\([^)]+\))?\s*(\d+)", row_text, re.I)
            if m:
                extras = {"text": clean(m.group(1) or ""), "total": int(m.group(2))}
            continue

        if "total" in first or row_text.lower().startswith("total"):
            m_score = re.search(r"(\d+/\d+|\d+)", row_text)
            m_overs = re.search(r"([\d.]+)\s*overs?", row_text, re.I)
            m_rr = re.search(r"RR\s*:?\s*([\d.]+)", row_text, re.I)
            if m_score:
                total["score"] = m_score.group(1)
            if m_overs:
                total["overs"] = m_overs.group(1)
            if m_rr:
                total["run_rate"] = m_rr.group(1)
            continue

        if len(vals) >= 8:
            batting.append(
                {
                    "player": vals[0],
                    "dismissal": vals[1],
                    "R": to_num(vals[2]),
                    "B": to_num(vals[3]),
                    "M": to_num(vals[4]),
                    "4s": to_num(vals[5]),
                    "6s": to_num(vals[6]),
                    "SR": to_num(vals[7]),
                }
            )

    meta = await extract_nearby_meta(table)
    if extras["text"] == "" and extras["total"] is None:
        extras = meta.get("extras", extras)
    if not total["score"]:
        total = meta.get("total", total)
    fow = meta.get("fall_of_wickets", [])

    return {"batting": batting, "extras": extras, "total": total, "fall_of_wickets": fow, "yet_to_bat": yet_to_bat}


async def parse_bowling(table: Locator, innings_no: int) -> List[Dict[str, Any]]:
    log(f"Parsing bowling table for innings {innings_no}")
    rows = table.locator("tr")
    row_count = await rows.count()
    log(f"Innings {innings_no} bowling row count: {row_count}")

    bowling = []

    for i in range(row_count):
        vals = await get_cells(rows.nth(i))
        if not vals or len(vals) < 8:
            continue

        row_text = " ".join(vals).lower()
        if "bowler" in row_text:
            continue

        bowling.append(
            {
                "bowler": vals[0],
                "O": to_num(vals[1]),
                "M": to_num(vals[2]),
                "R": to_num(vals[3]),
                "W": to_num(vals[4]),
                "ECON": to_num(vals[5]),
                "0s": to_num(vals[6]),
                "WD": to_num(vals[-2]),
                "NB": to_num(vals[-1]),
            }
        )

    return bowling


def infer_team(heading: str, teams: Dict[str, str], innings_no: int) -> str:
    heading_l = heading.lower()
    if teams["home"] and teams["home"].lower() in heading_l:
        return teams["home"]
    if teams["away"] and teams["away"].lower() in heading_l:
        return teams["away"]
    if innings_no == 1:
        return teams["away"] or f"Innings {innings_no}"
    return teams["home"] or f"Innings {innings_no}"


def infer_opposition_team(batting_team: str, teams: Dict[str, str]) -> str:
    """The team that bowled this innings is always the other franchise (not the batting side)."""
    if not batting_team:
        return ""
    b = batting_team.strip().lower()
    h = (teams.get("home") or "").strip().lower()
    a = (teams.get("away") or "").strip().lower()
    if h and b == h and (teams.get("away") or "").strip():
        return teams["away"].strip()
    if a and b == a and (teams.get("home") or "").strip():
        return teams["home"].strip()
    return ""


def clean_name(name: str) -> str:
    n = name.replace("†", "").replace("(c)", "").replace("(vc)", "").replace("(s/r)", "")
    return n.strip()


def norm_player_match(name: str) -> str:
    """Lowercase single-spaced key for matching to public.players.player_name."""
    return re.sub(r"\s+", " ", clean_name(name).lower()).strip()


def fetch_players_team_catalog() -> Dict[str, Any]:
    """
    Load player_name -> IPL franchise short from public.players.team.
    Used to label team_a / team_b and innings instead of unreliable ESPN strings.
    """
    out: Dict[str, Any] = {"by_norm": {}, "players": []}
    if not SUPABASE_URL or not SUPABASE_KEY:
        log("fetch_players_team_catalog: missing Supabase env; skipping DB team labels")
        return out
    url = f"{SUPABASE_URL}/rest/v1/players?select=player_name,team&limit=8000"
    try:
        res = requests.get(url, headers=HEADERS, timeout=45)
        res.raise_for_status()
        rows = res.json()
    except Exception as e:
        log(f"fetch_players_team_catalog failed: {e}")
        return out
    if not isinstance(rows, list):
        return out
    by_norm: Dict[str, str] = {}
    players: List[Dict[str, str]] = []
    for r in rows:
        pn = (r.get("player_name") or "").strip()
        tm = (r.get("team") or "").strip()
        if not pn or not tm:
            continue
        nk = norm_player_match(pn)
        by_norm[nk] = tm
        players.append({"player_name": pn, "norm": nk, "team": tm})
    out["by_norm"] = by_norm
    out["players"] = players
    log(f"Loaded {len(players)} players for franchise matching")
    return out


def resolve_franchise_for_scraped_name(scraped: str, catalog: Dict[str, Any]) -> str:
    """Map a scorecard name to players.team (short). Empty if unknown."""
    by_norm = catalog.get("by_norm") or {}
    plist: List[Dict[str, str]] = catalog.get("players") or []
    nk = norm_player_match(scraped)
    if not nk:
        return ""
    if nk in by_norm:
        return by_norm[nk]
    hits: List[str] = []
    if len(nk) >= 8:
        for p in plist:
            pn = p["norm"]
            if nk in pn or pn in nk:
                hits.append(p["team"])
        if len(set(hits)) == 1 and hits:
            return hits[0]
    parts = nk.split()
    if not parts:
        return ""
    last = parts[-1]
    if len(last) < 3:
        return ""
    lhits = [
        p["team"]
        for p in plist
        if p["norm"].split() and p["norm"].split()[-1] == last
    ]
    if len(set(lhits)) == 1 and lhits:
        return lhits[0]
    return ""


def majority_franchise_for_side(
    names: List[str], catalog: Dict[str, Any]
) -> Tuple[str, Dict[str, int]]:
    """Pick the IPL short with the most resolved players; require a strict winner."""
    votes: Dict[str, int] = {}
    for n in names:
        f = resolve_franchise_for_scraped_name(n, catalog)
        if f:
            votes[f] = votes.get(f, 0) + 1
    if not votes:
        return "", votes
    ranked = sorted(votes.items(), key=lambda x: (-x[1], x[0]))
    best_n, best_c = ranked[0][0], ranked[0][1]
    if len(ranked) > 1 and ranked[1][1] == best_c:
        return "", votes
    if best_c < 2:
        return "", votes
    return best_n, votes


def apply_db_franchise_labels(
    innings: List[Dict[str, Any]],
    unique_a: List[str],
    unique_b: List[str],
    scraped_a: str,
    scraped_b: str,
    catalog: Optional[Dict[str, Any]],
) -> Tuple[str, str, Dict[str, Any]]:
    """
    Override team labels using majority of players.team in our DB when both sides
    resolve to distinct franchises.
    """
    meta: Dict[str, Any] = {"from_db": False}
    if not catalog or not catalog.get("players"):
        return scraped_a, scraped_b, meta

    short_a, votes_a = majority_franchise_for_side(unique_a, catalog)
    short_b, votes_b = majority_franchise_for_side(unique_b, catalog)
    meta["votes_a"] = votes_a
    meta["votes_b"] = votes_b
    meta["short_a"] = short_a
    meta["short_b"] = short_b

    if not short_a or not short_b or short_a == short_b:
        log(
            f"DB franchise labels skipped or ambiguous: short_a={short_a!r} short_b={short_b!r}"
        )
        return scraped_a, scraped_b, meta

    meta["from_db"] = True
    log(f"DB franchise labels: {short_a} vs {short_b} (scraped was {scraped_a!r} vs {scraped_b!r})")

    if len(innings) >= 1:
        innings[0]["batting_team"] = short_a
        innings[0]["team"] = short_a
        innings[0]["bowling_team"] = short_b
    if len(innings) >= 2:
        innings[1]["batting_team"] = short_b
        innings[1]["team"] = short_b
        innings[1]["bowling_team"] = short_a

    return short_a, short_b, meta


def print_scraped_innings_block(
    label: str,
    batting_team: str,
    bowling_team: str,
    batting_data: Dict[str, Any],
    bowling_data: List[Dict[str, Any]],
) -> None:
    """Debug: batting side vs bowling side + rows for one innings (batting table + bowling table)."""
    print(f"\n{'=' * 60}\n{label}\n{'=' * 60}", flush=True)
    print(f"Batting team: {batting_team}", flush=True)
    print(f"Bowling team (opposition): {bowling_team}", flush=True)
    print("\nBatting stats:", flush=True)
    print(json.dumps(batting_data.get("batting") or [], indent=2, default=str), flush=True)
    print("\nBowling stats:", flush=True)
    print(json.dumps(bowling_data, indent=2, default=str), flush=True)
    print(flush=True)


async def scrape(page: Page, player_catalog: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    title = await get_title(page)
    result = await get_result(page)
    teams = parse_teams_from_title(title)
    match_ctx = await scrape_match_context(page)

    candidates = await inspect_tables(page)
    chosen = choose_innings_tables(candidates)

    innings: List[Dict[str, Any]] = []

    # First batting side = "Team A", second batting side = "Team B" (by innings order).
    # After the loop we align bowling vs batting via scorecard_innings_align (swap if dismissals don't match).
    for idx in range(0, len(chosen), 2):
        if idx + 1 >= len(chosen):
            break

        innings_no = idx // 2 + 1
        batting_table = chosen[idx]
        bowling_table = chosen[idx + 1]

        batting_data = await parse_batting(batting_table["locator"], innings_no)
        bowling_data = await parse_bowling(bowling_table["locator"], innings_no)
        batting_team = infer_team(batting_table["heading"], teams, innings_no)
        bowling_team = infer_opposition_team(batting_team, teams)
        if not bowling_team:
            cand = infer_team(bowling_table["heading"], teams, innings_no)
            if cand and cand.strip().lower() != batting_team.strip().lower():
                bowling_team = cand

        if innings_no == 1:
            print_scraped_innings_block(
                "First innings (1st batting table + 1st bowling table)",
                batting_team,
                bowling_team,
                batting_data,
                bowling_data,
            )
        elif innings_no == 2:
            print_scraped_innings_block(
                "Second innings (2nd batting table + 2nd bowling table)",
                batting_team,
                bowling_team,
                batting_data,
                bowling_data,
            )

        innings.append(
            {
                "team": batting_team,
                "batting_team": batting_team,
                "bowling_team": bowling_team,
                "batting": batting_data["batting"],
                "did_not_bat": batting_data["yet_to_bat"],
                "extras": batting_data["extras"],
                "total": batting_data["total"],
                "fall_of_wickets": batting_data["fall_of_wickets"],
                "bowling": bowling_data,
            }
        )

    def _refresh_bowling_team_after_swap(inn: Dict[str, Any]) -> None:
        inn["bowling_team"] = infer_opposition_team(inn.get("batting_team") or inn.get("team") or "", teams)

    innings = align_bowling_opposition_innings(
        innings,
        on_swapped_refresh_bowling_team=_refresh_bowling_team_after_swap,
        log_fn=log,
    )

    innings = reorder_innings_chronological(innings, teams, match_ctx)

    team_a_players = []
    team_b_players = []
    for innings_no, inn in enumerate(innings, start=1):
        squad_batting = list(
            dict.fromkeys(
                n
                for n in (
                    [clean_name(b["player"]) for b in inn.get("batting", [])]
                    + [clean_name(p) for p in inn.get("did_not_bat", [])]
                )
                if n and n not in ("BATTING", "BOWLING")
            )
        )
        squad_bowling = squad_bowling_from_rows(inn.get("bowling") or [])
        inn["squad_batting"] = squad_batting
        inn["squad_bowling"] = squad_bowling
        if innings_no == 1:
            team_a_players.extend(squad_batting)
            team_b_players.extend(squad_bowling)
        elif innings_no == 2:
            team_b_players.extend(squad_batting)
            team_a_players.extend(squad_bowling)

    cleaned_title = title
    if "," in title and " vs " in title:
        parts = [clean(x) for x in title.split(",")]
        if len(parts) >= 2:
            cleaned_title = ", ".join(parts[1:])

    team_a_name = innings[0]["batting_team"] if len(innings) >= 1 else ""
    team_b_name = innings[1]["batting_team"] if len(innings) >= 2 else ""

    toss_meta = parse_toss_cell(match_ctx.get("toss_raw") or "")

    unique_a = sorted({n for n in team_a_players if n})
    unique_b = sorted({n for n in team_b_players if n})

    team_a_name, team_b_name, db_team_meta = apply_db_franchise_labels(
        innings,
        unique_a,
        unique_b,
        team_a_name,
        team_b_name,
        player_catalog,
    )

    first_bat_name = team_a_name
    first_bat_short = ipl_short_for_label(team_a_name) if team_a_name else ""

    log(f"[team_a] name={team_a_name!r} unique count={len(unique_a)}")
    for n in unique_a:
        print("  [A]", n)
    log(f"[team_b] name={team_b_name!r} unique count={len(unique_b)}")
    for n in unique_b:
        print("  [B]", n)

    return {
        "team_a": {
            "name": team_a_name,
            "unique": unique_a,
        },
        "team_b": {
            "name": team_b_name,
            "unique": unique_b,
        },
        "match_info": {
            "title": cleaned_title,
            "teams": teams,
            "result": result,
            "status": result,
            "toss": toss_meta,
            "first_innings_batting_team": first_bat_name,
            "first_innings_batting_short": first_bat_short,
            "innings_banners": match_ctx.get("innings_banners") or [],
            "team_franchises_db": db_team_meta,
        },
        "innings": innings,
    }


async def run(
    url: str, player_catalog: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    log("Launching Firefox")
    async with async_playwright() as p:
        headless_env = (os.getenv("ESPN_HEADLESS") or "").strip().lower()
        headless = False if headless_env in {"0", "false", "no", ""} else True
        browser = await p.firefox.launch(headless=headless)

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 2200},
            locale="en-US",
            java_script_enabled=True,
        )

        page = await context.new_page()

        if stealth and callable(stealth):
            try:
                stealth(page)
                log("Stealth applied")
            except Exception as e:
                log(f"Stealth not applied: {e}")

        try:
            log(f"Opening URL: {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=90000)
            log("Initial page load complete")

            await page.wait_for_timeout(3000)
            await dismiss_popups(page)
            await scroll_page(page)

            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                pass

            await wait_for_scorecard_signals(page)

            data = await scrape(page, player_catalog)

            Path(OUTFILE).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            log(f"JSON written to {OUTFILE}")
            return data

        except Exception as e:
            log(f"Fatal error: {e}")
            await save_debug(page, str(e))
            raise
        finally:
            await browser.close()
            log("Browser closed")


def parse_utc_dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def today_ist_date_str(now_utc: datetime) -> str:
    ist = now_utc.astimezone(timezone(timedelta(hours=5, minutes=30)))
    return ist.strftime("%Y-%m-%d")


def slugify_team(name: str) -> str:
    return (name or "").strip().lower().replace("&", "and").replace(" ", "-")


def list_fixtures_for_day(match_date: str) -> List[Dict[str, Any]]:
    """ESPN scraper source of truth: public.fixtures (match_no + api_match_id + points_synced)."""
    url = f"{SUPABASE_URL}/rest/v1/fixtures"
    params = {
        "select": "*",
        "match_date": f"eq.{match_date}",
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


def fetch_legacy_fixture_by_api_match_id(api_match_id: str) -> Optional[Dict[str, Any]]:
    """ESPN JSON is stored on public.fixtures (match_no, points_synced for the app)."""
    sel = "id,api_match_id,match_no,points_synced,scorecard,team1_name,team2_name,title,status"
    url = f"{SUPABASE_URL}/rest/v1/fixtures"
    r = requests.get(
        url,
        headers=HEADERS,
        params={"api_match_id": f"eq.{api_match_id}", "select": sel},
        timeout=30,
    )
    r.raise_for_status()
    rows = r.json() or []
    if rows:
        return rows[0]
    return None


def fetch_legacy_fixture_by_match_no(match_no: int) -> Optional[Dict[str, Any]]:
    sel = "id,api_match_id,match_no,points_synced,scorecard,team1_name,team2_name,title,status"
    url = f"{SUPABASE_URL}/rest/v1/fixtures"
    r = requests.get(
        url,
        headers=HEADERS,
        params={"match_no": f"eq.{match_no}", "select": sel},
        timeout=30,
    )
    r.raise_for_status()
    rows = r.json() or []
    if rows:
        return rows[0]
    return None


def update_legacy_fixture_scorecard_and_mark_synced(
    fixture_id: str, scorecard: Dict[str, Any], status: str
) -> None:
    url = f"{SUPABASE_URL}/rest/v1/fixtures?id=eq.{fixture_id}"
    res = requests.patch(
        url,
        headers=HEADERS,
        json={"scorecard": scorecard, "status": status, "points_synced": True},
        timeout=30,
    )
    res.raise_for_status()


def upsert_fixtureapi_points_synced(api_match_id: str) -> None:
    """Same side effect as run_ipl_day.update_fixture_and_sync_flag (fixtureapi_points canonical flag)."""
    fap = f"{SUPABASE_URL}/rest/v1/fixtureapi_points"
    res = requests.post(
        fap,
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        json={"api_match_id": api_match_id, "synced": True},
        timeout=30,
    )
    res.raise_for_status()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Match date (YYYY-MM-DD)", default=None)
    parser.add_argument("--force", help="Force rescan", action="store_true")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")

    # Target date selection (IST)
    if args.date:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(args.date).strip()):
            raise RuntimeError(f"Invalid --date value (expected YYYY-MM-DD): {args.date!r}")
        target_date = str(args.date).strip()
    else:
        now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
        target_date = now_ist.strftime("%Y-%m-%d")

    log(f"Targeting date: {target_date} (Force: {args.force})")
    fixtures = list_fixtures_for_day(target_date)
    log(f"{len(fixtures)} row(s) from fixtures where match_date={target_date!r}")

    if not fixtures:
        log(f"No matches found for {target_date}. Exiting.")
        return

    player_catalog = fetch_players_team_catalog()

    now_utc = datetime.now(timezone.utc)
    updated: List[Dict[str, Any]] = []
    for f in fixtures:
        # Skip future-starting matches for today's run (keep old behavior for backfills: still respects cutoff)
        dt = parse_utc_dt(f.get("date_time_gmt"))
        if dt and dt > now_utc:
            log(f"Skipping future match {f.get('api_match_id')} date_time_gmt={f.get('date_time_gmt')}")
            continue

        match_id = f.get("api_match_id")
        if not match_id:
            continue

        if not args.force and f.get("points_synced") is True and f.get("scorecard"):
            log(f"Skipping already-synced match {match_id} ({f.get('title')})")
            continue

        t1 = slugify_team(f.get("team1_name") or f.get("team1_short") or "").replace(" ", "-")
        t2 = slugify_team(f.get("team2_name") or f.get("team2_short") or "").replace(" ", "-")
        if not t1 or not t2:
            log(f"Skipping api_match_id={match_id}: missing team names for ESPN URL slug")
            continue

        dynamic_url = f"https://www.espncricinfo.com/series/ipl-2026-{SERIES_ID}/{t1}-vs-{t2}-{match_id}/full-scorecard"

        log(f"Identified Match: {f.get('title')}")
        log(f"Generated URL: {dynamic_url}")

        data = await run(dynamic_url, player_catalog)
        if not data:
            continue

        mi = data.get("match_info") or {}
        status = clean(str(mi.get("result") or mi.get("status") or f.get("status") or ""))
        update_legacy_fixture_scorecard_and_mark_synced(str(f["id"]), data, status)
        upsert_fixtureapi_points_synced(str(match_id))
        log("Fixture scorecard updated in Supabase (fixtures.scorecard + points_synced=true).")
        updated.append(
            {
                "api_match_id": str(match_id),
                "match_date": f.get("match_date") or "",
                "title": (f.get("title") or ""),
                "team1_short": f.get("team1_short") or "",
                "team2_short": f.get("team2_short") or "",
                "status": status or "",
            }
        )

    # Expose outputs for GitHub Actions (for match-detail emails)
    gh_out = os.getenv("GITHUB_OUTPUT")
    if gh_out:
        try:
            with open(gh_out, "a", encoding="utf-8") as fh:
                fh.write(f"target_date={target_date}\n")
                fh.write(f"updated_count={len(updated)}\n")
                details_lines = []
                for u in updated:
                    md = u.get("match_date") or ""
                    teams = ""
                    if u.get("team1_short") or u.get("team2_short"):
                        teams = f"{u.get('team1_short','')} vs {u.get('team2_short','')}".strip()
                    title = u.get("title") or ""
                    status = u.get("status") or ""
                    core = title or teams or (u.get("api_match_id") or "")
                    date_prefix = f"{md} — " if md else ""
                    team_suffix = f" — {teams}" if teams and teams not in core else ""
                    status_suffix = f" — {status}" if status else ""
                    details_lines.append(f"- {date_prefix}{core}{team_suffix}{status_suffix} ({u.get('api_match_id')})")
                fh.write("updated_details<<EOF\n")
                fh.write("\n".join(details_lines) + ("\n" if details_lines else ""))
                fh.write("EOF\n")
                # Keep SUMMARY for backward compatibility
                fh.write("SUMMARY<<EOF\n")
                fh.write(f"Target date (IST): {target_date}\n")
                fh.write(f"Updated matches: {len(updated)}\n")
                if details_lines:
                    fh.write("\n".join(details_lines) + "\n")
                fh.write("EOF\n")
        except Exception as e:
            log(f"WARNING: failed writing GITHUB_OUTPUT: {e}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        log(f"Script failed: {exc}")
        sys.exit(1)

