# King Lear in the Margins

**Live:** https://lear-in-the-margins.vercel.app

*King Lear* with John Milton's and John Keats's own marks set beside the lines that
provoked them, sold as a course edition to people who teach the play: a PDF with a
classroom licence, or a printed copy made to order.

The edition is built by the open-source pipeline
[shakespeare-marginalia](https://github.com/2016judea/shakespeare-marginalia). This repo
is the shop around it.

## What is in it, and why it may be sold

| | source | status |
|---|---|---|
| Play text | MIT Moby Shakespeare, "placed in the public domain" by its site | sellable |
| Milton (5 marks) | located by eye in the Free Library of Philadelphia's First Folio facsimile; no image reproduced | sellable |
| Keats (sonnet + 1 mark) | the 1818 sonnet; Spurgeon, *Keats's Shakespeare* (1928), US public domain since 2024 | sellable |
| Melville (52 marks) | Melville's Marginalia Online XML, no declared licence | **not in the paid edition** until MMO says yes; ask drafted at `outreach/mmo-permission-draft.md` |

The free three-reader edition on the Folger text (CC BY-NC) stays free and
non-commercial at https://aidanjude.vercel.app/king-lear-annotated.

## Build and deploy

```bash
./scripts/build_edition.sh          # private/king_lear_course.pdf (116 pp) + site/sample.pdf + site/img/
python3 scripts/build_for_pages.py  # site/r/<token>.json from the gitignored outreach ledger
VERCEL_TOKEN=... python3 scripts/deploy.py
```

`build_edition.sh` fails if any hand-located anchor scores under 0.75 on the Moby text.

## The paywall

Ported from `msp-house-index` (the `product-paywall` skill). `site/` ships the page, a
14-page sample and images; the paid PDF goes up as `api/_full/`, bundled only with
`/api/download`.

| route | does |
|---|---|
| `POST /api/checkout {item}` | Stripe embedded Checkout. `pdf`: mints the buyer's password into the session and invoice. `print`: collects a US shipping address |
| `POST /api/stripe-webhook` | `checkout.session.completed`: emails the buyer (password, or print confirmation) and Aidan a sale notice |
| `GET /api/session-status` | the return page; sends the email if the webhook has not |
| `GET /api/download?pw=` | HMAC check, then a paid session for it in Stripe; returns the PDF |

Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ACCESS_SECRET`, `MAILGUN_*`.
Comp password: `python3 scripts/fulfil.py --comp "label"`. A lost one: `fulfil.py <session>`.

**Print fulfilment.** No stock: the buyer pays at checkout, then
`scripts/order_print.py <session>` submits one job to the Lulu Print API (coil-bound, US
Letter, standard colour, `0850X1100.FC.STD.CO.060UW444.MXX`). It needs a Lulu account
with a card on file; until then it prints the job it would send.

## Price

*Hypotheses, 2026-10-16. Revise on checkouts and replies, not on feel.*

**Course PDF, $40.** One use is one course's worth of a marked reading text. The
alternatives a professor pays for: a copyright course pack at roughly $0.12 a page a
student (116 pages x 25 students = $348), or 25 students buying an annotated edition at
about $15 ($375). A tenth of ~$350 is ~$35; rounded to $40.

**Printed copy, $40.** Cost-plus. Lulu's spec sheet (2026): $6.95 + 116 pp x $0.0562 =
$13.47 to print; shipping $6-10 and a $1.75 fulfilment fee (reported 2025); Stripe
2.9% + $0.30 = $1.46. Worst case $26.68, leaving about $13 a copy.

## Outreach (drafts only)

`outreach/mmo-permission-draft.md`: the ask to Melville's Marginalia Online, as a reply
in the thread they answered on 2026-08-15. Not sent.

`outreach/round1/` (gitignored, names stay off the public repo): `rows.py` holds 50
hand-verified recipients in three segments (R1 English departments, teaching colleges,
and Milton / Keats / Melville scholars). Each row's email was read off a page fetched on
2026-10-16 and each opener quotes the reader's own syllabus, course listing or paper.
`python3 scripts/build_outreach.py` writes `ledger.csv` and one draft per recipient;
`python3 scripts/build_for_pages.py` writes the `/for/<token>/` lines, which deploy with
the site. Nothing sends from here.

## Analytics

Vercel Web Analytics on the project; `/_vercel/insights/script.js` and the shared
PostHog block in every page's source. Events: `preview_open` (sample or spread swipe),
`checkout_open {item}`, `paid {item}`, `download`. A recipient's token rides in the path
(`/for/<token>/`), so each open is attributable.
