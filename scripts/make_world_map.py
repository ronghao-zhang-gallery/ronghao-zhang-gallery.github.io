"""Draw the world map for the Traces page: land split into soft blocks of one landscape each.

Writes _includes/places/world-map.svg, plus a plain world-map-plain.svg (land, lakes, rivers and
borders, no landscape blocks, for the Avians page) (user, 2026-10-25: Ariel Mu's flat, pale map instead of
dots, with low-saturation colour for the landscape; then: "each part of this map is covered by
one type of geography, no overlap", borders on top, and a better source for rivers).

How it works
  1. Every spot of land gets exactly ONE type, on a grid in the map's own projection (cells of
     CELL SVG units, ~0.8 px with the map at its widest):
       ice       RESOLVE "Rock and Ice" (Greenland, the Arctic ice caps)
       mountain  from elevation (NOAA ETOPO): high, or rugged for its height (see mountains())
       forest / grassland / desert / tundra   from the RESOLVE biome underneath (BIOMES)
     in that order of priority, so mountains win over the biome below them and ice over both.
  2. The grid is smoothed (majority vote of each cell's neighbours) and specks smaller than
     MIN_BLOCK cells join their surroundings, so the map reads as calm blocks.
  3. Each type's outline is traced from the grid. Neighbouring blocks share their edges, so
     they never overlap and leave no gaps; the land outline (Natural Earth) clips them.
  4. On top: lakes (Natural Earth), rivers (HydroRIVERS: every river draining at least
     RIVER_MIN_KM2, i.e. the long rivers and their main branches; the biggest drawn heavier),
     then the country borders, so the borders are never covered.
Colours are not in the file: each layer has a class, and _places.scss colours it from the
--map-* tokens, so the map follows light and dark mode.

Continents (user, 2026-10-25: a continent bar that zooms the map to one continent and shows only
that continent): the world map also carries a mask with one shape per continent, built from
Natural Earth's country table (each country's CONTINENT; overseas parts such as French Guiana or
the Canaries go by where they lie; Russia is split at the Urals, 60°E), with the sea shared out
to the nearest continent, so the shapes stay small. Each carries the zoom box from
_data/continents.yml in map units (data-view). places-map.js fades the other
continents out through the mask. Antarctica gets its own polar map, antarctica-map.svg (Lambert
azimuthal equal-area round the South Pole), built the same way, since Equal Earth squashes it
into a thin strip. The world map shows Antarctica too, as that strip along its foot (user,
2026-10-29: the world map "misses the Antarctica area"); it belongs to no continent's mask shape,
so it fades out with the rest when another continent is picked.

Projection: Equal Earth (areas true, shapes pleasant), scaled by 100, cropped to the land.
assets/js/places-map.js uses the same formulas and reads the viewBox written here to
place the markers and routes, so change both together.

Data (download into one folder; none of it goes in the repo):
  Natural Earth 1:50m (public domain):
    for f in ne_50m_land ne_50m_admin_0_boundary_lines_land ne_50m_lakes ne_50m_admin_0_countries; do
      curl -L -o $f.geojson \\
        https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/$f.geojson
    done
  RESOLVE Ecoregions 2017 (CC BY 4.0, credited on the page), ~150 MB:
    curl -L -O https://storage.googleapis.com/teow2016/Ecoregions2017.zip && unzip Ecoregions2017.zip
  NOAA ETOPO1 elevation (public domain), every 3rd arc-minute (0.05°), pole to 84°N, ~50 MB:
    curl -L -o etopo_005.nc "https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.nc?altitude%5B(-90.0):3:(84.0)%5D%5B(-180.0):3:(180.0)%5D"
  HydroRIVERS v1.0 (HydroSHEDS, credited on the page), ~540 MB:
    curl -L -O https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_shp.zip && unzip HydroRIVERS_v10_shp.zip
Then run (gallery env: numpy, scipy, scikit-image, Pillow, PyYAML):
  python scripts/make_world_map.py <that folder>
Shapefiles are read by the small reader below, so no GIS library is needed.
"""

import argparse
import json
import math
import struct
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.io import netcdf_file
from skimage import draw, measure

# ---- Settings ----
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796   # Equal Earth (Šavrič et al. 2018)
M = math.sqrt(3) / 2
SCALE = 100          # projected units × 100 = SVG units (the map is ~530 wide)

