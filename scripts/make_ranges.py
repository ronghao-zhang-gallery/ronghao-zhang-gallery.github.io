"""Range maps for the Avians page, from eBird Status & Trends.

For each species in _data/species.yml (or the eBird codes given), downloads its range polygons
from eBird Status & Trends (Cornell Lab of Ornithology; free for non-commercial use with
credit, the page credits it) and writes them, in the world map's projection, to
_data/ranges.yml (GENERATED: rerun this script, don't edit it). The page colours them like Birds
of the World's range maps (user, 2026-10-25): year-round, breeding, nonbreeding, migration.

Every spot gets ONE season, like the landscape map's blocks (scripts/make_world_map.py), so the
colours never overlap:
  year-round   the species is resident there, or it both breeds and winters there
  breeding     breeding range only
  nonbreeding  nonbreeding (winter) range only
  migration    passes through on migration only

Downloading needs an eBird Status & Trends access key (free; request it at
https://ebird.org/st/request). Pass it with --key or the EBIRDST_KEY environment variable:
  python scripts/make_ranges.py --key YOURKEY                 # every species in species.yml
  python scripts/make_ranges.py --key YOURKEY carwre          # just these eBird codes
Downloads are kept in --cache (default: a folder outside the repo) and reused.
Needs the gallery env (numpy, scipy, scikit-image, Pillow, PyYAML); reuses make_world_map.py.
At the end it reruns range_continents.py (_data/range_continents.yml).
"""

import argparse
import json
import os
import sqlite3
import struct
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageDraw
from skimage import measure

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_world_map as wm   # noqa: E402  (projection, path writing, grid helpers)

ROOT = Path(__file__).resolve().parent.parent
SPECIES = ROOT / '_data' / 'species.yml'
OUT = ROOT / '_data' / 'ranges.yml'
WORLD = ROOT / '_includes' / 'places' / 'world-map-plain.svg'   # its viewBox frames the grid
API = 'https://st-download.ebird.org/v1'
SEASONS = ['year_round', 'breeding', 'nonbreeding', 'migration']   # drawing classes
RES = 0.05          # lon/lat grid, degrees
MIN_CELLS = 4       # specks smaller than this are dropped

# Ranges kept to a band of longitude, for species that eBird Status & Trends still models as one
# with a sister species split off since (user's birds, 2026-10-31): eBird code -> (west, east).
#   whimbr  S&T 2023 maps the lumped Whimbrel, worldwide; the site's bird is Hudsonian Whimbrel
#           (Numenius hudsonicus), which lives in the Americas only. 25°W keeps out Iceland;
#           168°W (the Bering Strait) keeps out Chukotka, east of 180° but Eurasian whimbrels
#           (2026-11-01: from -180 it showed the bird in Asia).
LON_CLIP = {'whimbr': (-168, -25)}


# ---- Download ----

