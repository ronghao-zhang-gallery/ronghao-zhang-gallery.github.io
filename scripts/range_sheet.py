#!/usr/bin/env python3
"""Draw species' range maps side by side, to check them against Birds of the World.

eBird Status & Trends ranges (_data/ranges.yml) are modelled from observations, so some look
unlike the expert maps: Arctic and Siberian ranges go missing, rare visitors make inland
patches, introduced birds are drawn as native (user, 2026-11-04). After adding a species and
running make_ranges.py, open its sheet, compare it with the species' map on
birdsoftheworld.org, and set `range_approx: true` in species.yml if they differ: the Avians
map then says the range "is based on eBird observations and may not be accurate".

  python scripts/range_sheet.py                      # every species in species.yml
  python scripts/range_sheet.py spruce-grouse osprey # just these species ids
  python scripts/range_sheet.py --out /some/folder   # where the pages go

Writes sheet1.html, sheet2.html, … (28 maps each, in the page's season colours) to --out
(default: ../range-sheets, outside the repo); open them in a browser. Needs PyYAML.
"""

# ---- Imports and paths ----
import argparse
import html
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SPECIES = ROOT / '_data' / 'species.yml'
RANGES = ROOT / '_data' / 'ranges.yml'
WORLD = ROOT / '_includes' / 'places' / 'world-map-plain.svg'
# Birds of the World's season colours, as on the Avians page.
COLOURS = {'year_round': '#7b5ea7', 'breeding': '#c8783c', 'nonbreeding': '#3f7fb5', 'migration': '#c9b53a'}
PER_SHEET = 28


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('ids', nargs='*', help='species ids from species.yml (default: all)')
    ap.add_argument('--out', default=str(ROOT.parent / 'range-sheets'), help='folder for the pages')
    args = ap.parse_args()

    svg = WORLD.read_text(encoding='utf-8')
    view = re.search(r'viewBox="([^"]+)"', svg).group(1)
    land = re.search(r'id="world-map-land-shape"[^>]*?d="([^"]+)"', svg).group(1)
    species = yaml.safe_load(SPECIES.read_text(encoding='utf-8'))
    ranges = yaml.safe_load(RANGES.read_text(encoding='utf-8')) or {}
    items = [(sid, species[sid]) for sid in (args.ids or species)]

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for start in range(0, len(items), PER_SHEET):
        cells = []
        for sid, s in items[start:start + PER_SHEET]:
            r = ranges.get(s.get('ebird')) or {}
            paths = ''.join(f'<path d="{r[k]}" fill="{c}" fill-opacity=".85" fill-rule="evenodd"/>'
                            for k, c in COLOURS.items() if k in r)
            mark = ' · marked approximate' if s.get('range_approx') else ''
            name = html.escape(s['name']['en'])
            cells.append(f'<figure><svg viewBox="{view}"><path d="{land}" fill="#d9d4c7"/>'
                         f'<g clip-path="url(#L)">{paths}</g></svg>'
                         f'<figcaption>{name} <i>{s.get("ebird", "")}</i>{mark}'
                         f'{"" if r else " · no range"}</figcaption></figure>')
        page = (
            '<!doctype html><meta charset="utf-8"><title>Range sheet</title><style>'
            'body{margin:8px;font:12px sans-serif;background:#fff;display:grid;'
            'grid-template-columns:repeat(4,1fr);gap:6px}figure{margin:0;border:1px solid #ccc}'
            'svg{display:block;width:100%}figcaption{padding:2px 4px}</style>'
            f'<svg width="0" height="0" style="position:absolute"><clipPath id="L"><path d="{land}"/>'
            f'</clipPath></svg>{"".join(cells)}')
        name = out / f'sheet{start // PER_SHEET + 1}.html'
        name.write_text(page, encoding='utf-8')
        print(f'wrote {name}')


if __name__ == '__main__':
    main()
