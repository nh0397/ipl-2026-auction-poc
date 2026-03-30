import requests

url = "https://hs-consumer-api.espncricinfo.com/v1/pages/series/schedule?lang=en&seriesId=1510719"

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://www.espncricinfo.com',
    'Referer': 'https://www.espncricinfo.com/',
}

cookies = {
    '_dcf': '1',
    'AMCV_EE0201AC512D2BE80A490D4C%40AdobeOrg': '1585540135%7CMCIDTS%7C20541%7CMCMID%7C05435846298943035844843704786868321684%7CMCOPTOUT-1774749777s%7CNONE%7CvVersion%7C4.4.0',
    'AMCVS_EE0201AC512D2BE80A490D4C%40AdobeOrg': '1',
    'bm_lso': 'CC14C5DB91C4CD6A6E3BAD781D8EFFDEF678EFA90B091BCFF2E3205F797CC949~YAAQNyEwF3Ra/vScAQAAdMzlNgewj5EY573lReGMnq8dDsqSYn55bQ0jjdYKBJl58WSSwhXWD9fUfIWC658lRESZKJv/h7x4JB0RimnrOmLEa0hLH5hDNi/RuUJePtdDTlhjHpxOoQz2ot0oqWkd+OwDuhlUcIKSGShMx54Po9/mx1d0OHZhCZUl8UY2poFx9tQF3ILjWkMTZt7qv8BUlP7q0Q0WAXx5/Aqfs87qgM/Y6r8P47LARD8bg63uYbqrh4nkiPMsyNsHaNZKK2TJhmU81ov1XlgN4nqpMkmEEWm/1GEAiSrq61ZWZxA5yWUvZ9ijRRiRWgJgvOlq+mlqP+I9hQ2gPtrkyDMvHF6lWvYkNIbwtDa/nt9MFX0Mrq+I/F7VQ7C5tvkt+GHp5Wvh5RUj12nxMlPQa6BKcq0ISZlAEHN4G0Bfqg1MPM+h3QaQR7O3MP3vb0v7y4tx9ATKvnDdDsjpm0sUQGXH724Nerq/DdP11kV2LO2tHX4=~1774742525823',
    'bm_s': 'YAAQNyEwF3Na/vScAQAAdMzlNgXsflsIxBSjNZyRtfLAt1V55rzZnp3tHON/3vcEgW+eYxd+kP2962dTbkEsoC1Hy4T7VYPxRrvd5xfAeNSXV50oOipNckNEtMcJLXTz6dza25+zZ065pgkzZNZ8RuCUYxMHQX95xhjbqKtg/5n2wF3RfLNGGVg6VlcUhZEt8QsxyqhE7293+edIyKMxObDmssDXZcVlko9LxU9Z960ECS4s0GqHYlmVTu0uUfOUyRuLA+ZiDpcd/7dd2m8foaHV/PNan0jtWrfr6p184mbkb/06iOwgsKgst/ZOiNSR7FsTJdNeqHJYq3MiSEUOAnejLhas2YFMYwAAq1Xkv2s2ulVvsQA23bNllu8V1R4M/W2JavnkMl5ebattEitRgkg2kXsmfgcorUpFCMlTAQapusicu+i/R7ETwtdg+rf7H/F3ZaQmsuIvxizsyh7JN3SEZS35Gb5pxkITv6CzSwWZCzmxTLkd0ObeqQqqosZHmeXb8U7lMOesF5Skru5n0tGP3o2RExalTL73lGcaJbB/jDm5PHwcu9wpqbVITk6pycUxGfYz9I7RsVeqLLUZ7MOcWq7+pGYCRqh/Mhwupl/XadSbkJ1rbKtou9jR+u+Er6TMQykHYlsQ0NtxRSM49ad+CUUs8BLy2U1OcyxtponQu/4xVennyss/04ujdXZhAAYef1bHM/NNBmvFVo+Zn1lYDqG5YUHxSkXuX1v7mEW+o2F1XBbbuQWtwOqtGIV0nJi7pijg39RUFDGYcRjVmcF7Icdi4tsaXMxQ54hqVWe88k9ZVMth+W45CJCBE+bC89tVe7tyB4PkYSGDGWGLXe/PyEg//rHMo1B2O/MZY7HLl4vcaoC/RLMdw9SVcQkfUmr/SIO0ux4FVuPMYFmrfh55Y4LH1hcQxEbNXQmsyjpWwcXF20infcEygg1yuEvz',
    'bm_so': 'CC14C5DB91C4CD6A6E3BAD781D8EFFDEF678EFA90B091BCFF2E3205F797CC949~YAAQNyEwF3Ra/vScAQAAdMzlNgewj5EY573lReGMnq8dDsqSYn55bQ0jjdYKBJl58WSSwhXWD9fUfIWC658lRESZKJv/h7x4JB0RimnrOmLEa0hLH5hDNi/RuUJePtdDTlhjHpxOoQz2ot0oqWkd+OwDuhlUcIKSGShMx54Po9/mx1d0OHZhCZUl8UY2poFx9tQF3ILjWkMTZt7qv8BUlP7q0Q0WAXx5/Aqfs87qgM/Y6r8P47LARD8bg63uYbqrh4nkiPMsyNsHaNZKK2TJhmU81ov1XlgN4nqpMkmEEWm/1GEAiSrq61ZWZxA5yWUvZ9ijRRiRWgJgvOlq+mlqP+I9hQ2gPtrkyDMvHF6lWvYkNIbwtDa/nt9MFX0Mrq+I/F7VQ7C5tvkt+GHp5Wvh5RUj12nxMlPQa6BKcq0ISZlAEHN4G0Bfqg1MPM+h3QaQR7O3MP3vb0v7y4tx9ATKvnDdDsjpm0sUQGXH724Nerq/DdP11kV2LO2tHX4=',
    'bm_ss': 'ab8e18ef4e',
    'connectionspeed': 'full',
    'country': 'us',
    'edition': 'espncricinfo-en-us',
    'edition-view': 'espncricinfo-en-us',
    'IDE': 'AHWqTUm3a3E6StZunmBCkZLbLffsy1BwjLaj4AWzD9m6SEMqo16DtwBBqh7b5F-QWCc',
    'OptanonConsent': 'isGpcEnabled=0&datestamp=Mon+Mar+16+2026+19%3A30%3A08+GMT-0500+(Central+Daylight+Time)&version=202404.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=7f6ce2d6-84c0-4f49-9c0f-f45a97c7e47f&interactionCount=1&isAnonUser=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0003%3A1%2CBG1145%3A1%2CC0002%3A1%2CC0004%3A1%2CC0005%3A1&AwaitingReconsent=false',
    'region': 'ccpa',
    's_c24': '1774742577288'
}

print("Making request...")
try:
    response = requests.get(url, headers=headers, cookies=cookies)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body (first 1000 chars): {response.text[:1000]}")
except Exception as e:
    print(f"Error: {e}")