ANTARCTIC = -60.0    # land wholly south of this is Antarctica (the polar map draws only that)
GRID_NORTH, GRID_SOUTH = 84.0, -90.0   # extent of the lon/lat grids (biomes, elevation)
POLAR_R = 58.0       # half-width of the polar map in its units (reaches ~61°S)
ROOT = Path(__file__).resolve().parent.parent
TOLERANCE = 0.12     # line simplification in SVG units (~0.4 px with the map at its widest)
MIN_AREA = 0.02      # land and lake rings smaller than this (SVG units²) are dropped

CELL = 0.25          # landscape grid cell, SVG units
SMOOTH = 5           # majority window, cells
MIN_BLOCK = 40       # blocks smaller than this many cells join their neighbours
BLOCK_TOLERANCE = 0.2

# Landscape types, in the order they are drawn (any order works: they don't overlap).
TYPES = ['forest', 'grassland', 'desert', 'tundra', 'mountain', 'ice']
# RESOLVE BIOME_NUM → type. Mangroves count as forest; savannas, flooded grasslands, montane
# grasslands and Mediterranean scrub as grassland. "Rock and Ice" is biome 11 named N/A.
BIOMES = {1: 'forest', 2: 'forest', 3: 'forest', 4: 'forest', 5: 'forest', 6: 'forest',
          14: 'forest', 7: 'grassland', 8: 'grassland', 9: 'grassland', 10: 'grassland',
          12: 'grassland', 13: 'desert', 11: 'tundra'}
# Savanna-biome ecoregions that are wooded today count as forest: RESOLVE files much of the
# Southeast US (round Atlanta) and Africa's miombo woodlands under savanna, which on a map of
# landscapes read wrongly as open grassland.
WOODED = ('forest', 'woodland', 'Southeast US conifer savannas')

RIVER_MIN_KM2 = 100000    # rivers draining at least this much land: long rivers, main branches
RIVER_MAJOR_KM2 = 500000  # the great rivers, drawn a little heavier
LAKE_MAX_RANK = 6


# ---- Projection ----

def forward(lon, lat):
    """Degrees → SVG units (x right, y down). Works on numbers or numpy arrays."""
    t = np.arcsin(M * np.sin(np.radians(lat)))
    t2, t6 = t * t, t ** 6
    x = np.radians(lon) * np.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
    y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return x * SCALE, -y * SCALE


def inverse(x, y):
    """SVG units → degrees (lon, lat) for numpy arrays; NaN outside the map."""
    px, py = x / SCALE, -y / SCALE
    t = py.copy()
    for _ in range(12):
        t2, t6 = t * t, t ** 6
        f = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - py
        fp = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)
        t -= f / fp
    t2, t6 = t * t, t ** 6
    lon = np.degrees(M * px * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)) / np.cos(t))
    lat = np.degrees(np.arcsin(np.clip(np.sin(t) / M, -1, 1)))
    lon[np.abs(lon) > 180] = np.nan
    return lon, lat


def forward_polar(lon, lat):
    """Lambert azimuthal equal-area round the South Pole, ×100: 0° up, 90°E to the right."""
    rho = 2 * SCALE * np.sin(np.radians(90 + np.asarray(lat, float)) / 2)
    lam = np.radians(lon)
    return rho * np.sin(lam), -rho * np.cos(lam)


def inverse_polar(x, y):
    rho = np.hypot(x, y)
    lat = np.degrees(2 * np.arcsin(np.clip(rho / (2 * SCALE), 0, 1))) - 90
    lon = np.degrees(np.arctan2(x, -y))
    return lon, lat


# ---- Path data ----

def simplify(pts, tol):
    """Douglas–Peucker on a list of (x, y)."""
    if len(pts) < 3:
        return pts

    def dist(p, a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        if dx == dy == 0:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)

    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        best, at = 0, None
        for m in range(i + 1, j):
            d = dist(pts[m], pts[i], pts[j])
            if d > best:
                best, at = d, m
        if at is not None and best > tol:
            keep[at] = True
            stack += [(i, at), (at, j)]
    return [p for p, k in zip(pts, keep) if k]


def thin(pts, step):
    """Drop points closer than `step` to the last kept one (speeds up simplify on dense lines)."""
    out = [pts[0]]
    for p in pts[1:-1]:
        if abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) >= step:
            out.append(p)
    out.append(pts[-1])
    return out


def area(pts):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 2


def num(v):
    t = f'{v:.1f}'.rstrip('0').rstrip('.')
    t = '0' if t in ('', '-0') else t
    return t.replace('0.', '.', 1) if t.startswith(('0.', '-0.')) else t


