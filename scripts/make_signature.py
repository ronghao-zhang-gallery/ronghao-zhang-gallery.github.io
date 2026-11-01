"""
Builds the handwritten "Ronghao Zhang" for the homepage title as an SVG include, written the
way a hand writes it.

How it works
  1. Shape the text in the script font and draw it as a black-and-white image.
  2. Thin the letters to their centre line (the path a pen nib would follow) and turn that line
     into a graph: stroke ends, crossings, and the pieces of line between them.
  3. Walk the graph like a hand: start at the left end of each word, and at every crossing
     carry on in the straightest direction. At a dead end the pen runs quickly back over what it
     already drew to the nearest undrawn line, so it only lifts where the ink is not connected.
  4. Cut the walk into short pieces timed one after another at a steady speed. Each piece owns
     exactly the ink closest to its stretch of the path. On the page these areas appear in turn
     through an SVG mask (see _sass/components/_signature.scss), so the name appears along the
     pen's path and nothing shows before the pen reaches it.

Run it again after changing the text, font or timing:

    /opt/miniconda3/envs/gallery/bin/python scripts/make_signature.py
    /opt/miniconda3/envs/gallery/bin/python scripts/make_signature.py --preview out.png

--preview also saves a picture of the pen path, coloured from blue (first) to red (last), with
each pen-down numbered.
Needs fontTools, uharfbuzz, numpy, scipy, scikit-image, skan and Pillow (all in the gallery env).
Font: Mrs Saint Delafield (scripts/fonts/, SIL Open Font License, see OFL.txt there).
Output: _includes/home/signature.svg
"""
import math
import os
import sys

import numpy as np
import uharfbuzz as hb
from fontTools.pens.basePen import BasePen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from scipy import ndimage as ndi
from skimage.draw import polygon as fill_polygon
from skimage.measure import approximate_polygon, find_contours
from skimage.morphology import skeletonize
from skan import Skeleton

# ---- Settings ----
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "scripts", "fonts", "MrsSaintDelafield-Regular.ttf")
OUT = os.path.join(ROOT, "_includes", "home", "signature.svg")
TEXT = "Ronghao Zhang"

START = 0.3          # seconds before the pen touches down
SIGNED = 3.0         # seconds until the name is finished, pauses included
WORD_PAUSE = 0.18    # pen lifted between the two words
LIFT_PAUSE = 0.05    # pen lifted within a word (e.g. after a flourish)
SCALE = 0.5          # image pixels per font unit while tracing (one em is 1000 units)
PAD = 40             # space around the name in the SVG, in font units
SHARE = 3            # image pixels: ink this much closer to a later stroke still goes with the earlier
CHUNK = 24           # length of one pen piece, in image pixels (shorter = smoother reveal, bigger file)
START_BONUS = 300    # image pixels of head start for a free stroke end (Z hook before Z loop,
                     # but the o before the stem of the h)
LEFT_BIAS = 0.02     # radians of turn traded per image pixel further left (50 px ≈ 1 rad)
TANGENT = 30         # image pixels over which a stroke's direction is judged
RETRACE_PENALTY = 0.4  # radians: how much straighter a drawn line must be to run back along it
RETRACE = 4.0        # running back over a drawn line is this many times faster than drawing


# ---- 1. Shape the text and draw it ----
def bezier(points, t):
    """Point at t on a Bézier curve of any degree (de Casteljau)."""
    pts = list(points)
    while len(pts) > 1:
        pts = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]) for a, b in zip(pts, pts[1:])]
    return pts[0]


def shaped_glyphs():
    """Glyph outlines placed along the line, plus the x (font units) where the second word starts."""
    with open(FONT, "rb") as f:
        font_bytes = f.read()
    buf = hb.Buffer()
    buf.add_str(TEXT)
    buf.guess_segment_properties()
    hb.shape(hb.Font(hb.Face(font_bytes)), buf, {"kern": True, "liga": True, "calt": True})

    tt = TTFont(FONT)
    glyphs, order = tt.getGlyphSet(), tt.getGlyphOrder()
    placed, x, word_x = [], 0, None
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        ox, oy = x + pos.x_offset, pos.y_offset
        x += pos.x_advance
        rec = RecordingPen()
        glyphs[name].draw(rec)
        if not rec.value:                       # the space between the words
            word_x = x
            continue
        svg = SVGPathPen(glyphs)
        glyphs[name].draw(svg)
        placed.append({"glyph": glyphs[name], "glyphs": glyphs, "d": svg.getCommands(), "x": ox, "y": oy})
    return placed, word_x


