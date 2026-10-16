# Data model: King Lear in the margins

Written 2026-10-16 from the need alone (BUSINESS.md rule 5), then checked against what
can be got. The need: a Shakespeare professor teaching *Lear* puts real readers' marks
in front of a class, legally, as a file each student gets or a copy on the desk.

## Entities

**Edition** — one sellable book.
| field | answers |
|---|---|
| play, base_text, base_text_licence | Can this text be sold at all? |
| readers[] | Whose hands are in it? |
| pages, pdf_sha | Which exact file did the buyer get? |
| licence (classroom / personal) | What may the buyer do with it? |

**Reader** — a historical annotator.
| field | answers |
|---|---|
| key, name, colour | Whose mark is this, at a glance? |
| source, source_licence | May we reproduce these marks in a sold book? |
| marks[] | What did they mark? |

**Mark** — one thing a reader did to one line.
| field | answers |
|---|---|
| anchor (text, never a line number) | Which line provoked it? |
| type (score, underline, enclosure, annotation) | What did the hand physically do? |
| note, citation | What did they write, and where can a student check it? |
| match_score (per base text) | Did it land on the right line of THIS text? |

**Offer** — what can be bought.
| field | answers |
|---|---|
| item (pdf_classroom, print) | Which thing? |
| price_usd, derivation | Why this price, and when to revise it? |
| fulfilment (password email / print-on-demand job) | How does it reach them, with no stock held? |

**Order** — one purchase.
| field | answers |
|---|---|
| stripe_session, item, email, amount | Who paid what? |
| password (pdf) | Can they get the file again? |
| shipping_address, print_job_id, print_cost (print) | Did the copy get made and shipped, and at what margin? |

**Recipient** — one professor we write to.
| field | answers |
|---|---|
| name, institution, segment | Who, and which kind of buyer? |
| email, email_source_url, email_source_date | Is the address real, and as of when? |
| own_record_url, own_record_line | What of THEIRS opens the email (a syllabus listing *Lear*, a paper)? |
| token | Did they open their page? |
| status, hold_reason | Sendable, or why not? |

## Reality check (2026-10-16)

| field | can it be filled? |
|---|---|
| base_text_licence = sellable | **Yes.** MIT Moby Shakespeare, "placed in the public domain" by its site. Folger is CC BY-NC: kept for the free edition only. |
| Reader Milton: source_licence | **Yes.** Marks located by eye in the Free Library's facsimile; we reproduce no image, only where the marks are, with our own descriptions. |
| Reader Keats: source_licence | **Yes.** Spurgeon 1928 is US public domain since 2024; the sonnet (1818) is public domain. |
| Reader Melville: source_licence | **No, not yet.** MMO declares no licence and asks to be contacted. Draft ask at `outreach/mmo-permission-draft.md`. Ships the day they say yes. |
| match_score >= 0.75 on Moby | **Yes.** All six anchors 0.88–1.00, each checked on the rendered page. |
| print_job_id, print_cost | **Not until a Lulu account with Aidan's card exists.** Stripe takes the buyer's money and the shipping address now; the job is submitted by `scripts/order_print.py`. |
| Recipient own_record_line | Per row; a row without one is held, never sent the generic pitch. |

Nothing was dropped to fit the data: Melville is the one gap, and it is a permission, not a
missing source.
