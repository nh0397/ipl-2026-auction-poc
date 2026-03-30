from curl_cffi import requests

url = "https://hs-consumer-api.espncricinfo.com/v1/pages/series/schedule?lang=en&seriesId=1510719"

headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://www.espncricinfo.com',
    'Referer': 'https://www.espncricinfo.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

cookies = {
    'bm_s': 'YAAQNyEwF6Nb/vScAQAASI3rNgXYFgJ4vA2isnAPdK0wT5UjvehwIKNP4njR+zVynI6aiMAfVQzSnCh6QUxbN/Ka1MK9mztvzJ8Wle9AeyAgT1eyIs2n3nVFjyOfQt/HrFXRmvgfzTrH+GGci5baCauswT/w29OtF5SARkhCYvObcMi5qRZ2TXrTWhf8wJ+4ZYgAo5q4lsSE6BW1oHERC7BiJ8Pz8dasVzPz9T55kcx8p3YOOrDncF6eYlTHl3E+J/a2A6SLqHNwGykFXNkEA0eJgcRjLUlICOQBCTlwdBxsd9BO3warrYDyytd7nLAhYXt16gpu9NjwGBFOagJ0prSW5eyd/pyK5vQrmR0GeTpC6hhun1NzO7CyEfH5nAvgBY5CXt3+x4Z5v1tiaiDGc4Rp/LfNAboN8OdChC/vcNPf2WneKuMDFeB6xjK4Ye0XDI+ICDMDPk37DFF3EjJCZDR7PgNUmVGLDVe87cus71U8u3wfD6kfmrCwUE9783a8dloHyoWyE4sfmkt/yUHcVQNsrN4Q2+LNJ3xDkLmpPZvdL/y672tFzH1C/JLpEbLMEJXFkp4LqYEmna1amPSvclIc6FinFn/q4q5ED7InUv7zPd3hAur7qcnlqE9TmR9DTEpTdAJelXA+MjLn+7YrJnofX/27wtGzLm9sgzF+xR0pG3ZbGl1nzUcq+t93TZ7BjdFbFVgYJDKgmLJRwd9dgOmQkMsf2Fd7lC1mTDg2vjxKGq5XUeQZzw196e8hci0jcUrPihxP/6H6Jg4Pqj+mBETj5ZH1jn8/jqeMe72AeGEHXiaiiO2Hl9PPcUyxLOD/yy8t23cpYgRS+pGTsO506kLuXbsB7zqcPVsNYdD5suRpAUHeVMPNiICeFUH37NpkIlgwJTYSmpIvWXsiB+J9weW4Z5T6hsdw3MCSXvuMa/4ZOvQJjwfa6kU3Sm2Rwy00',
    'bm_so': '259162EDF93122EBE151CD0C13BCB7D55126855D11EEFFD208FA4A0D63434032~YAAQNyEwF59b/vScAQAAmXjrNgd3WEe5UKRaAi5WE8C2x5PsNsn9Dz/gKscGpINs0CCA0BW7jZxbEoWXklb7BmRcKcAwVxpdknAOCgCV8YW/9NAjV98qrWUQq2zB0+utt5HHtBVmUR54k+QIOJ2DpBLzui4DZgRziBcTG3sy84GQ+cRpR1XVef+EakSOk71mDWEcnbuBkh1y22vQCiJYVQTPyhcD0XoR+jeuxz4/JIdZFkCeQ00+Cakq90No7AJ+57YIH2/keBDpbE4/0OrvUsle50RKrKpXQ3u++1WqHLdts/i50LMbAU8OlSRKfvrZb8waY/xCwX19onsvoNBwfU/c7KK4lh57Qx9a3E/Z4GH5uzCIVVyVMMJ+DiHl/wuHWnzWXj8wy0wfE7e5UPvU8To5idPFtvrkrhjtD88+7taUBlVfL7jymP14Y1nA3MtwDKd3sIxJ3OXTN9hA5fbvXvKpkhyUrtb3Xw/wbf/oaQu5Yedw/Mh9WOWrENY=',
    'bm_ss': 'ab8e18ef4e',
    'connectionspeed': 'full',
    'country': 'us',
    'edition': 'espncricinfo-en-us',
    'edition-view': 'espncricinfo-en-us',
    'region': 'ccpa',
    's_c24': '1774742897501',
    's_c24_s': 'First%20Visit',
    's_cc': 'true',
    's_ensCDS': '0',
    's_ensNR': '1774742894979-New',
    's_ensNSL': '0',
    's_ensRegion': 'ccpa',
    's_gpv': 'espncricinfo%3Aseries%3Aipl-2026%3Afixtures-and-results',
    's_ips': '1163',
    's_nr30': '1774742897499-New',
    's_ppv': 'espncricinfo%253Aseries%253Aipl-2026%253Afixtures-and-results%2C10%2C10%2C10%2C1163%2C10%2C1',
    's_tp': '11100',
    'usprivacy': '1---'
}

print("Making request using curl_cffi with full cookie set...")
try:
    response = requests.get(
        url, 
        headers=headers, 
        cookies=cookies, 
        impersonate="chrome120"
    )
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Success! Data received.")
        print(f"Response (first 500 chars):\n")
        print(response.text[:500])
    else:
        print(f"Failed. Response (first 500 chars):\n")
        print(response.text[:500])
except Exception as e:
    print(f"Error: {e}")
