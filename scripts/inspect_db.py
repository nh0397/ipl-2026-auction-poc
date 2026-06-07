import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

print("SUPABASE_URL:", SUPABASE_URL)

# Check matches
res = requests.get(f"{SUPABASE_URL}/rest/v1/matches?select=id,match_no,team1,team2,match_date&order=match_no.desc", headers=HEADERS)
if res.status_code == 200:
    print("Latest matches in DB:")
    for m in res.json()[:10]:
        print(f"Match {m['match_no']}: {m['team1']} vs {m['team2']} on {m['match_date']} (ID: {m['id']})")
else:
    print("Error fetching matches:", res.status_code, res.text)

# Check fixtures
res_f = requests.get(f"{SUPABASE_URL}/rest/v1/fixtures?select=match_no,team1_short,team2_short,match_date&order=match_no.desc", headers=HEADERS)
if res_f.status_code == 200:
    print("\nLatest fixtures in DB:")
    for f in res_f.json()[:10]:
        print(f"Fixture {f['match_no']}: {f['team1_short']} vs {f['team2_short']} on {f['match_date']}")
else:
    print("Error fetching fixtures:", res_f.status_code, res_f.text)