class ContourPen(BasePen):
    """Collects a glyph's contours as point lists, sampling every curve into short lines.
    BasePen splits TrueType curves with several control points into single curves first."""

    def __init__(self, glyphs, dx, dy):
        super().__init__(glyphs)
        self.dx, self.dy, self.contours, self.cur = dx, dy, [], []

    def _point(self, p):
        self.cur.append((p[0] + self.dx, p[1] + self.dy))

    def _moveTo(self, p):
        self.cur = []
        self._point(p)

    def _lineTo(self, p):
        self._point(p)

    def _curveToOne(self, c1, c2, p):
        start = self._getCurrentPoint()
        for k in range(1, 11):
            self._point(bezier((start, c1, c2, p), k / 10))

    def _qCurveToOne(self, c, p):
        start = self._getCurrentPoint()
        for k in range(1, 11):
            self._point(bezier((start, c, p), k / 10))

    def _closePath(self):
        if self.cur:
            self.contours.append(self.cur)
        self.cur = []

    _endPath = _closePath


def outlines(placed):
    """Contours of each glyph as point lists in font units. Returns one list per glyph."""
    per_glyph = []
    for g in placed:
        pen = ContourPen(g["glyphs"], g["x"], g["y"])
        g["glyph"].draw(pen)
        per_glyph.append(pen.contours)
    return per_glyph


def rasterise(per_glyph):
    """Black-and-white image of the name and its font-unit box. Holes inside a letter use the
    even-odd rule; letters are then added together, because joined letters overlap and the
    overlap is ink, not a hole."""
    contours = [c for glyph in per_glyph for c in glyph]
    xs = [p[0] for c in contours for p in c]
    ys = [p[1] for c in contours for p in c]
    box = (min(xs), min(ys), max(xs), max(ys))
    width = int((box[2] - box[0]) * SCALE) + 21
    height = int((box[3] - box[1]) * SCALE) + 21
    ink = np.zeros((height, width), bool)
    for glyph in per_glyph:
        letter = np.zeros_like(ink)
        for c in glyph:
            cols = np.array([(x - box[0]) * SCALE + 10 for x, _ in c])
            rows = np.array([(box[3] - y) * SCALE + 10 for _, y in c])
            mask = np.zeros_like(ink)
            rr, cc = fill_polygon(rows, cols, ink.shape)
            mask[rr, cc] = True
            letter ^= mask
        ink |= letter
    # Drop specks left where curves meet (a few pixels); the end-of-signing fill shows them anyway.
    labels, count = ndi.label(ink, np.ones((3, 3)))
    sizes = ndi.sum(ink, labels, range(1, count + 1))
    for k, size in enumerate(sizes, start=1):
        if size < 20:
            ink[labels == k] = False
    return ink, box


# ---- 2. Centre line → graph ----
def skeleton_graph(ink):
    """Edges (pixel chains) between nodes (stroke ends and crossings), and for every centre-line
    pixel how far the ink it has to reveal reaches (the farthest ink pixel that is closer to it
    than to any other centre-line pixel; this covers wide wedges such as the Z's top stroke).
    skan splits the centre line at every end and crossing; crossings that thinning split into
    a few pixels joined by tiny links are merged back into one node."""
    thin = skeletonize(ink)
    skel = Skeleton(thin)
    gap, (near_r, near_c) = ndi.distance_transform_edt(~thin, return_indices=True)
    radius = np.zeros(ink.shape)
    np.maximum.at(radius, (near_r[ink], near_c[ink]), gap[ink])
    paths = [(int(skel.path(i)[0]), int(skel.path(i)[-1]),
              [tuple(int(round(v)) for v in rc) for rc in skel.path_coordinates(i)])
             for i in range(skel.n_paths)]

    degree = {}
    for a, b, _ in paths:
        degree[a] = degree.get(a, 0) + 1
        degree[b] = degree.get(b, 0) + 1
    parent = {n: n for n in degree}

    def root(n):
        while parent[n] != n:
            n = parent[n]
        return n

    tiny = set()
    for k, (a, b, px) in enumerate(paths):
        if degree[a] >= 3 and degree[b] >= 3 and len(px) <= 6:
            parent[root(a)] = root(b)
            tiny.add(k)
    edges = [{"a": root(a), "b": root(b), "px": px} for k, (a, b, px) in enumerate(paths) if k not in tiny]
    return edges, radius


def prune_spurs(edges, radius):
    """Drop the short whiskers thinning leaves at stroke ends and sharp corners."""
    for _ in range(2):
        def degree(node):
            return sum((e["a"] == node) + (e["b"] == node) for e in edges)

        keep = []
        for e in edges:
            da, db = degree(e["a"]), degree(e["b"])
            whisker = (da == 1) != (db == 1)          # one free end, the other on a crossing
            if whisker and len(e["px"]) < 1.8 * max(radius[p] for p in e["px"]):
                continue
            keep.append(e)
        edges = keep
    return edges