def path(pts, closed):
    """Compact path data: an absolute move, then relative steps between rounded points (rounding
    the absolute points first, so the steps don't drift). '' when rounding leaves no step: a bare
    "M x y l" is invalid, and browsers stop drawing the whole path at the first error."""
    r = [(round(x, 1), round(y, 1)) for x, y in pts]
    steps = []
    for a, b in zip(r, r[1:]):
        dx, dy = round(b[0] - a[0], 1), round(b[1] - a[1], 1)
        if dx or dy:
            steps.append(f'{num(dx)} {num(dy)}')
    if not steps:
        return ''
    return f'M{num(r[0][0])} {num(r[0][1])}l' + ' '.join(steps) + ('z' if closed else '')


# ---- Readers ----

def geojson(folder, name):
    return json.loads((Path(folder) / f'{name}.geojson').read_text())['features']


def read_dbf(path, columns):
    """The listed columns of a dBASE table, as numpy byte-string arrays (fast on millions of rows)."""
    data = Path(path).read_bytes()
    count, head_len, rec_len = struct.unpack('<IHH', data[4:12])
    fields, pos, at = {}, 32, 1
    while data[pos] != 0x0D:
        name = data[pos:pos + 11].split(b'\0')[0].decode('ascii')
        size = data[pos + 16]
        fields[name] = (at, size)
        at += size
        pos += 32
    rows = np.frombuffer(data, np.uint8, count * rec_len, head_len).reshape(count, rec_len)
    out = {}
    for c in columns:
        a, size = fields[c]
        out[c] = np.char.strip(np.ascontiguousarray(rows[:, a:a + size]).view(f'S{size}').ravel())
    return out


def read_shp(path, which=None):
    """Polygon rings or polyline parts of each record, as (n, 2) arrays of lon, lat. With `which`
    (a set of record numbers, from 0), only those records are read, via the .shx index."""
    shp = Path(path)
    data = shp.read_bytes()
    index = shp.with_suffix('.shx').read_bytes()
    n = (len(index) - 100) // 8
    offsets = struct.unpack(f'>{2 * n}i', index[100:])[::2]
    out = {}
    for i in (range(n) if which is None else sorted(which)):
        pos = offsets[i] * 2 + 8
        kind = struct.unpack('<i', data[pos:pos + 4])[0]
        if kind not in (3, 5):          # 3 = polyline, 5 = polygon; anything else is skipped
            out[i] = []
            continue
        n_parts, n_points = struct.unpack('<ii', data[pos + 36:pos + 44])
        parts = list(struct.unpack(f'<{n_parts}i', data[pos + 44:pos + 44 + 4 * n_parts])) + [n_points]
        start = pos + 44 + 4 * n_parts
        xy = np.frombuffer(data, '<f8', 2 * n_points, start).reshape(-1, 2)
        out[i] = [xy[a:b] for a, b in zip(parts, parts[1:])]
    return out


# ---- Landscape grid ----

def biome_grid(folder, res=0.05):
    """RESOLVE biomes on a lon/lat grid (row 0 = GRID_NORTH): type index + 1 per cell, 0 = none.
    Each ecoregion's holes are kept empty (Greenland's ice cap is a hole in its coastal tundra),
    and larger ecoregions are drawn first, so the small ones inside them land on top."""
    base = Path(folder) / 'Ecoregions2017'
    cols = read_dbf(base.with_suffix('.dbf'), ['BIOME_NUM', 'ECO_NAME', 'SHAPE_AREA'])
    shapes = read_shp(base.with_suffix('.shp'))
    h, w = int(round((GRID_NORTH - GRID_SOUTH) / res)) + 1, int(round(360 / res)) + 1
    grid = np.zeros((h, w), np.uint8)
    for i in np.argsort(-cols['SHAPE_AREA'].astype(float)):
        name = cols['ECO_NAME'][i].decode('utf-8', 'replace')
        biome = int(float(cols['BIOME_NUM'][i] or 0))
        kind = 'ice' if name == 'Rock and Ice' else BIOMES.get(biome)
        if biome in (7, 8) and any(w in name for w in WOODED):
            kind = 'forest'
        if kind is None or not shapes[i]:
            continue
        # Shapefile rings: clockwise around the land, anticlockwise around holes. Fill the
        # outer rings, clear the holes, on a patch the size of the ecoregion.
        rings = [((GRID_NORTH - ring[:, 1]) / res, (ring[:, 0] + 180) / res) for ring in shapes[i]]
        r0 = max(int(min(rr.min() for rr, _ in rings)), 0)
        c0 = max(int(min(cc.min() for _, cc in rings)), 0)
        r1 = min(int(max(rr.max() for rr, _ in rings)) + 2, h)
        c1 = min(int(max(cc.max() for _, cc in rings)) + 2, w)
        if r1 <= r0 or c1 <= c0:
            continue
        # Pillow fills polygons in C: far faster than skimage on outlines this detailed.
        patch = Image.new('L', (c1 - c0, r1 - r0), 0)
        pen = ImageDraw.Draw(patch)
        for (rr, cc), ring in zip(rings, shapes[i]):
            x, y = ring[:, 0], ring[:, 1]
            clockwise = np.sum((x[1:] - x[:-1]) * (y[1:] + y[:-1])) > 0
            pen.polygon(list(zip((cc - c0).tolist(), (rr - r0).tolist())), fill=1 if clockwise else 0)
        grid[r0:r1, c0:c1][np.array(patch, bool)] = TYPES.index(kind) + 1
    return grid, res


