#!/usr/bin/env python3
"""Cut the page renders from build_edition.sh into the web images and write site/edition.json."""
import glob, json, sys
from PIL import Image

pages = int(sys.argv[1])
def page(n):
    f = glob.glob(f"private/pg-{n:03d}.png") or glob.glob(f"private/pg-{n}.png")
    return Image.open(f[0]).convert("RGB")

for n in (3, 13, 28, 29, 62, 63):
    im = page(n)
    im.save(f"site/img/p{n}.webp", "WEBP", quality=82)
for a, b in ((62, 63), (28, 29)):
    l, r = page(a), page(b)
    s = Image.new("RGB", (l.width + r.width, l.height), "white")
    s.paste(l, (0, 0)); s.paste(r, (l.width, 0))
    s.save(f"site/img/spread-{a}-{b}.webp", "WEBP", quality=82)
    if a == 62:  # the page opens on this: the top of the spread, where Keats's note sits
        s.crop((0, 60, s.width, 760)).save("site/img/hero-62-63.webp", "WEBP", quality=85)
json.dump({"pages": pages, "sample_pages": 14}, open("site/edition.json", "w"))
print("images + site/edition.json written")
