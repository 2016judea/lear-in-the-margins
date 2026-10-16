#!/bin/bash
# Build the course edition (Milton + Keats on the public-domain Moby text) and the public
# images cut from it. The paid PDF goes to private/ (gitignored); only the sample pages and
# spread images go to site/. Pipeline: github.com/2016judea/shakespeare-marginalia.
set -euo pipefail
cd "$(dirname "$0")/.."
SM="${SM_DIR:-$HOME/Desktop/shakespeare-marginalia}"
[ -d "$SM" ] || git clone -q https://github.com/2016judea/shakespeare-marginalia "$SM"
mkdir -p private site/img
python3 "$SM/scripts/fetch_moby.py" --slug lear --title "King Lear" --out private/king-lear_moby.txt
python3 "$SM/scripts/render_annotated_play.py" \
  --play-text private/king-lear_moby.txt \
  --text-credit "Play text: the Moby Shakespeare (shakespeare.mit.edu), placed in the public domain." \
  --title "The Tragedy of King Lear" --style antiquarian \
  --annotators "$SM/examples/king-lear/annotators.json" \
  --colophon colophon.html \
  --out private/king_lear_course.html | tee private/anchors.log
grep -q "WEAK" private/anchors.log && { echo "an anchor scored under 0.75: fix annotators.json first" >&2; exit 1; }
"$SM/scripts/print_pdf.sh" private/king_lear_course.html private/king_lear_course.pdf >/dev/null 2>&1
PAGES=$(pdfinfo private/king_lear_course.pdf | awk '/^Pages/{print $2}')
echo "course edition: $PAGES pages"
# Free sample: the front matter, Keats's sonnet and Act 1 to Milton's first mark.
qpdf --empty --pages private/king_lear_course.pdf 1-14 -- site/sample.pdf 2>/dev/null \
  || python3 -c "
from pypdf import PdfReader, PdfWriter; r=PdfReader('private/king_lear_course.pdf'); w=PdfWriter()
[w.add_page(r.pages[i]) for i in range(14)]; w.write('site/sample.pdf')"
# Spread images: 62-63 (Keats, 'Poor Tom') opens the page; 28-29 (Milton, the serpent's tooth).
for p in 3 13 28 29 62 63; do
  pdftoppm -png -r 150 -f $p -l $p private/king_lear_course.pdf private/pg
done
python3 scripts/make_images.py "$PAGES"

# The print cover (Lulu coil-bound US Letter: back | front spread with bleed).
"${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=private/cover.pdf "file://$PWD/scripts/cover.html" 2>/dev/null