def mountains(folder, shape):
    """Mountain cells from ETOPO elevation, after the UNEP-WCMC mountain definition (Kapos et
    al. 2000), loosened for a 0.05° grid: high ground, or ground rugged for its height (local
    relief = highest minus lowest point within ~3 cells)."""
    nc = netcdf_file(str(Path(folder) / 'etopo_005.nc'), 'r', mmap=False)
    lat = nc.variables['latitude'][:].copy()
    elev = nc.variables['altitude'][:].astype(np.float32)
    nc.close()
    if lat[0] < lat[-1]:          # make row 0 the north, like the biome grid
        elev = elev[::-1]
    elev = elev[:shape[0], :shape[1]]
    disk = np.zeros((7, 7), bool)
    disk[draw.disk((3, 3), 3.5)] = True
    relief = ndimage.maximum_filter(elev, footprint=disk) - ndimage.minimum_filter(elev, footprint=disk)
    # Thresholds loosened once (user wanted "where is mountain" visible; the first pass missed
    # older, lower ranges such as the Appalachians).
    m = (elev >= 2500) | ((elev >= 1500) & (relief >= 200)) | ((elev >= 1000) & (relief >= 300)) \
        | ((elev >= 300) & (relief >= 450))
    # Calm the edges a little: close small gaps, drop lone rugged spots.
    m = ndimage.binary_closing(m, iterations=1)
    return ndimage.binary_opening(m, iterations=1)


def fill_from_neighbours(grid, empty):
    """Give each `empty` cell the value of its nearest non-empty cell."""
    idx = ndimage.distance_transform_edt(empty, return_distances=False, return_indices=True)
    return grid[tuple(idx)]


def landscape(vb, biomes, peaks, res, inverse_fn, lat_min):
    """The landscape grid in map space (any projection, via inverse_fn): type index per cell,
    −1 = off the map. `biomes` must already be gap-filled (see main())."""
    # Sample both grids at each cell centre of the projected grid.
    x0, y0, w, h = vb
    cols, rows = int(math.ceil(w / CELL)), int(math.ceil(h / CELL))
    gx, gy = np.meshgrid(x0 + (np.arange(cols) + 0.5) * CELL, y0 + (np.arange(rows) + 0.5) * CELL)
    lon, lat = inverse_fn(gx, gy)
    ok = ~np.isnan(lon) & (lat >= lat_min)
    r = np.clip(np.round((GRID_NORTH - np.nan_to_num(lat)) / res).astype(int), 0, biomes.shape[0] - 1)
    c = np.clip(np.round((np.nan_to_num(lon) + 180) / res).astype(int), 0, biomes.shape[1] - 1)
    grid = biomes[r, c].astype(np.int16) - 1
    grid[peaks[r, c] & (grid != TYPES.index('ice'))] = TYPES.index('mountain')

    # Smooth: each cell takes the type most common around it.
    counts = np.stack([ndimage.uniform_filter((grid == k).astype(np.float32), SMOOTH)
                       for k in range(len(TYPES))])
    grid = counts.argmax(0).astype(np.int16)

    # Specks: blocks under MIN_BLOCK cells are emptied, then filled from their neighbours.
    empty = np.zeros(grid.shape, bool)
    for k in range(len(TYPES)):
        labels, n = ndimage.label(grid == k)
        if n:
            sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
            empty |= np.isin(labels, np.nonzero(sizes < MIN_BLOCK)[0] + 1)
    grid = fill_from_neighbours(grid, empty)
    grid[~ok] = -1
    return grid


def block_path(grid, k, vb):
    """Outline of every type-k block as path data (holes are separate rings: fill-rule evenodd).
    Traced through the midpoints of cell edges, so two neighbouring types share one boundary."""
    x0, y0 = vb[0], vb[1]
    mask = np.pad((grid == k).astype(np.float32), 1)
    parts = []
    for contour in measure.find_contours(mask, 0.5):
        pts = [(x0 + (c - 0.5) * CELL, y0 + (r - 0.5) * CELL) for r, c in contour]
        pts = simplify(pts, BLOCK_TOLERANCE)
        if len(pts) >= 4:
            parts.append(path(pts[:-1] if pts[0] == pts[-1] else pts, closed=True))
    return ''.join(parts)


