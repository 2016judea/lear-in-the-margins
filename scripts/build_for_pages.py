#!/usr/bin/env python3
"""Write site/r/<token>.json for every sendable row of outreach/round1/ledger.csv.
The /for/<token>/ page shows that row's own line above the edition. Both the ledger and
site/r/ are gitignored: recipients' names never enter the public repo."""
import csv, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
out = ROOT / "site" / "r"
out.mkdir(parents=True, exist_ok=True)
n = 0
for row in csv.DictReader(open(ROOT / "outreach" / "round1" / "ledger.csv")):
    if not row.get("token"):
        continue
    json.dump({"line": row["page_line"]}, open(out / f"{row['token']}.json", "w"))
    n += 1
print(f"wrote {n} /for/ lines to site/r/")
