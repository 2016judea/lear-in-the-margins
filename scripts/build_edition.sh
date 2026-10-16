#!/bin/bash
# Build one play's course edition on the public-domain Moby text, with only the readers whose
# rights are clean (Milton, Keats), plus the public images cut from it. Usage:
#   scripts/build_edition.sh lear      # or: hamlet
# The paid PDF goes to private/ (gitignored); only the sample pages and spread images go to
# site/. Per-play paths live in plays.json. Pipeline: github.com/2016judea/shakespeare-marginalia.
set -euo pipefail
cd "$(dirname "$0")/.."
PLAY="${1:-lear}"
SM="${SM_DIR:-$HOME/Desktop/shakespeare-marginalia}"
[ -d "$SM" ] || git clone -q https://github.com/2016judea/shakespeare-marginalia "$SM"
cfg() { python3 -c "import json,sys;print(json.load(open('plays.json'))['$PLAY']['$1'])"; }
MOBY=$(cfg moby); TITLE=$(cfg title); PDF=$(cfg pdf); SAMPLE=$(cfg sample_pages); DIR=$(cfg site_dir)
OUT="${DIR:+site/$DIR}"; OUT="${OUT:-site}"
mkdir -p private "$OUT" site/img
python3 "$SM/scripts/fetch_moby.py" --slug "$MOBY" --title "$TITLE" --out "private/${PLAY}_moby.txt"
python3 "$SM/scripts/render_annotated_play.py" \
  --play-text "private/${PLAY}_moby.txt" \
  --text-credit "Play text: the Moby Shakespeare (shakespeare.mit.edu), placed in the public domain." \
  --title "$TITLE" --style antiquarian \
  --annotators "$SM/$(cfg annotators)" \
  --colophon "$(cfg colophon)" \
  --out "private/${PLAY}_course.html" | tee "private/${PLAY}_anchors.log"
grep -q "WEAK" "private/${PLAY}_anchors.log" && { echo "an anchor scored under 0.75: fix annotators.json first" >&2; exit 1; }
"$SM/scripts/print_pdf.sh" "private/${PLAY}_course.html" "$PDF" >/dev/null 2>&1
PAGES=$(pdfinfo "$PDF" | awk '/^Pages/{print $2}')
echo "$PLAY course edition: $PAGES pages"
python3 -c "
from pypdf import PdfReader, PdfWriter; r=PdfReader('$PDF'); w=PdfWriter()
[w.add_page(r.pages[i]) for i in range($SAMPLE)]; w.write('$OUT/sample.pdf')"
for p in $(python3 -c "import json;print(' '.join(map(str,json.load(open('plays.json'))['$PLAY']['pages_img'])))"); do
  pdftoppm -png -r 150 -f $p -l $p "$PDF" "private/${PLAY}-pg"
done
python3 scripts/make_images.py "$PLAY" "$PAGES"
# The print cover (Lulu coil-bound US Letter: back | front spread with bleed).
"${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$(cfg cover)" "file://$PWD/$(cfg cover_html)" 2>/dev/null