# ---- Natural Earth layers ----

def polygon_path(geom, project=forward, keep=lambda ring: True):
    """Path data for a Polygon / MultiPolygon; polygons whose outer ring fails `keep` are left
    out (by default none)."""
    if geom is None:
        return ''
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    parts = []
    for rings in polys:
        if not keep(np.array(rings[0])):
            continue
        for ring in rings:
            ring = np.array(ring)
            x, y = project(ring[:, 0], ring[:, 1])
            pts = simplify(list(zip(x.tolist(), y.tolist())), TOLERANCE)
            if len(pts) >= 4 and area(pts) >= MIN_AREA:
                parts.append(path(pts[:-1] if pts[0] == pts[-1] else pts, closed=True))
    return ''.join(parts)


def line_path(geom):
    if geom is None:
        return ''
    lines = [geom['coordinates']] if geom['type'] == 'LineString' else geom['coordinates']
    parts = []
    for line in lines:
        line = np.array(line)
        if len(line) < 2:
            continue
        x, y = forward(line[:, 0], line[:, 1])
        parts.append(path(simplify(list(zip(x.tolist(), y.tolist())), TOLERANCE), closed=False))
    return ''.join(parts)


# ---- Rivers (HydroRIVERS) ----

def rivers(folder, on_ice):
    """(major, other) path data: every river reach draining at least RIVER_MIN_KM2, joined into
    long lines. A line follows its river downstream until the river grows into the next size
    class or meets a line already drawn, and then ends exactly on it, so every branch visibly
    joins its main river. The longest rivers are traced first, so they keep their main stems."""
    base = next(Path(folder).rglob('HydroRIVERS_v10.shp')).with_suffix('')
    cols = read_dbf(base.with_suffix('.dbf'), ['HYRIV_ID', 'NEXT_DOWN', 'UPLAND_SKM', 'DIST_UP_KM'])
    ids = cols['HYRIV_ID'].astype(np.int64)
    down = cols['NEXT_DOWN'].astype(np.int64)
    upland = cols['UPLAND_SKM'].astype(np.float64)
    reach_up = cols['DIST_UP_KM'].astype(np.float64)
    keep = np.nonzero(upland >= RIVER_MIN_KM2)[0]
    shapes = read_shp(base.with_suffix('.shp'), set(keep.tolist()))
    # No rivers across ice caps (HydroRIVERS models flow under Greenland's ice too).
    keep = np.array([i for i in keep if shapes[i] and not on_ice(*shapes[i][0][0])])
    row_of = {int(ids[i]): int(i) for i in keep}
    next_row = {int(i): row_of.get(int(down[i])) for i in keep}
    print(f'  {len(keep)} river reaches drain ≥ {RIVER_MIN_KM2:,} km²')

    def points(i):
        return np.concatenate(shapes[i]) if shapes[i] else np.zeros((0, 2))

    def trace(subset, seen):
        """Lines through the reaches in `subset`, each starting where nothing in the subset
        flows into it, longest river first."""
        fed = {next_row[i] for i in subset if next_row[i] in subset}
        starts = sorted((i for i in subset if i not in fed), key=lambda i: -reach_up[i])
        lines = []
        for s in starts:
            i, pts = s, []
            while i is not None and i in subset and i not in seen:
                seen.add(i)
                seg = points(i)
                pts.extend(seg.tolist() if not pts else seg[1:].tolist())
                i = next_row[i]
            if i is not None and pts:          # ended on another river: touch it
                seg = points(i)
                if len(seg):
                    pts.append(seg[0].tolist())
            arr = np.array(pts)
            if len(arr) >= 2:
                x, y = forward(arr[:, 0], arr[:, 1])
                line = simplify(thin(list(zip(x.tolist(), y.tolist())), TOLERANCE / 2), TOLERANCE)
                lines.append(path(line, closed=False))
        return ''.join(lines)

    seen = set()
    major = {int(i) for i in keep if upland[i] >= RIVER_MAJOR_KM2}
    other = {int(i) for i in keep} - major
    return trace(major, seen), trace(other, seen)


# ---- Continents ----

NE_CONTINENTS = {'North America': 'north-america', 'South America': 'south-america',
                 'Europe': 'europe', 'Africa': 'africa', 'Asia': 'asia', 'Oceania': 'oceania'}
