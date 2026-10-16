#!/usr/bin/env python3
"""Cut one play's page renders (from build_edition.sh) into the web images and record its
page count in site/edition.json.  make_images.py <play> <pages>
Lear's images keep their original names under site/img/; every other play goes to
site/img/<play>/ (p<N>.webp, spread-<a>-<b>.webp, hero.webp)."""
import glob, json, sys
from pathlib import Path
from PIL import Image

play, pages = sys.argv[1], int(sys.argv[2])
cfg = json.load(open("plays.json"))[play]
out = Path("site/img") / ("" if play == "lear" else play)
out.mkdir(parents=True, exist_ok=True)

def page(n):
    f = glob.glob(f"private/{play}-pg-{n:03d}.png") or glob.glob(f"private/{play}-pg-{n}.png")
    return Image.open(f[0]).convert("RGB")

for n in cfg["pages_img"]:
    page(n).save(out / f"p{n}.webp", "WEBP", quality=82)
for i, (a, b) in enumerate((cfg["spread"], cfg["spread2"])):
    l, r = page(a), page(b)
    s = Image.new("RGB", (l.width + r.width, l.height), "white")
    s.paste(l, (0, 0)); s.paste(r, (l.width, 0))
    s.save(out / f"spread-{a}-{b}.webp", "WEBP", quality=82)
    if i == 0:  # the page opens on this: the top of the first spread
        y0, y1 = cfg["hero_crop"]
        name = f"hero-{a}-{b}.webp" if play == "lear" else "hero.webp"
        s.crop((0, y0, s.width, y1)).save(out / name, "WEBP", quality=85)
ed_path = Path("site/edition.json")
ed = json.loads(ed_path.read_text()) if ed_path.exists() else {}
if "pages" in ed:  # the single-play shape from before Hamlet
    ed = {"lear": {"pages": ed["pages"], "sample_pages": ed.get("sample_pages", 14)}}
ed[play] = {"pages": pages, "sample_pages": cfg["sample_pages"]}
ed_path.write_text(json.dumps(ed))
print(f"{play}: images + site/edition.json written")