# ---- 3. Walk the graph like a hand ----
def direction(px, step=None):
    """Unit direction (x, y) from the first pixel of a chain to a point a little further along
    (TANGENT pixels: long enough that small kinks where the centre line meets a joint don't
    mislead it)."""
    step = step or TANGENT
    a, b = px[0], px[min(step, len(px) - 1)]
    dx, dy = b[1] - a[1], b[0] - a[0]
    n = math.hypot(dx, dy) or 1.0
    return dx / n, dy / n


def write_order(edges, word_col):
    """Pen-downs in writing order. Each is a list of moves {"px": chain, "draw": bool}: a drawn
    line, or a quick run back over a line already drawn (as a hand goes back up the stem of an
    h instead of lifting the pen). The pen only lifts where the ink is not connected."""
    import heapq

    unused = set(range(len(edges)))
    at = {}
    for i, e in enumerate(edges):
        at.setdefault(e["a"], []).append(i)
        at.setdefault(e["b"], []).append(i)

    def oriented(i, node):
        e = edges[i]
        return e["px"] if e["a"] == node else e["px"][::-1]

    def other(i, node):
        return edges[i]["b"] if edges[i]["a"] == node else edges[i]["a"]

    def nearest_unused(node, in_word):
        """Shortest way along drawn lines to a crossing that still has undrawn lines."""
        best = {node: 0.0}
        queue = [(0.0, id(node), node, [])]
        while queue:
            cost, _, here, route = heapq.heappop(queue)
            if any(j in unused and in_word(j) for j in at.get(here, [])):
                return here, route
            for j in at.get(here, []):
                there = other(j, here)
                c = cost + len(edges[j]["px"])
                if c < best.get(there, 1e18):
                    best[there] = c
                    heapq.heappush(queue, (c, id(there), there, route + [(j, here)]))
        return None, None

    # Separate pieces of ink (pen-downs) are written in the order they start, left to right, so a
    # small mark that begins right of a letter's start (the tick on a g) comes after that letter.
    piece_of, piece_left = {}, {}
    for i in range(len(edges)):
        if i in piece_of:
            continue
        todo, members = [i], []
        piece_of[i] = i
        while todo:
            j = todo.pop()
            members.append(j)
            for node in (edges[j]["a"], edges[j]["b"]):
                for k in at[node]:
                    if k not in piece_of:
                        piece_of[k] = i
                        todo.append(k)
        piece_left[i] = min(p[1] for j in members for p in edges[j]["px"])

    strokes = []
    for word in (0, 1):
        def in_word(i):
            return (np.mean([p[1] for p in edges[i]["px"]]) < word_col) == (word == 0)

        rows = [p[0] for i in range(len(edges)) if in_word(i) for p in edges[i]["px"]]
        high = min(rows) + 0.5 * (max(rows) - min(rows))   # strokes start above this line

        while any(in_word(i) for i in unused):
            # Pen down where a writer would: in the piece of ink that starts furthest left, at its
            # leftmost, highest point, where a free stroke end in the upper half of the line gets
            # a head start of START_BONUS pixels (strokes begin at such ends, e.g. the hook inside
            # the Z; descender tips never qualify).
            options = []
            for i in unused:
                if not in_word(i):
                    continue
                for node, p in ((edges[i]["a"], edges[i]["px"][0]), (edges[i]["b"], edges[i]["px"][-1])):
                    free = sum(j in unused for j in at[node]) == 1
                    bonus = START_BONUS if free and p[0] <= high else 0
                    # Left and high first; lower points count as further right.
                    options.append((piece_left[piece_of[i]], p[1] + 0.5 * p[0] - bonus, i, node))
            *_, i, node = min(options)

            moves, trail = [], []

            def travel():
                # Direction of travel over the last stretch of the pen's path, across joints, so a
                # tiny piece between two close joints doesn't decide the direction on its own.
                back = direction(trail[::-1], step=TANGENT)
                return (-back[0], -back[1])

            while True:
                chain = oriented(i, node)
                moves.append({"px": chain, "draw": True})
                trail.extend(chain)
                unused.discard(i)
                node = other(i, node)
                heading = travel()
                # Carry on along the straightest undrawn line, however sharp the turn (script has
                # sharp turns at the tops of n, m and h), but favour lines that reach further left:
                # writing runs left to right, so a hand closes the bowl of an o or a before
                # joining on. Lines that reach equally far left (the stem and the hump of an h)
                # are decided by straightness alone.
                options = [j for j in at.get(node, []) if j in unused and in_word(j)]
                centre = {j: min(p[1] for p in edges[j]["px"]) for j in options}
                best, best_score = None, 1e9
                for j in options:
                    d = direction(oriented(j, node))
                    turn = math.acos(max(-1.0, min(1.0, d[0] * heading[0] + d[1] * heading[1])))
                    score = turn + LEFT_BIAS * (centre[j] - min(centre.values()))
                    if score < best_score:
                        best, best_score = j, score
                # A hand also runs straight back up a line it has just drawn rather than make a
                # hairpin turn (the R: down its long loop and back up into the bowl, not off into
                # the stem). So a drawn line that continues much more straight is taken instead,
                # as a quick run that draws nothing, if undrawn lines wait at its far end.
                for j in at.get(node, []):
                    if j in unused or j == i or not in_word(j):
                        continue
                    far = other(j, node)
                    if not any(k in unused and in_word(k) for k in at.get(far, [])):
                        continue
                    d = direction(oriented(j, node))
                    turn = math.acos(max(-1.0, min(1.0, d[0] * heading[0] + d[1] * heading[1])))
                    if turn + RETRACE_PENALTY < best_score:
                        moves.append({"px": oriented(j, node), "draw": False})
                        trail.extend(oriented(j, node))
                        node = far
                        heading = travel()
                        best = None
                        options = [k for k in at.get(node, []) if k in unused and in_word(k)]
                        best = min(options, key=lambda k: math.acos(max(-1.0, min(1.0,
                                   direction(oriented(k, node))[0] * heading[0] +
                                   direction(oriented(k, node))[1] * heading[1]))))
                        break
                if best is not None:
                    i = best
                    continue
                # Nothing undrawn here: run back over drawn lines to the nearest undrawn one.
                target, route = nearest_unused(node, in_word)
                if target is None:
                    break
                for j, frm in route:
                    moves.append({"px": oriented(j, frm), "draw": False})
                    trail.extend(oriented(j, frm))
                node = target
                options = [j for j in at[node] if j in unused and in_word(j)]
                i = min(options, key=lambda j: np.mean([p[1] for p in edges[j]["px"]]))
            strokes.append({"word": word, "moves": moves})
    return strokes