URALS = 60.0   # Russia west of this meridian counts as Europe, east of it as Asia. Its far east
               # (Chukotka, Wrangel Island) runs past 180°, to negative longitudes, so Europe
               # is only 0°–60°E (2026-11-01: that land and its sea had been Europe).


def in_box(lon, lat, box):
    return box[0] <= lon <= box[2] and box[1] <= lat <= box[3]


def view_box(box, pad=0.04, min_aspect=1.3):
    """A continent's lon/lat box as a viewBox in map units: the projected box plus a little room,
    widened to at least `min_aspect` (width / height) so tall continents don't make the map
    taller than the screen."""
    lon0, lat0, lon1, lat1 = box
    lons, lats = np.linspace(lon0, lon1, 60), np.linspace(lat0, lat1, 60)
    edge = np.array([(lo, lat0) for lo in lons] + [(lo, lat1) for lo in lons]
                    + [(lon0, la) for la in lats] + [(lon1, la) for la in lats])
    x, y = forward(edge[:, 0], edge[:, 1])
    w, h = x.max() - x.min(), y.max() - y.min()
    x0, y0, w, h = x.min() - w * pad, y.min() - h * pad, w * (1 + 2 * pad), h * (1 + 2 * pad)
    if w / h < min_aspect:
        x0 -= (min_aspect * h - w) / 2
        w = min_aspect * h
    return f'{x0:.2f} {y0:.2f} {w:.2f} {h:.2f}'


def continent_regions(folder, continents, vb):
    """One region per continent for the focus mask, tiling the whole map: every land cell takes
    its country's continent, every sea cell the nearest continent's. So a region needs no
    coastline of its own (the land is drawn elsewhere) and stays small; where two continents
    touch on land (Panama, Suez, the Urals) the cut runs along the border.
    Each country goes to its Natural Earth CONTINENT, except parts lying outside that
    continent's box, which go to the box they lie in (French Guiana, the Canaries, the
    Falklands); Russia goes by side of the Urals (URALS)."""
    ids = [c['id'] for c in continents if 'box' in c]
    boxes = {c['id']: c['box'] for c in continents if 'box' in c}
    russia = len(ids) + 1                   # stand-in value, split by longitude below
    res = 0.1
    h, w = int(round((GRID_NORTH - GRID_SOUTH) / res)) + 1, int(round(360 / res)) + 1
    img = Image.new('L', (w, h), 0)
    pen = ImageDraw.Draw(img)
    for feat in geojson(folder, 'ne_50m_admin_0_countries'):
        props = feat['properties']
        home = NE_CONTINENTS.get(props.get('CONTINENT'))
        geom = feat['geometry']
        polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
        for rings in polys:
            outer = np.array(rings[0])
            lon, lat = outer[:, 0].mean(), outer[:, 1].mean()
            where = home
            if home not in boxes or not in_box(lon, lat, boxes[home]):
                where = next((k for k, b in boxes.items() if in_box(lon, lat, b)), home)
            if where is None:
                continue                    # open-ocean islands: they go to the nearest below
            value = russia if props.get('ADM0_A3') == 'RUS' else ids.index(where) + 1
            for k, ring in enumerate(rings):
                ring = np.array(ring)
                pts = list(zip(((ring[:, 0] + 180) / res).tolist(),
                               ((GRID_NORTH - ring[:, 1]) / res).tolist()))
                pen.polygon(pts, fill=value if k == 0 else 0)
    ll = np.array(img, np.int16)

    # Sample on a coarse grid in map space, then share the sea out to the nearest continent.
    step = 1.0
    x0, y0, vw, vh = vb
    gx, gy = np.meshgrid(x0 + (np.arange(int(vw / step) + 1) + 0.5) * step,
                         y0 + (np.arange(int(vh / step) + 1) + 0.5) * step)
    lon, lat = inverse(gx, gy)
    r = np.clip(np.round((GRID_NORTH - np.nan_to_num(lat)) / res).astype(int), 0, h - 1)
    c = np.clip(np.round((np.nan_to_num(lon) + 180) / res).astype(int), 0, w - 1)
    grid = ll[r, c]
    lon0 = np.nan_to_num(lon)
    side = np.where((lon0 >= 0) & (lon0 < URALS), ids.index('europe') + 1, ids.index('asia') + 1)
    grid[grid == russia] = side[grid == russia]
    grid = fill_from_neighbours(grid, grid == 0) - 1
    # Antarctica and the sea round it go to no continent: hidden whenever one is picked
    # (picking Antarctica itself swaps to the polar map).
    grid[np.nan_to_num(lat, nan=0.0) < ANTARCTIC] = -1
    out = {}
    for k, cid in enumerate(ids):
        mask = np.pad((grid == k).astype(np.float32), 1)
        parts = []
        for contour in measure.find_contours(mask, 0.5):
            pts = simplify([(x0 + (cc - 0.5) * step, y0 + (rr - 0.5) * step) for rr, cc in contour], 0.3)
            if len(pts) >= 4:
                parts.append(path(pts[:-1] if pts[0] == pts[-1] else pts, closed=True))
        out[cid] = ''.join(parts)
    return out


