#!/usr/bin/env python3
"""Turn outreach/round1/rows.py (hand-verified recipients, gitignored) into
outreach/round1/ledger.csv and one draft per recipient in outreach/round1/drafts/.

Drafts only. Nothing here sends. Each draft opens on the reader's own public record
(distribution-channel rule 11), points at the free sample by a /for/<token>/ link
(rule 14), states the price in one line (rule 12) and never says "free".
Tokens are stable across reruns: they are kept in outreach/round1/tokens.json."""
import csv
import json
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
R1 = ROOT / "outreach" / "round1"
SITE = "https://lear-in-the-margins.vercel.app"
SUBSTACK = "https://randomaidan.substack.com"
OFFER = json.load(open(ROOT / "site" / "offer.json"))

ns = {}
exec((R1 / "rows.py").read_text(), ns)
ROWS = ns["ROWS"]

tok_path = R1 / "tokens.json"
tokens = json.loads(tok_path.read_text()) if tok_path.exists() else {}
ALPHA = "abcdefghjkmnpqrstuvwxyz23456789"

MILTON = ("Milton read Lear too. In his own First Folio he pencilled \"is\" back into Edmund's line, "
          "the word the Folio's compositor dropped and modern editors later restored. I built an edition "
          "that sets that mark and his four others beside the lines he marked, with Keats's sonnet facing "
          "Act 1 and the date he wrote next to \"Poor Tom.\"")
MILTON_SCHOLAR = ("I located the five Lear marks by eye in the Free Library's digitization and set each one "
                  "beside its line, on a public-domain text: the hook at Cordelia's \"Time shall unfold,\" "
                  "the long bracket around Lear's curse on Goneril, the \"is\" restored to Edmund. Keats is "
                  "in it too, his sonnet facing Act 1.")
KEATS = ("Keats is in the edition I built: the sonnet facing Act 1, and the date he wrote beside \"Poor Tom\" "
         "on 4 October 1818, set at that line. Milton's five marks from his own First Folio sit with him, "
         "each beside the line he marked.")
MELVILLE = ("Melville left 52 marks in his own Lear while he was writing Moby-Dick. I built an edition that "
            "sets readers' marks beside the lines they marked. This one carries Milton's five, from his First "
            "Folio, and Keats's; Melville's join once Melville's Marginalia Online agrees to it.")
FACT = {"MILTON": MILTON, "MILTON_SCHOLAR": MILTON_SCHOLAR, "KEATS": KEATS, "MELVILLE": MELVILLE}
SUBJECT = {"MILTON": "Milton's pencil in King Lear", "MILTON_SCHOLAR": "Milton's five marks in Lear",
           "KEATS": "Keats, Poor Tom, and Lear", "MELVILLE": "Melville's Lear, and Milton's"}
# Which fact each reader gets: what their own record is about.
KIND = {
    "Claire M. L. Bourne": "MILTON_SCHOLAR", "Jason Scott-Warren": "MILTON_SCHOLAR",
    "Nicholas McDowell": "MILTON_SCHOLAR", "Maggie Kilgour": "MILTON_SCHOLAR",
    "Katherine Acheson": "MILTON_SCHOLAR", "Steven Minas": "MILTON_SCHOLAR",
    "Susan J. Wolfson": "KEATS", "Flora Lisica": "KEATS",
    "Hannibal Hamlin": "MELVILLE", "Geoffrey Sanborn": "MELVILLE", "Brian Yothers": "MELVILLE",
    "David Greven": "MELVILLE", "John Stauffer": "MELVILLE",
}

drafts = R1 / "drafts"
drafts.mkdir(parents=True, exist_ok=True)
out = []
for r in ROWS:
    key = r["email"].lower()
    tokens.setdefault(key, "".join(secrets.choice(ALPHA) for _ in range(10)))
    tok = tokens[key]
    kind = KIND.get(r["name"], "MILTON")
    link = f"{SITE}/for/{tok}/"
    body = "\n\n".join([
        r["hook"],
        FACT[kind],
        f"The first 14 pages are open to read, no login: {link}\n"
        f"The course PDF, licensed for one course's students, is ${OFFER['pdf']['price_usd']}. "
        f"A printed copy is ${OFFER['print']['price_usd']}.",
        f"Best,\nAidan\n\nAidan Jude\nMS, Artificial Intelligence and Machine Learning, Columbia University\n{SUBSTACK}",
    ])
    text = f"To: {r['email']}\nSubject: {SUBJECT[kind]}\n\n{body}\n"
    (drafts / f"{tok}.md").write_text(text)
    first = r["hook"][0].lower() + r["hook"][1:] if r["hook"].startswith("Your ") else r["hook"]
    out.append({
        "token": tok, "name": r["name"], "institution": r["inst"], "segment": r["seg"],
        "email": r["email"], "email_source_url": r["email_src"], "email_source_date": "2026-10-16",
        "own_record_url": r["rec_url"], "own_record": r["rec"], "opener": r["hook"],
        "kind": kind, "subject": SUBJECT[kind], "for_url": link,
        "page_line": f"Made for {r['name']}: {first}",
        "status": "draft", "hold_reason": "", "sent_at": "", "reply": "",
    })

tok_path.write_text(json.dumps(tokens, indent=1))
with open(R1 / "ledger.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0]))
    w.writeheader()
    w.writerows(out)
print(f"{len(out)} drafts in {drafts}, ledger at {R1 / 'ledger.csv'}")
