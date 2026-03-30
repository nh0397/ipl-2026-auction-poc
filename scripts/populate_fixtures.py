import json
import os
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SB_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or SUPABASE_KEY

HEADERS = {
    "apikey": SB_SERVICE_KEY,
    "Authorization": f"Bearer {SB_SERVICE_KEY}",
    "Content-Type": "application/json"
}

with open("scripts/scrapper/matches.json", "r") as f:
    matches = json.load(f)

fixtures = []
for m in matches:
    teams = m.get('teams', [])
    team1 = teams[0]['team'] if len(teams) > 0 else {}
    team2 = teams[1]['team'] if len(teams) > 1 else {}
    ground = m.get('ground', {})
    
    fixture = {
        "api_match_id": str(m['objectId']),
        "title": m.get('title', ''),
        "venue": ground.get('name', ''),
        "match_date": m.get('startTime', '').split('T')[0],
        "date_time_gmt": m.get('startTime', ''),
        "team1_name": team1.get('longName', team1.get('name', '')),
        "team1_short": team1.get('abbreviation', ''),
        "team1_img": f"https://p.imgci.com{team1['imageUrl']}" if team1.get('imageUrl') else None,
        "team2_name": team2.get('longName', team2.get('name', '')),
        "team2_short": team2.get('abbreviation', ''),
        "team2_img": f"https://p.imgci.com{team2['imageUrl']}" if team2.get('imageUrl') else None,
        "status": m.get('statusText', 'Upcoming'),
        "match_started": m.get('state') != 'PRE',
        "match_ended": m.get('stage') == 'FINISHED' or m.get('status') == 'RESULT',
        "points_synced": False,
        "scorecard": {}
    }
    # Try to extract match_no
    import re
    match_no_str = re.search(r'(\d+)', fixture['title'])
    fixture['match_no'] = int(match_no_str.group(1)) if match_no_str else 0
    
    fixtures.append(fixture)

# Insert all into DB
for i in range(0, len(fixtures), 50):
    batch = fixtures[i:i+50]
    res = requests.post(f"{SUPABASE_URL}/rest/v1/fixtures", headers=HEADERS, json=batch)
    if res.status_code < 400:
        print(f"Inserted batch {i//50 + 1}")
    else:
        print(f"Error inserting batch: {res.text}")

print("Done populating fixtures.")