# ---- Antarctica (polar map) ----

def polar_map(folder, biomes, peaks, res):
    """Antarctica round the South Pole: (with landscape blocks, plain land only)."""
    vb = (-POLAR_R, -POLAR_R, 2 * POLAR_R, 2 * POLAR_R)
    south = lambda ring: ring[:, 1].max() < ANTARCTIC     # noqa: E731 (Antarctica's polygons)
    land = ''.join(polygon_path(x['geometry'], forward_polar, south)
                   for x in geojson(folder, 'ne_50m_land'))
    grid = landscape(vb, biomes, peaks, res, inverse_polar, -90)
    blocks = ''.join(f'<path class="world-map__{t}" d="{block_path(grid, k, vb)}"/>'
                     for k, t in enumerate(TYPES))
    on = grid >= 0
    print('  Antarctica: ' + ', '.join(f'{t} {np.mean(grid[on] == k):.0%}' for k, t in enumerate(TYPES)
                                        if np.any(grid[on] == k)))
    def svg(page, layers):
        return (
            '{% comment %}\n'
            f'  Antarctica for the {page} page, round the South Pole (Lambert azimuthal equal-area,\n'
            '  0° up). GENERATED by scripts/make_world_map.py; edit that script, not this file.\n'
            '{% endcomment %}\n'
            f'<svg class="world-map polar-map" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" '
            'aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">'
            # The land is drawn once, as the real path, and the clip refers to it: a <use> copy
            # would not take vector-effect, so a coastline on it would thicken with the zoom.
            '<defs><clipPath id="polar-map-land"><use href="#polar-map-land-shape"/></clipPath></defs>'
            f'<path class="world-map__land" id="polar-map-land-shape" d="{land}" fill-rule="evenodd"/>'
            + layers + '</svg>\n'
        )
    return (svg('Traces', '<g class="world-map__blocks" clip-path="url(#polar-map-land)">' + blocks + '</g>'),
            svg('Avians', ''))


# ---- Main ----

MAIN_LAND_AREA = 5.0   # SVG units²: land polygons at least this big set the map's centre


