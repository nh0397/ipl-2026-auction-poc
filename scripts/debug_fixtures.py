import requests
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

res = requests.get(f"{SUPABASE_URL}/rest/v1/fixtures?order=match_date", headers=HEADERS)
fixtures = res.json()

for f in fixtures:
    print(f"ID: {f['id']} | Date: {f['match_date']} | Title: {f['title']} | API ID: {f['api_match_id']} | Ended: {f['match_ended']}")
