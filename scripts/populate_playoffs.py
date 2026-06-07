import os
import json
import requests
from dotenv import load_dotenv

# Load credentials from .env in root
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env")
    exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

IPL_2026_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f"

# Load the JSON
json_path = os.path.join(os.path.dirname(__file__), '../fixtures.json')
with open(json_path, 'r') as f:
    data = json.load(f)

playoffs_raw = data['content']['matches'][70:] # The last 4 games

matches_payload = []
fixtures_payload = []
fixtures_cricapi_payload = []

for idx, m in enumerate(playoffs_raw):
    match_no = 71 + idx
    title = m.get('title', '')
    date_time = m.get('startTime', '')
    
    # 1. matches table payload
    matches_payload.append({
        "match_no": match_no,
        "title": title,
        "date_time": date_time
    })
    
    # 2. fixtures table payload
    teams = m.get('teams', [])
    team1 = teams[0]['team'] if len(teams) > 0 else {}
    team2 = teams[1]['team'] if len(teams) > 1 else {}
    ground = m.get('ground', {})
    
    api_match_id = str(m['objectId'])
    venue = ground.get('name', '')
    match_date = date_time.split('T')[0]
    
    team1_img = f"https://p.imgci.com{team1['imageUrl']}" if team1.get('imageUrl') else None
    team2_img = f"https://p.imgci.com{team2['imageUrl']}" if team2.get('imageUrl') else None
    
    fixtures_payload.append({
        "api_match_id": api_match_id,
        "title": title,
        "venue": venue,
        "match_date": match_date,
        "date_time_gmt": date_time,
        "team1_name": team1.get('longName', team1.get('name', '')),
        "team1_short": team1.get('abbreviation', ''),
        "team1_img": team1_img,
        "team2_name": team2.get('longName', team2.get('name', '')),
        "team2_short": team2.get('abbreviation', ''),
        "team2_img": team2_img,
        "status": m.get('statusText', 'Upcoming'),
        "match_started": m.get('state') != 'PRE',
        "match_ended": m.get('stage') == 'FINISHED' or m.get('status') == 'RESULT',
        "points_synced": False,
        "scorecard": {},
        "match_no": match_no
    })
    
    # 3. fixtures_cricapi payload
    fixtures_cricapi_payload.append({
        "api_series_id": IPL_2026_SERIES_ID,
        "api_match_id": api_match_id,
        "match_name": title,
        "title": title,
        "match_no": match_no,
        "match_type": m.get('format', 'T20').upper(),
        "status": m.get('statusText', 'Upcoming'),
        "venue": venue,
        "match_date": match_date,
        "date_time_gmt": date_time,
        "team1_name": team1.get('longName', team1.get('name', '')),
        "team1_short": team1.get('abbreviation', ''),
        "team1_img": team1_img,
        "team2_name": team2.get('longName', team2.get('name', '')),
        "team2_short": team2.get('abbreviation', ''),
        "team2_img": team2_img,
        "match_started": m.get('state') != 'PRE',
        "match_ended": m.get('stage') == 'FINISHED' or m.get('status') == 'RESULT',
        "has_squad": bool(m.get('hasMatchPlayers', False)),
        "fantasy_enabled": bool(m.get('hasFanRatings', False)),
        "bbb_enabled": bool(m.get('ballByBallSource', False)),
        "teams": m.get('teams', []),
        "team_info": m.get('teamInfo', []),
        "raw_match": m
    })

def upsert_table(table_name, payload, conflict_cols="api_match_id"):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?on_conflict={conflict_cols}"
    res = requests.post(url, headers=HEADERS, json=payload)
    if res.status_code >= 400:
        print(f"❌ Error inserting into {table_name}: {res.status_code} - {res.text}")
    else:
        print(f"✅ Successfully populated {len(payload)} rows into {table_name}")

print("Populating Playoff Matches...")
# Insert matches (conflict on match_no)
url_matches = f"{SUPABASE_URL}/rest/v1/matches?on_conflict=match_no"
res_matches = requests.post(url_matches, headers=HEADERS, json=matches_payload)
if res_matches.status_code >= 400:
    print(f"❌ Error inserting into matches: {res_matches.status_code} - {res_matches.text}")
else:
    print(f"✅ Successfully populated {len(matches_payload)} rows into matches")

# Insert fixtures
upsert_table("fixtures", fixtures_payload)

# Insert fixtures_cricapi
upsert_table("fixtures_cricapi", fixtures_cricapi_payload)

print("\n🎉 Done!")
