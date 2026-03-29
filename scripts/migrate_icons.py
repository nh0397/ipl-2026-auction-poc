import os
import requests
from dotenv import load_dotenv

# User-provided icon mapping
ICON_MAPPING = {
    "CSK": "/lsci/db/PICTURES/CMS/313400/313421.logo.png",
    "PBKS": "/lsci/db/PICTURES/CMS/414800/414846.png",
    "RCB": "/lsci/db/PICTURES/CMS/378000/378049.png",
    "GT": "/lsci/db/PICTURES/CMS/334700/334707.png",
    "MI": "/lsci/db/PICTURES/CMS/414700/414793.png",
    "DC": "/lsci/db/PICTURES/CMS/313400/313422.logo.png",
    "SRH": "/lsci/db/PICTURES/CMS/414800/414845.png",
    "LSG": "/lsci/db/PICTURES/CMS/415000/415032.png",
    "KKR": "/lsci/db/PICTURES/CMS/313400/313419.logo.png",
    "RR": "/lsci/db/PICTURES/CMS/400400/400406.png"
}

PREFIX = "https://img1.hscicdn.com/inline"

def migrate_icons():
    load_dotenv('.env')
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    
    print(f"Fetching fixtures from {url}...")
    res = requests.get(f"{url}/rest/v1/fixtures?select=id,team1_short,team2_short,team1_img,team2_img", headers=headers)
    if res.status_code != 200:
        print(f"Error: {res.text}")
        return
        
    fixtures = res.json()
    count = 0
    for f in fixtures:
        t1_short = f.get('team1_short')
        t2_short = f.get('team2_short')
        
        upd_data = {}
        
        if t1_short in ICON_MAPPING:
            new_url = PREFIX + ICON_MAPPING[t1_short]
            if f.get('team1_img') != new_url:
                upd_data['team1_img'] = new_url
                
        if t2_short in ICON_MAPPING:
            new_url = PREFIX + ICON_MAPPING[t2_short]
            if f.get('team2_img') != new_url:
                upd_data['team2_img'] = new_url
        
        if upd_data:
            upd_res = requests.patch(
                f"{url}/rest/v1/fixtures?id=eq.{f['id']}", 
                headers=headers, 
                json=upd_data
            )
            if upd_res.status_code < 400:
                count += 1
            else:
                print(f"Error updating {f['id']}: {upd_res.text}")
    
    print(f"✅ Successfully updated {count} records with new icons.")

if __name__ == "__main__":
    migrate_icons()