# ---- 4. Pen paths and timing ----
def outline_path(area):
    """SVG path (SVG user units, even-odd) tracing the edges of a black-and-white image area."""
    if not area.any():
        return ""
    rows, cols = np.nonzero(area)
    r0, c0 = max(rows.min() - 2, 0), max(cols.min() - 2, 0)
    crop = np.pad(area[r0:rows.max() + 3, c0:cols.max() + 3], 1).astype(float)
    parts = []
    for contour in find_contours(crop, 0.5):
        pts = approximate_polygon(contour, tolerance=0.6)
        if len(pts) < 3:
            continue
        xy = [((c - 1 + c0 - 10) / SCALE + PAD, (r - 1 + r0 - 10) / SCALE + PAD) for r, c in pts]
        parts.append("M" + " L".join(f"{x:.0f} {y:.0f}" for x, y in xy) + "Z")
    return "".join(parts)


def build(preview=None):
    placed, word_x = shaped_glyphs()
    ink, box = rasterise(outlines(placed))
    edges, radius = skeleton_graph(ink)
    edges = prune_spurs(edges, radius)
    strokes = write_order(edges, (word_x - box[0]) * SCALE + 10)

    # Cut each pen-down into short pieces. Runs back over drawn lines take time (at RETRACE times
    # the speed) but draw nothing.
    pieces, total = [], 0.0
    for s in strokes:
        s["pieces"] = []
        for move in s["moves"]:
            px = [move["px"][0]] + [p for a, p in zip(move["px"], move["px"][1:]) if p != a]
            for k in range(0, len(px) - 1, CHUNK):
                seg = px[k:k + CHUNK + 1]
                if len(seg) < 2:
                    continue
                length = sum(math.dist(a, b) for a, b in zip(seg, seg[1:])) / SCALE
                piece = {"px": seg, "length": length if move["draw"] else length / RETRACE, "draw": move["draw"]}
                s["pieces"].append(piece)
                total += piece["length"]
        pieces.extend(p for p in s["pieces"] if p["draw"])

    # Each piece reveals the ink around its stretch of the pen's path, so nothing shows before the
    # pen gets there, not even at joints where strokes meet. Ink that is (almost) as close to an
    # earlier stretch as to its nearest one goes with the earlier one: where two strokes overlap,
    # the ink appears with whichever passes first, leaving no gap in a stroke already drawn.
    # Pieces are grown by one pixel so neighbours overlap and no hairline seam shows between them.
    path = np.zeros(ink.shape, bool)
    for piece in pieces:
        for r, c in piece["px"]:
            path[r, c] = True
    nearest = ndi.distance_transform_edt(~path)
    reach = int(nearest[ink].max()) + SHARE + 2
    region = np.full(ink.shape, -1)
    for k, piece in enumerate(pieces):               # earliest first
        rows = [r for r, _ in piece["px"]]
        cols = [c for _, c in piece["px"]]
        r0, r1 = max(min(rows) - reach, 0), min(max(rows) + reach + 1, ink.shape[0])
        c0, c1 = max(min(cols) - reach, 0), min(max(cols) + reach + 1, ink.shape[1])
        own = np.ones((r1 - r0, c1 - c0), bool)
        for r, c in piece["px"]:
            own[r - r0, c - c0] = False
        near = ndi.distance_transform_edt(own)
        win = region[r0:r1, c0:c1]
        take = ink[r0:r1, c0:c1] & (win < 0) & (near <= nearest[r0:r1, c0:c1] + SHARE)
        win[take] = k
    for k, piece in enumerate(pieces):
        area = ndi.binary_dilation(region == k, iterations=1)
        piece["d"] = outline_path(area)

    # Timing: one steady pen speed, short pauses where the pen lifts.
    lifts = [WORD_PAUSE if a["word"] != b["word"] else LIFT_PAUSE for a, b in zip(strokes, strokes[1:])]
    speed = total / (SIGNED - START - sum(lifts))
    t = START
    for k, s in enumerate(strokes):
        for piece in s["pieces"]:
            piece["delay"] = t
            piece["duration"] = piece["length"] / speed
            t += piece["duration"]
        if k < len(lifts):
            t += lifts[k]

    width = (ink.shape[1] - 20) / SCALE + 2 * PAD
    height = (ink.shape[0] - 20) / SCALE + 2 * PAD
    letters = "".join(
        f'    <path transform="translate({g["x"] - box[0] + PAD:.0f} {box[3] + PAD - g["y"]:.0f}) scale(1 -1)"'
        f' d="{g["d"]}"/>\n'
        for g in placed
    )
    pens = "".join(
        f'    <path class="signature__pen" d="{p["d"]}" style="--delay: {p["delay"]:.3f}s; --duration: {p["duration"]:.3f}s"/>\n'
        for p in pieces if p["d"]
    )
    svg = (
        "{% comment %}\n"
        "  Handwritten \"Ronghao Zhang\" for the homepage title, revealed along the pen's path in\n"
        "  writing order. GENERATED by scripts/make_signature.py; edit that script, not this file.\n"
        "{% endcomment %}\n"
        f'<svg class="signature" viewBox="0 0 {width:.0f} {height:.0f}" aria-hidden="true" focusable="false"'
        f' style="--signed: {SIGNED:.2f}s">\n'
        f'  <mask id="signature-pen" maskUnits="userSpaceOnUse" x="0" y="0" width="{width:.0f}" height="{height:.0f}">\n'
        + pens
        + f'    <rect class="signature__done" width="{width:.0f}" height="{height:.0f}"/>\n'
        "  </mask>\n"
        '  <g class="signature__letters" mask="url(#signature-pen)">\n'
        + letters
        + "  </g>\n"
        "</svg>\n"
    )
    with open(OUT, "w") as f:
        f.write(svg)
    print(f"wrote {OUT}: {len(strokes)} pen-downs, {len(pieces)} pen pieces, signed in {SIGNED:.2f} s")

    if preview:
        save_preview(preview, ink, strokes)


def save_preview(path, ink, strokes):
    """The pen path over the letters, blue at the start through to red at the end."""
    from PIL import Image, ImageDraw

    img = Image.fromarray(np.where(ink, 215, 255).astype(np.uint8)).convert("RGB")
    draw = ImageDraw.Draw(img)
    pts = [(p[1], p[0]) for s in strokes for m in s["moves"] if m["draw"] for p in m["px"]]
    for n, (x, y) in enumerate(pts):
        f = n / max(1, len(pts) - 1)
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(int(255 * f), 40, int(255 * (1 - f))))
    for k, s in enumerate(strokes):
        y, x = s["moves"][0]["px"][0]
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), outline=(0, 150, 0), width=3)
        draw.text((x + 10, y - 16), str(k + 1), fill=(0, 120, 0))
    img.save(path)


if __name__ == "__main__":
    build(sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None)