def map_frame(folder):
    """The world map's viewBox: every piece of land inside it (user, 2026-10-26: "do not trim
    any land"), and the main land centred across it (user, 2026-10-26: the map sat too far
    right). The continents lean east of 0°, while the outermost land (Pacific islands at ±180°)
    sits evenly at both edges; so the frame is centred on the main land's middle (polygons of at
    least MAIN_LAND_AREA, Antarctica aside: its strip spans the whole map) and made wide enough
    to reach the farthest land on either side, which leaves some open ocean on the right."""
    every, main = [], []
    for feat in geojson(folder, 'ne_50m_land'):
        geom = feat['geometry']
        polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
        for rings in polys:
            ring = np.array(rings[0])
            x, y = forward(ring[:, 0], ring[:, 1])
            box = (x.min(), y.min(), x.max(), y.max())
            every.append(box)
            if ring[:, 1].max() >= ANTARCTIC and area(list(zip(x.tolist(), y.tolist()))) >= MAIN_LAND_AREA:
                main.append(box)
    centre = (min(b[0] for b in main) + max(b[2] for b in main)) / 2
    pad = 0.7
    half = max(centre - min(b[0] for b in every), max(b[2] for b in every) - centre) + pad
    y0 = min(b[1] for b in every) - pad
    y1 = max(b[3] for b in every) + pad
    return round(centre - half, 2), round(y0, 2), round(2 * half, 2), round(y1 - y0, 2)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('folder', help='folder holding the downloaded data (see above)')
    ap.add_argument('--out', default='_includes/places/world-map.svg')
    ap.add_argument('--polar-out', default='_includes/places/antarctica-map.svg')
    # Plain versions (land and borders only) for the Avians page (user, 2026-10-25: its map has
    # no landscape information).
    ap.add_argument('--plain-out', default='_includes/places/world-map-plain.svg')   # land, water, borders
    ap.add_argument('--polar-plain-out', default='_includes/places/antarctica-map-plain.svg')
    args = ap.parse_args()
    f = args.folder
    continents = yaml.safe_load((ROOT / '_data' / 'continents.yml').read_text(encoding='utf-8'))

    land = ''.join(polygon_path(x['geometry']) for x in geojson(f, 'ne_50m_land'))
    vb = map_frame(f)

    print('landscape …')
    biomes, res = biome_grid(f)
    peaks = mountains(f, biomes.shape)
    # Cells no ecoregion covers (lakes, coastal slivers) take the nearest covered cell's biome.
    filled = fill_from_neighbours(biomes, biomes == 0)
    grid = landscape(vb, filled, peaks, res, inverse, -90)
    blocks = ''.join(f'<path class="world-map__{t}" d="{block_path(grid, k, vb)}"/>'
                     for k, t in enumerate(TYPES))
    print('  share of the map grid (sea included, trimmed by the coast later): '
          + ', '.join(f'{t} {np.mean(grid[grid >= 0] == k):.1%}' for k, t in enumerate(TYPES)))

    lakes = ''.join(polygon_path(x['geometry']) for x in geojson(f, 'ne_50m_lakes')
                    if (x['properties'].get('scalerank') or 0) <= LAKE_MAX_RANK)
    print('rivers …')
    ice = TYPES.index('ice') + 1

    def on_ice(lon, lat):
        r, c = int(round((GRID_NORTH - lat) / res)), int(round((lon + 180) / res))
        return 0 <= r < biomes.shape[0] and 0 <= c < biomes.shape[1] and biomes[r, c] == ice

    major, other = rivers(f, on_ice)

    solid, dashed = [], []
    for x in geojson(f, 'ne_50m_admin_0_boundary_lines_land'):
        kind = x['properties'].get('FEATURECLA', '')
        (solid if kind.startswith('International') else dashed).append(line_path(x['geometry']))

    print('continents …')
    regions = continent_regions(f, continents, vb)
    # Each continent's region, with its zoom box (data-view) for places-map.js.
    focus = ''.join(f'<path class="world-map__focus" data-continent="{c["id"]}" '
                    f'data-view="{view_box(c["box"])}" d="{regions[c["id"]]}"/>'
                    for c in continents if 'box' in c)

    def world_svg(page, sources, layers):
        return (
            '{% comment %}\n'
            f'  World map for the {page} page. GENERATED by scripts/make_world_map.py ({sources};\n'
            '  Equal Earth ×100); edit that script, not this file. Colours come from\n'
            '  _places.scss; places-map.js reads the viewBox and the continents\' zoom boxes\n'
            '  (data-view), and fades continents through the mask.\n'
            '{% endcomment %}\n'
            f'<svg class="world-map" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" '
            'aria-hidden="true" '
            'focusable="false" preserveAspectRatio="xMidYMid meet">'
            # The land is drawn once, as the real path, and the clip refers to it (see polar_map).
            '<defs><clipPath id="world-map-land"><use href="#world-map-land-shape"/></clipPath>'
            '<mask id="world-map-focus" maskUnits="userSpaceOnUse" x="-300" y="-200" width="600" height="400">'
            + focus + '</mask></defs>'
            '<g class="world-map__content">'
            f'<path class="world-map__land" id="world-map-land-shape" d="{land}" fill-rule="evenodd"/>'
            + layers +
            f'<path class="world-map__borders" d="{"".join(solid)}"/>'
            f'<path class="world-map__borders world-map__borders--disputed" d="{"".join(dashed)}"/>'
            '</g></svg>\n'
        )

    # Water: lakes and rivers, on both maps (user, 2026-10-25: Avians shows the water too).
    water = (
        f'<path class="world-map__lakes" d="{lakes}"/>'
        f'<path class="world-map__rivers" d="{other}"/>'
        f'<path class="world-map__rivers world-map__rivers--major" d="{major}"/>'
    )
    landscape_layers = '<g class="world-map__blocks" clip-path="url(#world-map-land)">' + blocks + '</g>' + water
    polar, polar_plain = polar_map(f, filled, peaks, res)
    outputs = [
        (args.out, world_svg('Traces', 'Natural Earth, RESOLVE Ecoregions, NOAA ETOPO, HydroRIVERS',
                             landscape_layers)),
        (args.plain_out, world_svg('Avians', 'Natural Earth, HydroRIVERS', water)),
        (args.polar_out, polar),
        (args.polar_plain_out, polar_plain),
    ]
    for out, text in outputs:
        Path(out).write_text(text)
        print(f'{len(text) / 1024:.0f} KB → {out}')
    print(f'viewBox {" ".join(map(str, vb))}')


if __name__ == '__main__':
    main()
