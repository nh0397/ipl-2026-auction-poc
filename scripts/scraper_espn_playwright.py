import asyncio
import json
import re
import sys
import os
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from playwright.async_api import async_playwright, Page, Locator
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

import argparse
from playwright_stealth import stealth

# Supabase Config for Dynamic URL Discovery
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
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

async def get_result(page: Page) -> str:
    log("Extracting match result")

    body = await safe_text(page.locator("body"))
    patterns = [
        r"([A-Za-z .&'()-]+ won by [^\n.]+)",
        r"(Match (?:tied|drawn|abandoned|called off)[^\n.]*)",
        r"(No result[^\n.]*)",
    ]

    for pat in patterns:
        m = re.search(pat, body, flags=re.I)
        if m:
            result = clean(m.group(1))
            log(f"Result found: {result}")
            return result

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
          const block = txt(sib);
          if (block && block.length < 180 && /innings|Royal Challengers Bengaluru|Sunrisers Hyderabad/i.test(block)) {
            return block;
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
        raise RuntimeError(f"No scorecard tables found.")
    
    if len(chosen) < 4:
        log(f"Note: Only found {len(chosen)} tables. Match might be in progress.")

    log("Final table pairing:")
    if len(chosen) >= 1: log(f"Innings 1 batting table found: candidate #{chosen[0]['index'] + 1}")
    if len(chosen) >= 2: log(f"Innings 1 bowling table found: candidate #{chosen[1]['index'] + 1}")
    if len(chosen) >= 3: log(f"Innings 2 batting table found: candidate #{chosen[2]['index'] + 1}")
    if len(chosen) >= 4: log(f"Innings 2 bowling table found: candidate #{chosen[3]['index'] + 1}")

    log(f"Final table count: {len(chosen)}")
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
            # Extract player names from "Did not bat: Player1, Player2..."
            names_part = row_text.split(":", 1)[1] if ":" in row_text else row_text.replace("Did not bat", "", 1)
            players = [p.strip() for p in names_part.split(",") if p.strip()]
            yet_to_bat.extend(players)
            log(f"Innings {innings_no}: parsed yet_to_bat: {players}")
            continue

        if "fall of wickets" in row_text.lower():
            log(f"Innings {innings_no}: skipped embedded FOW row")
            continue

        if "extras" in first or row_text.lower().startswith("extras"):
            m = re.search(r"Extras\s*(\([^)]+\))?\s*(\d+)", row_text, re.I)
            if m:
                extras = {
                    "text": clean(m.group(1) or ""),
                    "total": int(m.group(2)),
                }
                log(f"Innings {innings_no}: extras found {extras}")
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

            log(f"Innings {innings_no}: total found {total}")
            continue

        if len(vals) >= 8:
            row = {
                "player": vals[0],
                "dismissal": vals[1],
                "R": to_num(vals[2]),
                "B": to_num(vals[3]),
                "M": to_num(vals[4]),
                "4s": to_num(vals[5]),
                "6s": to_num(vals[6]),
                "SR": to_num(vals[7]),
            }
            batting.append(row)
            log(f"Innings {innings_no}: batting row parsed for {row['player']}")

    meta = await extract_nearby_meta(table)
    if extras["text"] == "" and extras["total"] is None:
        extras = meta.get("extras", extras)
        log(f"Innings {innings_no}: extras filled from nearby meta {extras}")

    if not total["score"]:
        total = meta.get("total", total)
        log(f"Innings {innings_no}: total filled from nearby meta {total}")

    fow = meta.get("fall_of_wickets", [])
    log(f"Innings {innings_no}: fall of wickets count = {len(fow)}")
    log(f"Innings {innings_no}: batting entries count = {len(batting)}")

    return {
        "batting": batting,
        "extras": extras,
        "total": total,
        "fall_of_wickets": fow,
        "yet_to_bat": yet_to_bat,
    }

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

        row = {
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
        bowling.append(row)
        log(f"Innings {innings_no}: bowling row parsed for {row['bowler']}")

    log(f"Innings {innings_no}: bowling entries count = {len(bowling)}")
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

async def scrape(page: Page) -> Dict[str, Any]:
    title = await get_title(page)
    result = await get_result(page)
    teams = parse_teams_from_title(title)

    candidates = await inspect_tables(page)
    chosen = choose_innings_tables(candidates)

    innings = []

    # Process available table pairs (batting + bowling)
    for idx in range(0, len(chosen), 2):
        if idx + 1 >= len(chosen): break # Incomplete pair
        
        innings_no = idx // 2 + 1
        batting_table = chosen[idx]
        bowling_table = chosen[idx + 1]

        log(f"Starting innings {innings_no}")
        batting_data = await parse_batting(batting_table["locator"], innings_no)
        bowling_data = await parse_bowling(bowling_table["locator"], innings_no)
        team = infer_team(batting_table["heading"], teams, innings_no)

        innings.append(
            {
                "team": team,
                "batting": batting_data["batting"],
                "extras": batting_data["extras"],
                "total": batting_data["total"],
                "fall_of_wickets": batting_data["fall_of_wickets"],
                "bowling": bowling_data,
            }
        )

    cleaned_title = title
    if "," in title and " vs " in title:
        parts = [clean(x) for x in title.split(",")]
        if len(parts) >= 2:
            cleaned_title = ", ".join(parts[1:])

    return {
        "match_info": {
            "title": cleaned_title,
            "teams": teams,
            "result": result,
        },
        "innings": innings,
    }

async def run(url: str) -> Optional[Dict[str, Any]]:
    log("Launching Chromium")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

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
                log("Network reached idle state")
            except Exception:
                log("Network idle timeout ignored")

            await wait_for_scorecard_signals(page)

            data = await scrape(page)

            Path(OUTFILE).write_text(
                json.dumps(data, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

            log(f"JSON written to {OUTFILE}")
            return data

        except Exception as e:
            log(f"Fatal error: {e}")
            await save_debug(page, str(e))
            raise
        finally:
            await browser.close()
            log("Browser closed")

def clean_name(name):
    n = name.replace("(c)", "").replace("(vc)", "").replace("†", "").replace("(s/r)", "")
    return n.strip().lower()

def calculate_player_points(stats, role):
    r, b, fours, sixes, sr = stats.get('R', 0), stats.get('B', 0), stats.get('4s', 0), stats.get('6s', 0), stats.get('SR', 0)
    w, m, dots, eco, overs = stats.get('W', 0), stats.get('M', 0), stats.get('0s', 0), stats.get('ECON', 0), stats.get('O', 0)
    catches, stumpings = stats.get('catches', 0), stats.get('stumpings', 0)

    # Batting Points
    pts = r + (fours * 1) + (sixes * 2) 
    if r >= 100: pts += 16
    elif r >= 75: pts += 12
    elif r >= 50: pts += 8
    elif r >= 30: pts += 4
    if r == 0 and stats.get('out', False) and role != 'Bowler': pts -= 2
    if (r >= 20 or b >= 10) and role != 'Bowler':
        if sr > 170: pts += 6
        elif sr > 150: pts += 4
        elif sr > 130: pts += 2
        elif sr < 60: pts -= 4
        elif sr < 70: pts -= 2

    # Bowling Points
    pts += (w * 25) + (m * 12) + (dots * 1)
    if w >= 5: pts += 16
    elif w >= 4: pts += 8
    elif w >= 3: pts += 4
    if overs >= 2:
        if eco < 5: pts += 6
        elif eco < 6: pts += 4
        elif eco < 7: pts += 2
        elif eco > 11: pts -= 4
        elif eco > 10: pts -= 2

    # Fielding / WK
    pts += (catches * 8) + (stumpings * 12)
    return pts

def apply_multipliers(points, r, w):
    mult = 1.0
    if r >= 100 or w >= 5: mult = 4.0
    elif r >= 75 or w >= 4: mult = 3.0
    elif r >= 50 or w >= 3: mult = 2.0
    elif r >= 30 or w >= 2: mult = 1.5
    return points * mult

def calculate_match_points(sc_data, fixture_uuid, api_match_id):
    log(f"Running Integrated Scoring for match {api_match_id}...")
    res = requests.get(f"{SUPABASE_URL}/rest/v1/players?select=id,player_name,role", headers=HEADERS)
    players_map = {clean_name(p['player_name']): p for p in res.json()}
    match_stats = {} 

    for inning in sc_data.get('innings', []):
        for b in inning.get('batting', []):
            name = clean_name(b.get('player', ''))
            if name in players_map:
                pid = players_map[name]['id']
                if pid not in match_stats: match_stats[pid] = {'R':0,'B':0,'4s':0,'6s':0,'SR':0,'W':0,'M':0,'0s':0,'ECON':0,'O':0,'catches':0,'stumpings':0,'out':False}
                try:
                    match_stats[pid].update({
                        'R': int(b.get('R', 0)), 'B': int(b.get('B', 0)), '4s': int(b.get('4s', 0)), '6s': int(b.get('6s', 0)),
                        'SR': float(str(b.get('SR', 0)).replace('-', '0')), 'out': "not out" not in b.get('dismissal', '').lower()
                    })
                except: pass
                d = b.get('dismissal', '').lower()
                if 'c ' in d:
                    fielder = clean_name(d.split('c ')[1].split(' b ')[0])
                    if fielder in players_map:
                        fpid = players_map[fielder]['id']
                        if fpid not in match_stats: match_stats[fpid] = {'R':0,'B':0,'4s':0,'6s':0,'SR':0,'W':0,'M':0,'0s':0,'ECON':0,'O':0,'catches':0,'stumpings':0,'out':False}
                        match_stats[fpid]['catches'] += 1
                if 'st ' in d:
                    wk = clean_name(d.split('st ')[1].split(' b ')[0])
                    if wk in players_map:
                        wpid = players_map[wk]['id']
                        if wpid not in match_stats: match_stats[wpid] = {'R':0,'B':0,'4s':0,'6s':0,'SR':0,'W':0,'M':0,'0s':0,'ECON':0,'O':0,'catches':0,'stumpings':0,'out':False}
                        match_stats[wpid]['stumpings'] += 1

        for bw in inning.get('bowling', []):
            name = clean_name(bw.get('bowler', ''))
            if name in players_map:
                pid = players_map[name]['id']
                if pid not in match_stats: match_stats[pid] = {'R':0,'B':0,'4s':0,'6s':0,'SR':0,'W':0,'M':0,'0s':0,'WD':0,'NB':0,'ECON':0,'O':0,'catches':0,'stumpings':0,'out':False}
                try:
                    match_stats[pid].update({
                        'W': int(bw.get('W', 0)), 'M': int(bw.get('M', 0)), '0s': int(bw.get('0s', 0)),
                        'WD': int(bw.get('WD', 0)), 'NB': int(bw.get('NB', 0)),
                        'ECON': float(str(bw.get('ECON', 0)).replace('-', '0')), 'O': float(str(bw.get('O', 0)).replace('-', '0'))
                    })
                except: pass

    m_res = requests.get(f"{SUPABASE_URL}/rest/v1/matches?api_match_id=eq.{api_match_id}", headers=HEADERS)
    match_record = m_res.json()
    if not match_record: return
    m_uuid = match_record[0]['id']

    final_payload = []
    for pid, stats in match_stats.items():
        p_info = next(pl for pl in players_map.values() if pl['id'] == pid)
        base_points = calculate_player_points(stats, p_info['role'])
        final_points = apply_multipliers(base_points, stats['R'], stats['W'])
        final_payload.append({
            "match_id": m_uuid, "player_id": pid, "points": final_points + 4,
            "runs": stats['R'], "balls": stats['B'], "wickets": stats['W'],
            "catches": stats['catches'], "stumpings": stats['stumpings']
        })

    if final_payload:
        requests.delete(f"{SUPABASE_URL}/rest/v1/match_points?match_id=eq.{m_uuid}", headers=HEADERS)
        requests.post(f"{SUPABASE_URL}/rest/v1/match_points", headers=HEADERS, json=final_payload)
        log(f"✅ Aggregate scoring finished. Stored {len(final_payload)} aggregate player records.")

# ──────────────────────────────────────────────
# Full Scoring Engine
# ──────────────────────────────────────────────

def calculate_batting_points(r, b, fours, sixes, sr, dismissal, role):
    try:
        rv, bv, foursv, sixesv = int(r or 0), int(b or 0), int(fours or 0), int(sixes or 0)
        srv = float(str(sr).replace('-', '0') or 0)
    except: return 0
    points = rv + (foursv * 4) + (sixesv * 6)
    if rv >= 100: points += 16
    elif rv >= 75: points += 12
    elif rv >= 50: points += 8
    elif rv >= 25: points += 4
    is_duck = (rv == 0 and "not out" not in dismissal.lower())
    if is_duck and role != 'Bowler': points -= 2
    if (rv >= 20 or bv >= 10) and role != 'Bowler':
        if srv >= 170: points += 6
        elif srv >= 150: points += 4
        elif srv >= 130: points += 2
        elif srv < 50: points -= 6
        elif srv < 60: points -= 4
        elif srv < 70: points -= 2
    return points

def calculate_bowling_points(w, m, dots, eco, overs, role):
    try:
        wv, mv, dotsv = int(w or 0), int(m or 0), int(dots or 0)
        ecov, oversv = float(str(eco).replace('-', '0') or 0), float(str(overs).replace('-', '0') or 0)
    except: return 0
    points = (wv * 30) + (mv * 12) + (dotsv * 1)
    if wv >= 5: points += 12
    elif wv >= 4: points += 8
    elif wv >= 3: points += 4
    if oversv >= 2:
        if ecov < 5: points += 6
        elif ecov < 6: points += 4
        elif ecov < 7: points += 2
        elif ecov >= 12: points -= 6
        elif ecov >= 11: points -= 4
        elif ecov >= 10: points -= 2
    return points

def apply_multipliers(points, r, w):
    try:
        rv, wv = int(r or 0), int(w or 0)
    except: return points
    mult = 1.0
    if rv >= 150: mult = max(mult, 4.0)
    elif rv >= 100: mult = max(mult, 3.0)
    elif rv >= 75: mult = max(mult, 1.75)
    elif rv >= 45: mult = max(mult, 1.5)
    elif rv >= 25: mult = max(mult, 1.25)
    if wv >= 5: mult = max(mult, 4.0)
    elif wv >= 3: mult = max(mult, 2.0)
    elif wv >= 2: mult = max(mult, 1.5)
    return points * mult

def calculate_match_points(sc_data, fixture_uuid, api_match_id):
    log(f"Calculating and Storing Points for match {api_match_id}...")
    res = requests.get(f"{SUPABASE_URL}/rest/v1/players?select=id,player_name,role", headers=HEADERS)
    players_map = {clean_name(p['player_name']): p for p in res.json()}
    match_points = []
    
    for inning in sc_data.get('innings', []):
        for b in inning.get('batting', []):
            if b.get('player') in ["BATTING", ""]: continue
            name = clean_name(b['player'])
            if name in players_map:
                p = players_map[name]
                bat_pts = calculate_batting_points(b['R'], b['B'], b['4s'], b['6s'], b['SR'], b['dismissal'], p['role'])
                match_points.append({
                    "match_id": fixture_uuid, "player_id": p['id'], "points": bat_pts + 4,
                    "runs": int(b['R'] or 0), "balls": int(b['B'] or 0), "wickets": 0
                })
        for bw in inning.get('bowling', []):
            if bw.get('bowler') in ["BOWLING", ""]: continue
            name = clean_name(bw['bowler'])
            if name in players_map:
                p = players_map[name]
                bow_pts = calculate_bowling_points(bw['W'], bw['M'], bw['0s'], bw['ECON'], bw['O'], p['role'])
                found = False
                for entry in match_points:
                    if entry['player_id'] == p['id']:
                        entry['points'] += bow_pts
                        entry['wickets'] = int(bw['W'] or 0)
                        found = True
                        break
                if not found:
                    match_points.append({
                        "match_id": fixture_uuid, "player_id": p['id'], "points": bow_pts + 4,
                        "wickets": int(bw['W'] or 0), "runs": 0, "balls": 0
                    })
    # Map to Match record for final storage
    match_res = requests.get(f"{SUPABASE_URL}/rest/v1/matches?api_match_id=eq.{api_match_id}", headers=HEADERS)
    match_record = match_res.json()
    if match_record and match_points:
        m_uuid = match_record[0]['id']
        for entry in match_points:
            entry['match_id'] = m_uuid
            entry['points'] = apply_multipliers(entry['points'], entry.get('runs', 0), entry.get('wickets', 0))
        # Clear existing
        requests.delete(f"{SUPABASE_URL}/rest/v1/match_points?match_id=eq.{m_uuid}", headers=HEADERS)
        # Store
        requests.post(f"{SUPABASE_URL}/rest/v1/match_points", headers=HEADERS, json=match_points)
        log(f"✅ Stored {len(match_points)} point records with multipliers.")

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Match date (YYYY-MM-DD)", default=None)
    args = parser.parse_args()

    # Target date selection (IST)
    if args.date:
        target_date = args.date
    else:
        now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
        target_date = now_ist.strftime('%Y-%m-%d')
    
    log(f"Targeting date: {target_date}")
    res = requests.get(f"{SUPABASE_URL}/rest/v1/fixtures?match_date=eq.{target_date}", headers=HEADERS)
    fixtures = res.json()
    
    if not fixtures:
        log(f"No matches found for {target_date}. Exiting.")
        return

    for f in fixtures:
        # Avoid redundant scraping if match is already archived
        if f.get('scorecard') and "won" in (f.get('status') or "").lower():
            log(f"Match {f['api_match_id']} ({f['title']}) already completed and stored. Skipping.")
            continue

        t1 = f.get('team1_name', '').replace(' ', '-').lower()
        t2 = f.get('team2_name', '').replace(' ', '-').lower()
        match_id = f.get('api_match_id')
        dynamic_url = f"https://www.espncricinfo.com/series/ipl-2026-{SERIES_ID}/{t1}-vs-{t2}-{match_id}/full-scorecard"
        
        log(f"Identified Match: {f['title']}")
        log(f"Generated URL: {dynamic_url}")
        
        data = await run(dynamic_url)

        if data:
            log(f"Finalizing Database Updates for {f['api_match_id']}...")
            # Update Scorecard in Fixtures
            status = data.get('match_info', {}).get('result', '') or data.get('match_info', {}).get('status', '') or (f.get('status') or "")
            upd = {
                "scorecard": data,
                "status": status,
                "match_started": len(data.get('innings', [])) > 0,
                "match_ended": "won" in status.lower()
            }
            requests.patch(f"{SUPABASE_URL}/rest/v1/fixtures?id=eq.{f['id']}", headers=HEADERS, json=upd)
            log("Fixture scorecard updated in Supabase.")
            
            # Populate Points
            calculate_match_points(data, f['id'], f['api_match_id'])

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        log(f"Script failed: {exc}")
        sys.exit(1)