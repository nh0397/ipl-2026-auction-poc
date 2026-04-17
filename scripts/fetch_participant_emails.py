#!/usr/bin/env python3
"""
Emit a comma-separated list of Participant emails for GitHub Actions mail steps.
Falls back to NOTIFY_FALLBACK_EMAIL or a single admin address if none found.
"""
import os
import sys

import requests


def main() -> None:
    url = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip().rstrip("/")
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    fallback = (os.getenv("NOTIFY_FALLBACK_EMAIL") or "naisicric97@gmail.com").strip()

    if not url or not key:
        print(fallback, end="")
        sys.exit(0)

    try:
        r = requests.get(
            f"{url}/rest/v1/profiles",
            params={"select": "email", "role": "eq.Participant"},
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
            },
            timeout=30,
        )
        r.raise_for_status()
        rows = r.json() or []
    except Exception as e:
        print(f"fetch_participant_emails: {e}; using fallback", file=sys.stderr)
        print(fallback, end="")
        sys.exit(0)

    seen: list[str] = []
    for row in rows:
        em = str(row.get("email") or "").strip()
        if em and em not in seen:
            seen.append(em)

    if not seen:
        print(fallback, end="")
        sys.exit(0)

    print(",".join(seen), end="")


if __name__ == "__main__":
    main()
