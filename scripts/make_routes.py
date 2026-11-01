"""Trace each trip in _data/places.yml along real roads, for the Traces page's route lines.

For every route under `routes:` it finds the shortest way along the road network from each stop
to the next, joins the legs, smooths away detail too fine to see at map scale, and writes the
paths to _data/route_paths.yml (GENERATED: don't edit by hand, rerun this script). The page draws
a route from its path there, or straight from stop to stop if it has none (user, 2026-10-25:
the line should follow the highways' bends, not run flat and straight).

Roads: Natural Earth 1:10m roads (public domain). Download it first (~50 MB), e.g.
  curl -L -o ne_10m_roads.geojson \
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_roads.geojson
then run, with PyYAML installed (the gallery env has it):
  python scripts/make_routes.py ne_10m_roads.geojson

A stop that is off the network (a small spur road Natural Earth leaves out, like the one into
Talkeetna) is joined to its nearest road point by a short straight stub, drawn in and back out.
A stop with `gap_before: true` gets no line from the stop before it (user, 2026-10-25: no line
from Talkeetna to Denali), so the route is drawn as separate stretches.
The summary printed at the end lists each stop's distance from the road, to catch typos in
lat/lon.
"""

import argparse
import heapq
import json
import math
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
PLACES = ROOT / '_data' / 'places.yml'
OUT = ROOT / '_data' / 'route_paths.yml'

JOIN_KM = 1.5       # road pieces whose ends are this close count as connected
STUB_KM = 5.0       # a stop farther than this from the road gets a straight stub to it (closer
                    # gaps are only the 0.1° rounding of the stops; no stub needed)
SIMPLIFY_DEG = 0.01  # ~1 km: far below a pixel on the world map, but keeps every bend you can see
MARGIN_DEG = 3       # only roads within this many degrees of a route's stops are loaded


# ---- Geometry helpers ----

def km(a, b):
    """Great-circle distance in km between two (lon, lat) points."""
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def simplify(points, tol):
    """Douglas–Peucker on (lon, lat), with longitude shrunk by cos(lat) so both axes are fair."""
    if len(points) < 3:
        return points
    k = math.cos(math.radians(sum(p[1] for p in points) / len(points)))

    def dist(p, a, b):
        ax, ay, bx, by, px, py = a[0] * k, a[1], b[0] * k, b[1], p[0] * k, p[1]
        dx, dy = bx - ax, by - ay
        if dx == dy == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - ax - t * dx, py - ay - t * dy)

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        best, at = 0, None
        for m in range(i + 1, j):
            d = dist(points[m], points[i], points[j])
            if d > best:
                best, at = d, m
        if at is not None and best > tol:
            keep[at] = True
            stack += [(i, at), (at, j)]
    return [p for p, kept in zip(points, keep) if kept]


# ---- Road network ----

def load_network(path, box):
    """Graph of road vertices inside box (lon0, lat0, lon1, lat1): {node: {neighbour: km}}."""
    lon0, lat0, lon1, lat1 = box
    graph, ends = {}, []

    def node(p):
        return (round(p[0], 5), round(p[1], 5))

    def link(a, b):
        d = km(a, b)
        graph.setdefault(a, {})[b] = d
        graph.setdefault(b, {})[a] = d

    for f in json.load(open(path))['features']:
        if f['properties'].get('type') == 'Ferry Route':
            continue
        g = f['geometry']
        lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for line in lines:
            if not any(lon0 <= p[0] <= lon1 and lat0 <= p[1] <= lat1 for p in line):
                continue
            pts = [node(p) for p in line]
            for a, b in zip(pts, pts[1:]):
                if a != b:
                    link(a, b)
            ends += [pts[0], pts[-1]]

    # Natural Earth's pieces don't always share an exact vertex where roads meet: join each loose
    # end to the nearest other point within JOIN_KM.
    nodes = list(graph)
    for e in ends:
        best = min((n for n in nodes if n != e and n not in graph[e]), key=lambda n: km(e, n), default=None)
        if best is not None and km(e, best) <= JOIN_KM:
            link(e, best)
    return graph


def shortest(graph, a, b):
    """Dijkstra from node a to node b; the list of nodes, or None if they aren't connected."""
    dist, prev, todo = {a: 0}, {}, [(0, a)]
    while todo:
        d, n = heapq.heappop(todo)
        if n == b:
            path = [b]
            while path[-1] != a:
                path.append(prev[path[-1]])
            return path[::-1]
        if d > dist[n]:
            continue
        for m, w in graph[n].items():
            if d + w < dist.get(m, math.inf):
                dist[m], prev[m] = d + w, n
                heapq.heappush(todo, (d + w, m))
    return None


# ---- Main ----

def trace(route, roads):
    stops = [(s['lon'], s['lat']) for s in route['stops']]
    box = (min(p[0] for p in stops) - MARGIN_DEG, min(p[1] for p in stops) - MARGIN_DEG,
           max(p[0] for p in stops) + MARGIN_DEG, max(p[1] for p in stops) + MARGIN_DEG)
    graph = load_network(roads, box)
    nodes = list(graph)
    snapped = [min(nodes, key=lambda n: km(s, n)) for s in stops]

    # One list of points per unbroken stretch: a stop with `gap_before: true` starts a new one.
    pieces, path = [], []
    for i in range(len(stops) - 1):
        if route['stops'][i + 1].get('gap_before'):
            if path:
                pieces.append(path)
            path = []
            continue
        leg = shortest(graph, snapped[i], snapped[i + 1])
        if leg is None:
            raise SystemExit(f"{route['id']}: no road from stop {i + 1} to stop {i + 2}")
        # Stubs: out from a stop that is off the road, and in to the next one.
        if km(stops[i], snapped[i]) > STUB_KM:
            leg = [stops[i]] + leg
        if km(stops[i + 1], snapped[i + 1]) > STUB_KM:
            leg = leg + [stops[i + 1]]
        path += leg if not path else leg[1:] if leg[0] == path[-1] else leg
    if path:
        pieces.append(path)

    print(f"{route['id']}:")
    for s, n, st in zip(route['stops'], snapped, stops):
        print(f"  {s['name']['en']:<20} {km(st, n):5.1f} km from the road")
    out = [simplify(piece, SIMPLIFY_DEG) for piece in pieces]
    print(f"  {len(pieces)} stretch(es), {sum(map(len, pieces))} road points → "
          f"{sum(map(len, out))} after smoothing")
    return [[[round(p[0], 3), round(p[1], 3)] for p in piece] for piece in out]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('roads', help='Natural Earth ne_10m_roads.geojson')
    args = ap.parse_args()

    routes = yaml.safe_load(open(PLACES, encoding='utf-8')).get('routes') or []
    lines = ['# GENERATED by scripts/make_routes.py from the routes in places.yml and Natural Earth',
             '# 1:10m roads (public domain). Do not edit; rerun the script. Each route: a list of',
             '# unbroken stretches (split at stops with gap_before), each a list of [lon, lat] points',
             '# along the roads, in travel order.']
    for r in routes:
        lines.append(f"{r['id']}:")
        for piece in trace(r, args.roads):
            lines += [f"  {'-' if i == 0 else ' '} - [{p[0]}, {p[1]}]" for i, p in enumerate(piece)]
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == '__main__':
    main()
