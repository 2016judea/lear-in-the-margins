#!/usr/bin/env python3
"""Passwords for the course PDF, mirroring site/api/_lib.js.
  fulfil.py --comp "label"   mint a comp password (no payment; unlocks /api/download)
  fulfil.py cs_live_...      print a paid session's password and buyer, to resend by hand
ACCESS_SECRET comes from private/access_secret (written when the env was set up)."""
import hashlib, hmac, os, secrets, sys
from pathlib import Path

ALPHA = "23456789BCDFGHJKMNPQRSTVWXYZ"
SECRET = (os.environ.get("ACCESS_SECRET") or (Path(__file__).resolve().parent.parent / "private" / "access_secret").read_text()).strip()
chars = lambda b, n: "".join(ALPHA[x % len(ALPHA)] for x in b[:n])
mac = lambda nonce, domain="": chars(hmac.new(SECRET.encode(), (domain + nonce).encode(), hashlib.sha256).digest(), 7)

if len(sys.argv) > 2 and sys.argv[1] == "--comp":
    nonce = chars(secrets.token_bytes(5), 5)
    raw = nonce + mac(nonce, "comp:")
    pw = f"{raw[:4]}-{raw[4:8]}-{raw[8:]}"
    with open(Path(__file__).resolve().parent.parent / "private" / "comp_passwords.csv", "a") as f:
        f.write(f"{nonce},{sys.argv[2]}\n")
    print(pw)
elif len(sys.argv) > 1 and sys.argv[1].startswith("cs_"):
    import requests
    s = requests.get(f"https://api.stripe.com/v1/checkout/sessions/{sys.argv[1]}", auth=(os.environ["STRIPE_SECRET_KEY"], "")).json()
    print(s.get("metadata", {}).get("item"), s.get("payment_status"), (s.get("customer_details") or {}).get("email"), s.get("metadata", {}).get("password"))
else:
    sys.exit(__doc__)
