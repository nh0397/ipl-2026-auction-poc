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
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

import argparse

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


def clean_name(name: str) -> str:
    n = name.replace("†", "").replace("(c)", "").replace("(vc)", "").replace("(s/r)", "")
    return n.strip()


async def scrape(page: Page) -> Dict[str, Any]:
    title = await get_title(page)
    result = await get_result(page)
    teams = parse_teams_from_title(title)

    candidates = await inspect_tables(page)
    chosen = choose_innings_tables(candidates)

    innings: List[Dict[str, Any]] = []

    for idx in range(0, len(chosen), 2):
        if idx + 1 >= len(chosen):
            break

        innings_no = idx // 2 + 1
        batting_table = chosen[idx]
        bowling_table = chosen[idx + 1]

        batting_data = await parse_batting(batting_table["locator"], innings_no)
        bowling_data = await parse_bowling(bowling_table["locator"], innings_no)
        team = infer_team(batting_table["heading"], teams, innings_no)

        squad = [
            name
            for name in list(
                set(
                    [clean_name(b["player"]) for b in batting_data["batting"]]
                    + [clean_name(bw["bowler"]) for bw in bowling_data]
                    + [clean_name(p) for p in batting_data["yet_to_bat"]]
                )
            )
            if name and name not in ["BATTING", "BOWLING"]
        ]

        innings.append(
            {
                "team": team,
                "batting": batting_data["batting"],
                "did_not_bat": batting_data["yet_to_bat"],
                "extras": batting_data["extras"],
                "total": batting_data["total"],
                "fall_of_wickets": batting_data["fall_of_wickets"],
                "bowling": bowling_data,
                "squad": squad,
            }
        )

    cleaned_title = title
    if "," in title and " vs " in title:
        parts = [clean(x) for x in title.split(",")]
        if len(parts) >= 2:
            cleaned_title = ", ".join(parts[1:])

    all_players: List[str] = []
    for inn in innings:
        all_players.extend(inn.get("squad", []))

    playing24 = sorted(list(set(all_players)))

    log(f"[playing] playing24 total={len(playing24)}")
    for n in playing24:
        print("  -", n)

    return {
        "playing_squad": playing24,
        "match_info": {
            "title": cleaned_title,
            "teams": teams,
            "result": result,
        },
        "innings": innings,
    }


async def run(url: str) -> Optional[Dict[str, Any]]:
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

            data = await scrape(page)

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


def update_fixture_scorecard_and_mark_synced(fixture_id: str, scorecard: Dict[str, Any], status: str) -> None:
    url = f"{SUPABASE_URL}/rest/v1/fixtures?id=eq.{fixture_id}"
    res = requests.patch(
        url,
        headers=HEADERS,
        json={"scorecard": scorecard, "status": status, "points_synced": True},
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
    res = requests.get(f"{SUPABASE_URL}/rest/v1/fixtures?match_date=eq.{target_date}&select=*", headers=HEADERS, timeout=30)
    res.raise_for_status()
    fixtures = res.json()

    if not fixtures:
        log(f"No matches found for {target_date}. Exiting.")
        return

    now_utc = datetime.now(timezone.utc)
    updated: List[Dict[str, Any]] = []
    for f in fixtures:
        # Skip future-starting matches for today's run (keep old behavior for backfills: still respects cutoff)
        dt = parse_utc_dt(f.get("date_time_gmt"))
        if dt and dt > now_utc:
            log(f"Skipping future match {f.get('api_match_id')} date_time_gmt={f.get('date_time_gmt')}")
            continue

        if not args.force and f.get("points_synced") is True and f.get("scorecard"):
            log(f"Skipping already-synced match {f.get('api_match_id')} ({f.get('title')})")
            continue

        t1 = slugify_team(f.get("team1_name", "")).replace(" ", "-")
        t2 = slugify_team(f.get("team2_name", "")).replace(" ", "-")
        match_id = f.get("api_match_id")
        if not match_id:
            continue

        dynamic_url = f"https://www.espncricinfo.com/series/ipl-2026-{SERIES_ID}/{t1}-vs-{t2}-{match_id}/full-scorecard"

        log(f"Identified Match: {f.get('title')}")
        log(f"Generated URL: {dynamic_url}")

        data = await run(dynamic_url)
        if not data:
            continue

        status = data.get("match_info", {}).get("result", "") or (f.get("status") or "")
        update_fixture_scorecard_and_mark_synced(f["id"], data, status)
        log("Fixture scorecard updated in Supabase (scorecard + points_synced=true).")
        updated.append(
            {
                "api_match_id": str(match_id),
                "match_date": f.get("match_date") or "",
                "title": f.get("title") or "",
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

