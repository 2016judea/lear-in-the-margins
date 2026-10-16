#!/usr/bin/env python3
"""Submit one printed copy to the Lulu Print API for a paid Stripe session.

    order_print.py cs_live_...            # dry run: prints the job it would send
    order_print.py cs_live_... --submit   # sends it (charges the Lulu account's card)

The buyer has already paid us at checkout, so no stock is held and nothing is fronted
beyond the job itself. Needs STRIPE_SECRET_KEY, ACCESS_SECRET (or private/access_secret),
and for --submit LULU_CLIENT_KEY + LULU_CLIENT_SECRET from developers.lulu.com.
LULU_API=https://api.sandbox.lulu.com tests against the sandbox.
Product: coil-bound US Letter, standard colour, 60# white, matte (Lulu spec sheet 2026)."""
import hashlib, hmac, json, os, sys, time
from pathlib import Path
import requests

POD = "0850X1100FCSTDCO060UW444MXX"
SITE = "https://lear-in-the-margins.vercel.app"
API = os.environ.get("LULU_API", "https://api.lulu.com")
SECRET = (os.environ.get("ACCESS_SECRET") or (Path(__file__).resolve().parent.parent / "private" / "access_secret").read_text()).strip()


def signed(f, days=7):
    exp = int(time.time()) + days * 86400
    sig = hmac.new(SECRET.encode(), f"print:{f}:{exp}".encode(), hashlib.sha256).hexdigest()
    return f"{SITE}/api/print-file?f={f}&exp={exp}&sig={sig}"


def main():
    if len(sys.argv) < 2 or not sys.argv[1].startswith("cs_"):
        sys.exit(__doc__)
    sid, submit = sys.argv[1], "--submit" in sys.argv
    s = requests.get(f"https://api.stripe.com/v1/checkout/sessions/{sid}", auth=(os.environ["STRIPE_SECRET_KEY"], "")).json()
    if s.get("metadata", {}).get("item") != "print" or s.get("payment_status") != "paid":
        sys.exit(f"not a paid print order: {s.get('metadata')} {s.get('payment_status')}")
    sd = s.get("shipping_details") or (s.get("collected_information") or {}).get("shipping_details") or {}
    a = sd.get("address") or {}
    job = {
        "external_id": sid,
        "contact_email": "aidan@brickandmortar.dev",
        "shipping_level": "MAIL",
        "shipping_address": {
            "name": sd.get("name"), "street1": a.get("line1"), "street2": a.get("line2") or "",
            "city": a.get("city"), "state_code": a.get("state"), "postcode": a.get("postal_code"),
            "country_code": a.get("country"), "phone_number": (s.get("customer_details") or {}).get("phone") or "",
            "email": (s.get("customer_details") or {}).get("email"),
        },
        "line_items": [{
            "external_id": sid, "title": "King Lear in the Margins", "quantity": 1,
            "printable_normalization": {"pod_package_id": POD,
                                        "interior": {"source_url": signed("interior")},
                                        "cover": {"source_url": signed("cover")}},
        }],
    }
    if not submit:
        print(json.dumps(job, indent=2)); print("\ndry run: add --submit to send"); return
    tok = requests.post(f"{API}/auth/realms/glasstree/protocol/openid-connect/token",
                        data={"grant_type": "client_credentials"},
                        auth=(os.environ["LULU_CLIENT_KEY"], os.environ["LULU_CLIENT_SECRET"])).json()["access_token"]
    r = requests.post(f"{API}/print-jobs/", json=job, headers={"Authorization": f"Bearer {tok}"})
    print(r.status_code, r.text[:800])


if __name__ == "__main__":
    main()