def fetch(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


def download_range(code, version, key, cache):
    """The species' smoothed range GeoPackage, downloaded once into `cache`."""
    listing = json.loads(fetch(f'{API}/list-obj/{version}/{code}?key={urllib.parse.quote(key)}'))
    ranges = [k for k in listing if '/ranges/' in k and k.endswith('.gpkg')]
    if not ranges:
        sys.exit(f'{code}: no range file in eBird Status & Trends {version}')
    # Prefer the smoothed, coarse (27 km) version: it is small and plenty at world scale.
    ranges.sort(key=lambda k: (('smooth' not in k), ('27km' not in k), k))
    obj = ranges[0]
    path = Path(cache) / Path(obj).name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(fetch(f'{API}/fetch?objKey={urllib.parse.quote(obj)}&key={urllib.parse.quote(key)}'))
        print(f'  downloaded {obj}')
    return path


# ---- GeoPackage reader (it is SQLite with geometry blobs; no GIS library needed) ----

def read_gpkg(path):
    """[(season, polygons)] from a range GeoPackage; a polygon is a list of (n, 2) lon/lat
    arrays, its outline first, then its holes."""
    db = sqlite3.connect(str(path))
    table, = db.execute("SELECT table_name FROM gpkg_contents WHERE data_type = 'features'").fetchone()
    geom_col, srs = db.execute('SELECT column_name, srs_id FROM gpkg_geometry_columns WHERE table_name = ?',
                               (table,)).fetchone()
    if srs not in (4326, 4269):
        sys.exit(f'{path.name}: coordinates in SRS {srs}, expected longitude/latitude (4326)')
    rows = db.execute(f'SELECT season, "{geom_col}" FROM "{table}"').fetchall()
    return [(season, parse_gpkg_geometry(blob)) for season, blob in rows if blob]


def parse_gpkg_geometry(blob):
    """Polygons from a GeoPackage geometry blob (header, then WKB)."""
    flags = blob[3]
    envelope = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
    return parse_wkb(memoryview(blob)[8 + envelope:])[0]


def parse_wkb(buf, pos=0):
    """(polygons, next position) for a WKB Polygon or MultiPolygon (2D, or with Z / M dropped).
    Each polygon is a list of rings: the outline, then any holes (as WKB orders them)."""
    order = '<' if buf[pos] == 1 else '>'
    kind, = struct.unpack_from(order + 'I', buf, pos + 1)
    pos += 5
    dims = 2 + (kind // 1000 in (1, 2)) + 2 * (kind // 1000 == 3)
    base = kind % 1000
    if base == 3:                                   # Polygon
        n_rings, = struct.unpack_from(order + 'I', buf, pos)
        pos += 4
        rings = []
        for _ in range(n_rings):
            n, = struct.unpack_from(order + 'I', buf, pos)
            pos += 4
            pts = np.frombuffer(buf, order + 'f8', n * dims, pos).reshape(n, dims)[:, :2]
            pos += 8 * n * dims
            rings.append(pts)
        return [rings], pos
    if base == 6:                                   # MultiPolygon
        n, = struct.unpack_from(order + 'I', buf, pos)
        pos += 4
        polygons = []
        for _ in range(n):
            part, pos = parse_wkb(buf, pos)
            polygons += part
        return polygons, pos
    sys.exit(f'unexpected geometry type {kind} in the range file')


# ---- Seasons → one class per spot ----

def season_masks(features):
    """Lon/lat grids (row 0 = GRID_NORTH) of where each eBird season applies."""
    h = int(round((wm.GRID_NORTH - wm.GRID_SOUTH) / RES)) + 1
    w = int(round(360 / RES)) + 1
    masks = {}
    for season, polygons in features:
        img = Image.new('L', (w, h), 0)
        pen = ImageDraw.Draw(img)
        for polygon in polygons:
            # Outline filled, then its holes cleared (by position in the polygon, not by ring
            # direction, which writers don't all keep).
            for k, ring in enumerate(polygon):
                pts = list(zip(((ring[:, 0] + 180) / RES).tolist(), ((wm.GRID_NORTH - ring[:, 1]) / RES).tolist()))
                pen.polygon(pts, fill=1 if k == 0 else 0)
        m = np.array(img, bool)
        masks[season] = masks.get(season, np.zeros_like(m)) | m
    return masks


def classify(masks, vb, clip=None):
    """Class grid in map space: index into SEASONS, −1 = not in the range (or outside the
    (west, east) longitude band `clip`)."""
    x0, y0, w, h = vb
    cols, rows = int(np.ceil(w / wm.CELL)), int(np.ceil(h / wm.CELL))
    gx, gy = np.meshgrid(x0 + (np.arange(cols) + 0.5) * wm.CELL, y0 + (np.arange(rows) + 0.5) * wm.CELL)
    lon, lat = wm.inverse(gx, gy)
    ok = ~np.isnan(lon)
    any_mask = next(iter(masks.values()))
    r = np.clip(np.round((wm.GRID_NORTH - np.nan_to_num(lat)) / RES).astype(int), 0, any_mask.shape[0] - 1)
    c = np.clip(np.round((np.nan_to_num(lon) + 180) / RES).astype(int), 0, any_mask.shape[1] - 1)

    def at(*names):
        out = np.zeros(gx.shape, bool)
        for n in names:
            if n in masks:
                out |= masks[n][r, c]
        return out & ok

    resident, breed, winter = at('resident'), at('breeding'), at('nonbreeding')
    move = at('prebreeding_migration', 'postbreeding_migration', 'migration')
    grid = np.full(gx.shape, -1, np.int16)
    grid[move] = SEASONS.index('migration')
    grid[winter] = SEASONS.index('nonbreeding')
    grid[breed] = SEASONS.index('breeding')
    grid[resident | (breed & winter)] = SEASONS.index('year_round')
    if clip:
        grid[~ok | (np.nan_to_num(lon) < clip[0]) | (np.nan_to_num(lon) > clip[1])] = -1
    return grid


def class_path(grid, k, vb):
    mask = np.pad((grid == k).astype(np.float32), 1)
    parts = []
    for contour in measure.find_contours(mask, 0.5):
        if len(contour) < MIN_CELLS * 2:
            continue
        pts = wm.simplify([(vb[0] + (cc - 0.5) * wm.CELL, vb[1] + (rr - 0.5) * wm.CELL)
                           for rr, cc in contour], wm.BLOCK_TOLERANCE)
        if len(pts) >= 4:
            parts.append(wm.path(pts[:-1] if pts[0] == pts[-1] else pts, closed=True))
    return ''.join(parts)


# ---- Main ----

def world_view():
    head = WORLD.read_text(encoding='utf-8')
    vb = head.split('viewBox="', 1)[1].split('"', 1)[0]
    return tuple(float(v) for v in vb.split())


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('codes', nargs='*', help='eBird species codes (default: all in species.yml)')
    ap.add_argument('--key', default=os.environ.get('EBIRDST_KEY'), help='eBird Status & Trends access key')
    ap.add_argument('--version', default='2023', help='eBird Status & Trends data version (year)')
    ap.add_argument('--cache', default=str(ROOT.parent / 'ebirdst-cache'),
                    help='folder for downloads, outside the repo')
    args = ap.parse_args()
    if not args.key:
        sys.exit('Needs an eBird Status & Trends key: --key, or EBIRDST_KEY (request one at '
                 'https://ebird.org/st/request).')

    species = yaml.safe_load(SPECIES.read_text(encoding='utf-8')) or {}
    codes = args.codes or [s['ebird'] for s in species.values() if s.get('ebird')]
    ranges = (yaml.safe_load(OUT.read_text(encoding='utf-8')) if OUT.exists() else None) or {}
    vb = world_view()
    for code in codes:
        print(f'{code} …')
        features = read_gpkg(download_range(code, args.version, args.key, args.cache))
        grid = classify(season_masks(features), vb, LON_CLIP.get(code))
        ranges[code] = {'source': f'eBird Status & Trends {args.version}'}
        for k, season in enumerate(SEASONS):
            d = class_path(grid, k, vb)
            if d:
                ranges[code][season] = d
        print('  ' + ', '.join(s for s in SEASONS if s in ranges[code]))

    header = ('# GENERATED by scripts/make_ranges.py from eBird Status & Trends (Cornell Lab of\n'
              '# Ornithology; non-commercial use, credited on the Avians page). Do not edit; rerun\n'
              '# the script. Per eBird species code: path data in the world map\'s units, one\n'
              '# season per spot: year_round, breeding, nonbreeding, migration.\n')
    OUT.write_text(header + yaml.safe_dump(ranges, sort_keys=True, width=1 << 30), encoding='utf-8')
    print(f'wrote {OUT.relative_to(ROOT)}')

    # Which continents each range reaches (the continent view marks the others), kept in step.
    import range_continents
    range_continents.main()


if __name__ == '__main__':
    main()
