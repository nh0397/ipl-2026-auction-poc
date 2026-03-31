import asyncio
import json
import os
from playwright.async_api import async_playwright

try:
    from playwright_stealth import stealth
except ImportError:
    stealth = None

JSON_PATH = "scripts/scrapper/matches.json"
OUTPUT_PATH = "scripts/scrapper/all_scorecards.json"
SERIES_ID = "1510719"


async def scrape_scorecard(page, url):
    print(f"   Navigating to {url}...")
    try:
        await page.goto(url, wait_until="networkidle", timeout=60000)
        # Small delay to ensure React renders everything
        await asyncio.sleep(2)

        # Extract Batting and Bowling tables
        data = await page.evaluate("""() => {
            const innings = [];
            const inningContainers = document.querySelectorAll('div.ds-rounded-lg.ds-p-0'); 

            inningContainers.forEach((container, idx) => {
                const header = container.querySelector('span.ds-text-title-xs');
                if (!header) return;

                const teamName = header.innerText.replace('Innings', '').trim();
                const totalText = container.querySelector('div.ds-text-tight-m.ds-font-bold.ds-text-typo > strong')?.innerText || '';

                const battingTable = container.querySelector('table.ci-scorecard-table');
                const batting = [];
                if (battingTable) {
                    const rows = battingTable.querySelectorAll('tbody tr:not(.ds-hidden)');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 8) {
                            const nameLink = cells[0].querySelector('a');
                            if (nameLink) {
                                batting.push({
                                    name: nameLink.innerText.trim(),
                                    dismissal: cells[1].innerText.trim(),
                                    runs: cells[2].innerText.trim(),
                                    balls: cells[3].innerText.trim(),
                                    fours: cells[4].innerText.trim(), // Fix: 4s are usually index 5 or 6? Let's check.
                                    sixes: cells[5].innerText.trim(),
                                    sr: cells[6].innerText.trim()
                                });
                            }
                        }
                    });
                }

                const bowlingTable = container.parentElement.querySelector('table.ds-w-full.ds-table.ds-table-md.ds-table-auto');
                const bowling = [];
                if (bowlingTable) {
                    const bRows = bowlingTable.querySelectorAll('tbody tr:not(.ds-hidden)');
                    bRows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 10) {
                            const nameLink = cells[0].querySelector('a');
                            if (nameLink) {
                                bowling.push({
                                    name: nameLink.innerText.trim(),
                                    overs: cells[1].innerText.trim(),
                                    maidens: cells[2].innerText.trim(),
                                    runs: cells[3].innerText.trim(),
                                    wickets: cells[4].innerText.trim(),
                                    economy: cells[5].innerText.trim()
                                });
                            }
                        }
                    });
                }

                innings.push({
                    team: teamName,
                    total: totalText,
                    batting,
                    bowling
                });
            });
            return innings;
        }""")
        return data
    except Exception as e:
        print(f"      Error: {e}")
        return None


async def run():
    if not os.path.exists(JSON_PATH):
        print(f"Error: {JSON_PATH} not found.")
        return

    with open(JSON_PATH, "r") as f:
        matches = json.load(f)

    # For initial trial, only scrape 2 matches
    matches = matches[:2]

    results = {}

    async with async_playwright() as p:
        print(f"Launching Firefox to scrape {len(matches)} matches...")
        browser = await p.firefox.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0"
        )
        page = await context.new_page()

        if stealth:
            if callable(stealth):
                stealth(page)
            elif hasattr(stealth, "stealth") and callable(getattr(stealth, "stealth")):
                getattr(stealth, "stealth")(page)

        print("Visiting homepage for session...")
        await page.goto("https://www.espncricinfo.com", wait_until="networkidle")
        await asyncio.sleep(3)

        for i, match in enumerate(matches):
            match_id = str(match["objectId"])
            slug = match["slug"]

            # Construct full-scorecard URL
            url = f"https://www.espncricinfo.com/series/ipl-2026-{SERIES_ID}/{slug}-{match_id}/full-scorecard"

            print(f"[{i+1}/{len(matches)}] Scraping {match['title']}...")

            scorecard_data = await scrape_scorecard(page, url)

            if scorecard_data:
                results[match_id] = {
                    "match_no": match.get("title", f"Match {i+1}"),
                    "fixture_id": match_id,
                    "scorecard": scorecard_data,
                    "status": match.get("statusText", ""),
                }
                print(f"      Successfully scraped {len(scorecard_data)} innings.")
            else:
                print(f"      Failed to scrape Match {match_id}")

            # Every 5 matches, save partial results to avoid loss
            if (i + 1) % 5 == 0:
                with open(OUTPUT_PATH, "w") as f:
                    json.dump(results, f, indent=4)
                print(f"--- Checkpoint: Saved {i+1} results to JSON ---")

        # Final save
        with open(OUTPUT_PATH, "w") as f:
            json.dump(results, f, indent=4)

        print(f"\n✅ All matches processed! Data saved to {OUTPUT_PATH}")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())

