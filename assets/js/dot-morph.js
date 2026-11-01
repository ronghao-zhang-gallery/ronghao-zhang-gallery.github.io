/*
 * Dot morph: one field of coloured dots that changes from picture to picture as you scroll.
 *
 * How it works
 *   1. Each shape in window.DotShapes (dot-shapes.js) is painted on a hidden canvas and turned
 *      into dots: more dots where a pixel differs more from the picture's background (light
 *      paper or a dark backdrop alike), and every dot takes the colour of the spot it came from.
 *      A shape is a painting function or { image: url, imageDark: url, outline: [[x, y], ...] }:
 *      imageDark (optional) is a version of the picture for dark mode, and the optional outline
 *      (in the picture's pixels) keeps only the subject inside it and crops to it.
 *      Each subject is scaled to fill the same box, so a small subject comes out as large as
 *      the rest.
 *   2. The scroll position picks two neighbouring shapes and how far along the change is.
 *      Nothing runs on a timer: every scroll position is one exact frame, so scrolling back
 *      plays the change backwards and stopping halfway leaves the dots between shapes.
 *   3. Wide screens alternate sides: shape 1 on the left, shape 2 on the right, and so on; the
 *      dots cross the screen as they change. Every shape after the first lines up with the top
 *      bar's content: its outer edge on the site name or the light/dark switch (user, 2026-10-23). WebGL draws round dots, sized to the window. Each
 *      dot leaves at its own moment, rises in an arch as it crosses the screen, loosens into a
 *      sparse cloud halfway, and shifts from its old colour to its new one on the way.
 *   4. A shape with place: 'band' (the landscape) spans the content column's width, flat-on,
 *      low on the screen, with its text line centred in the space above it (user, 2026-10-23);
 *      the dots behind that text fade so it stays readable while they fall past it.
 *      Changes into a band fall downward and build it from the ground up; changes out of it
 *      rise from the top down (user, 2026-10-22).
 *      Phones: a shape with phonePlace: 'low' (the warbler) sits under its text line, which goes
 *      to the top, and changes into and out of it fall and rise the same way (user, 2026-11-01).
 *      On phones each line sits close to its picture (--pic-foot under a picture and its
 *      caption, sharePhoneFeet()), and dots are smaller.
 *   5. On page load the dots fly in from a wide scatter while the name is signed, starting in
 *      the page's own colour and settling into the picture's colours (user, 2026-10-22).
 *   6. Every shape has a light-mode and a dark-mode set of dots (the same set when there is no
 *      imageDark). Switching the theme glides each dot from one set to the other in about a
 *      second, rippling like the scroll change (user, 2026-10-21).
 *
 * Markup: [data-dot-stage] holds a <canvas> and one [data-dot-step] per shape.
 * Colours are nudged towards the page's opposite (white in dark mode, black in light mode), so
 * colours close to the page background stay visible. Needs 10 vertex attributes (WebGL
 * guarantees 8; every current browser offers 16).
 */
(function () {
  'use strict';

  // ---- Elements ----
  var stage = document.querySelector('[data-dot-stage]');
  if (!stage || !window.DotShapes) return;
  var canvas = stage.querySelector('canvas');
  var steps = stage.querySelectorAll('[data-dot-step]');
  var shapeCount = Math.min(window.DotShapes.length, steps.length);
  if (shapeCount < 2) return;

  var gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false });
  if (!gl) {
    stage.classList.add('is-static');   // CSS shows a note instead of an empty canvas
    return;
  }

  // ---- Settings ----
  var phone = window.matchMedia('(max-width: 760px)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Halved from 72000 / 36000 when the four-bird grid became one owl (user, 2026-10-21).
  // Raised 1.5× (user, 2026-10-22: the moment's figures were faint), with COVERAGE raised to match
  // so each dot keeps its size and the pictures get denser.
  var BASE_COUNT = phone.matches ? 27000 : 54000;
  // A full-width band (the landscape) covers about 3–4 times the screen of a shape beside the text,
  // so it gets 3 times the dots (user wants it as dense as the others, 2026-10-22). Every shape has
  // DOT_COUNT slots; a shape beside the text fills them with its BASE_COUNT dots, each repeated in
  // BAND_COPIES neighbouring slots, and the repeats stay hidden unless the dots form a band.
  var BAND_COPIES = window.DotShapes.some(function (e) { return e && e.place === 'band'; }) ? 3 : 1;
  var DOT_COUNT = BASE_COUNT * BAND_COPIES;
  var LOOSEN = reducedMotion ? 0 : 0.75;   // how far dots drift apart halfway (user: sparser)
  var TURN = reducedMotion ? 0 : 0.28;     // how much the field turns with scroll, for depth
  var ARCH = reducedMotion ? 0 : 0.5;      // arch height per unit of sideways travel (clip space)
  var DARK_TINT = 0.3;                     // dark mode: share of white mixed into every colour
  var LIGHT_TINT = 0.15;                   // light mode: share of black mixed into every colour
  var THEME_MS = reducedMotion ? 0 : 900;  // how long the light/dark glide takes
  var INTRO_MS = reducedMotion ? 0 : 2800; // how long the fly-in on page load takes (the name signs in 3 s)
  var PAGE_LIGHT = [0.945, 0.953, 0.937], PAGE_DARK = [0.157, 0.157, 0.157];   // --bg in _tokens.scss
  // Dot size follows the shape's size on screen, so a shape looks equally full on a phone and a
  // large monitor (user, 2026-10-21): about COVERAGE of the shape's box is covered by dots.
  // 0.42 → 0.6 → 1.1 (user, 2026-10-21): 1.1 matches the dense look the user liked, first seen
  // when the dots hit their minimum size in a narrowed window. Above 1 because dots overlap.
  // Then 1.65 with 1.5× the dots (2026-10-22), keeping the dot size.
  var COVERAGE = 1.65;
  var DOT_MIN = 1.4, DOT_MAX = 7;          // CSS pixels
  // Phones: dots 0.75× the size (user, 2026-11-01: "make the dots smaller only for phone"), with
  // a lower floor, since phone dots already sat near DOT_MIN.
  var PHONE_DOT = 0.75, PHONE_DOT_MIN = 1;
  var DRAW_W = 1000, DRAW_H = 700;         // size of the hidden painting canvas
  var BOX_W = DRAW_W / DRAW_H, BOX_H = 1;  // every shape fills x ±BOX_W, y ±BOX_H

  // Seeded random numbers, so the dots land in the same places on every visit.
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- The picture's background ----
  // Median colour of the picture's edges, plus how much the edges typically vary (paper grain),
  // so the background and its texture get no dots. Typical = median, not the extremes, because a
  // subject may touch an edge (the mountains do) and must not count as grain.
  function readBackground(pixels) {
    var spots = [];
    for (var x = 0; x < DRAW_W; x += 10) spots.push(x * 4, ((DRAW_H - 1) * DRAW_W + x) * 4);
    for (var y = 0; y < DRAW_H; y += 10) spots.push(y * DRAW_W * 4, (y * DRAW_W + DRAW_W - 1) * 4);

    function median(values) {
      values.sort(function (a, b) { return a - b; });
      return values[values.length >> 1];
    }
    var bg = [0, 1, 2].map(function (ch) {
      return median(spots.map(function (i) { return pixels[i + ch]; }));
    });
    // Farthest any colour can be from this background, used to scale differences to 0–1.
    bg.reach = Math.hypot(Math.max(bg[0], 255 - bg[0]), Math.max(bg[1], 255 - bg[1]), Math.max(bg[2], 255 - bg[2]));

    var grain = spots.map(function (i) { return difference(pixels, i, bg); }).sort(function (a, b) { return a - b; });
    bg.floor = Math.max(0.04, 3 * grain[grain.length >> 1] + 0.04);
    return bg;
  }

  // How far a pixel's colour is from the background: 0 = same, 1 = as far as possible.
  // Plain sqrt, not Math.hypot: this runs a few hundred thousand times per picture.
  function difference(pixels, i, bg) {
    var r = pixels[i] - bg[0], g = pixels[i + 1] - bg[1], b = pixels[i + 2] - bg[2];
    return Math.sqrt(r * r + g * g + b * b) / bg.reach;
  }

  // Draws a picture as large as fits and centred. With an outline, only the part inside it is
  // drawn, cropped to the outline's bounds. The canvas is first flooded with the picture's
  // top-left pixel (background), so everything outside reads as background and gets no dots.
  function drawPicture(ctx, img, outline) {
    var pts = outline || [[0, 0], [img.naturalWidth, img.naturalHeight]];
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var sx = Math.min.apply(null, xs), sy = Math.min.apply(null, ys);
    var sw = Math.max.apply(null, xs) - sx, sh = Math.max.apply(null, ys) - sy;
    var scale = Math.min(DRAW_W / sw, DRAW_H / sh);
    var ox = (DRAW_W - sw * scale) / 2, oy = (DRAW_H - sh * scale) / 2;

    ctx.drawImage(img, 0, 0, 1, 1, 0, 0, DRAW_W, DRAW_H);
    ctx.save();
    if (outline) {
      ctx.beginPath();
      outline.forEach(function (p, k) {
        ctx[k ? 'lineTo' : 'moveTo'](ox + (p[0] - sx) * scale, oy + (p[1] - sy) * scale);
      });
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(img, sx, sy, sw, sh, ox, oy, sw * scale, sh * scale);
    ctx.restore();
  }

  // ---- Scale dots to fill a box ----
  // Box centre (cx, cy) and half sizes (hw, hh) in shape units. Uses the 1st–99th percentile of
  // positions, so a few stray dots don't shrink the subject; read from an evenly spaced sample of
  // at most 4000 dots, which is as accurate here and much faster than sorting them all.
  function fitToBox(dots, cx, cy, hw, hh) {
    var stride = Math.max(1, Math.floor(dots.length / 4000));
    function range(axis) {
      var v = [];
      for (var k = 0; k < dots.length; k += stride) v.push(dots[k].p[axis]);
      v.sort(function (a, b) { return a - b; });
      return [v[Math.floor(v.length * 0.01)], v[Math.floor(v.length * 0.99)]];
    }
    var xr = range(0), yr = range(1);
    var mx = (xr[0] + xr[1]) / 2, my = (yr[0] + yr[1]) / 2;
    // The small minimum avoids dividing by zero for a shape with no spread (an empty picture).
    var s = Math.min(hw / Math.max(1e-6, (xr[1] - xr[0]) / 2), hh / Math.max(1e-6, (yr[1] - yr[0]) / 2));
    dots.forEach(function (d) {
      d.p[0] = cx + (d.p[0] - mx) * s;
      d.p[1] = cy + (d.p[1] - my) * s;
    });
  }

  // ---- Turn one painting into coloured dots ----
  // Returns `count` dots, each { p: [x, y, z], c: [r, g, b] } with colours 0–1. Areas that stand
  // out more from the background sit a little nearer (z), which gives volume when the field turns.
  // curve: how density follows the difference from the background (lower = more dots in pale
  // areas). Bands use a lower curve so the landscape's pale mountains read (user, 2026-10-22).
  function stipple(paint, count, rand, curve) {
    var sketch = document.createElement('canvas');
    sketch.width = DRAW_W;
    sketch.height = DRAW_H;
    var ctx = sketch.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, DRAW_W, DRAW_H);
    paint(ctx);
    var pixels = ctx.getImageData(0, 0, DRAW_W, DRAW_H).data;
    var bg = readBackground(pixels);

    var dots = [];
    var tries = 0;
    while (dots.length < count && tries < count * 300) {
      tries++;
      var x = rand() * DRAW_W;
      var y = rand() * DRAW_H;
      var i = ((y | 0) * DRAW_W + (x | 0)) * 4;
      var d = difference(pixels, i, bg);
      // Keep a candidate with a chance that grows with the difference: dense where the subject
      // stands out, none on the background. The 0.8 power keeps subtle tones from going bare.
      if (d < bg.floor || rand() > Math.pow(d, curve || 0.8)) continue;
      // Skip specks: the spot must also stand out on average with its neighbours 4 px away, so
      // a lone fleck in the paper gets no dot while thin parts like legs still do.
      if (x < 4 || y < 4 || x >= DRAW_W - 4 || y >= DRAW_H - 4) continue;
      var around = (difference(pixels, i - 16, bg) + difference(pixels, i + 16, bg) +
        difference(pixels, i - DRAW_W * 16, bg) + difference(pixels, i + DRAW_W * 16, bg) + d) / 5;
      if (around < bg.floor) continue;
      dots.push({
        p: [
          (x - DRAW_W / 2) / (DRAW_H / 2),
          -(y - DRAW_H / 2) / (DRAW_H / 2),
          (d - 0.5) * 0.45 + (rand() - 0.5) * 0.08
        ],
        c: [pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255]
      });
    }
    // Only if a picture is nearly empty: repeat copies of what was found (or one centre dot).
    if (!dots.length) dots.push({ p: [0, 0, 0], c: [0.5, 0.5, 0.5] });
    for (var n = dots.length, found = dots.length; n < count; n++) {
      var copy = dots[n % found];
      dots.push({ p: copy.p.slice(), c: copy.c });
    }
    return dots;
  }

  // ---- Build one shape ----
  // Returns the dots fitted to the box and sorted left to right, so dot n travels to the n-th dot
  // of the next shape: short, coherent paths instead of dots crossing the whole screen. A little
  // noise keeps it from looking ruled.
  function shapeDots(paint, rand, band) {
    // Lower curve = more dots in subtle tones (navy gowns on a dark backdrop, pale mountains).
    var all = stipple(paint, band ? DOT_COUNT : BASE_COUNT, rand, band ? 0.5 : 0.65);
    fitToBox(all, 0, 0, BOX_W, BOX_H);
    // Paper specks far from the subject land well outside the box after fitting; give those
    // dots the place and colour of a random dot inside instead.
    all.forEach(function (d) { d.inside = Math.abs(d.p[0]) <= BOX_W * 1.08 && Math.abs(d.p[1]) <= BOX_H * 1.08; });
    var inside = all.filter(function (d) { return d.inside; });
    all = all.map(function (d) {
      if (d.inside || !inside.length) return d;
      var copy = inside[Math.floor(rand() * inside.length)];
      return { p: copy.p.slice(), c: copy.c };
    });
    all.forEach(function (d) { d.key = d.p[0] + (rand() - 0.5) * 0.15; });
    all.sort(function (a, b) { return a.key - b.key; });
    if (band || BAND_COPIES === 1) return all;
    // Repeat each dot in BAND_COPIES neighbouring slots (see BAND_COPIES above).
    var slots = new Array(DOT_COUNT);
    for (var n = 0; n < DOT_COUNT; n++) slots[n] = all[Math.floor(n / BAND_COPIES)];
    return slots;
  }

  // Packs dots into the arrays WebGL reads.
  function pack(dots) {
    var pos = new Float32Array(DOT_COUNT * 3);
    var color = new Float32Array(DOT_COUNT * 3);
    dots.forEach(function (d, n) {
      pos.set(d.p, n * 3);
      color.set(d.c, n * 3);
    });
    // Extent of the shape, used to place band shapes on screen: 0.2nd–99.8th percentile across,
    // so the landscape's crisp sides line up with the top bar (user, 2026-10-23; 1% let its edge
    // dots spill ~30 px past it), and 1st–99th up and down, ignoring stray cloud wisps.
    var ys = [], xs = [];
    for (var k = 0; k < dots.length; k += 9) { xs.push(dots[k].p[0]); ys.push(dots[k].p[1]); }
    xs.sort(function (a, b) { return a - b; });
    ys.sort(function (a, b) { return a - b; });
    function at(list, share) { return list[Math.floor((list.length - 1) * share)]; }
    return {
      pos: pos, color: color,
      bounds: { x0: at(xs, 0.002), x1: at(xs, 0.998), y0: at(ys, 0.01), y1: at(ys, 0.99) }
    };
  }


  function buildShape(paint, rand, band) {
    return pack(shapeDots(paint, rand, band));
  }

  // ---- Pair the dark version's dots with the light version's ----
  // For the theme glide each light dot needs a partner nearby in the dark version, not just one
  // at a similar left-right position. Both sets are ranked along a Hilbert curve (a path that
  // visits every spot and keeps neighbours close), and the k-th light dot gets the k-th dark dot.
  function hilbertIndex(x, y) {
    var n = 1024, d = 0;
    for (var s = n >> 1; s > 0; s >>= 1) {
      var rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
      d += s * s * ((3 * rx) ^ ry);
      if (ry === 0) {
        if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
        var t = x; x = y; y = t;
      }
    }
    return d;
  }

  function curveKey(d) {
    var x = Math.round(((d.p[0] + BOX_W) / (2 * BOX_W)) * 1023);
    var y = Math.round(((d.p[1] + BOX_H) / (2 * BOX_H)) * 1023);
    return hilbertIndex(Math.max(0, Math.min(1023, x)), Math.max(0, Math.min(1023, y)));
  }

  function pairUp(light, dark) {
    function ranked(dots) {
      return dots.map(function (d, n) { return { n: n, key: curveKey(d) }; })
        .sort(function (a, b) { return a.key - b.key; });
    }
    var lr = ranked(light), dr = ranked(dark);
    var paired = new Array(light.length);
    lr.forEach(function (entry, k) { paired[entry.n] = dark[dr[k].n]; });
    return paired;
  }

  // ---- Build the shapes ----
  // Painted shapes are built now; picture shapes once their pictures load (see "Pictures" below)
  // and stay null until then. Nothing borrows another shape's dots, so no other shape flashes
  // up while a picture loads (user, 2026-10-22); see showPair() for what is drawn meanwhile.
  // Each entry is { light, dark }, both { pos, color }; painted shapes use one set for both.
  var rand = seeded(1);
  var shapes = [];
  for (var s = 0; s < shapeCount; s++) {
    var entry = window.DotShapes[s];
    var built = typeof entry === 'function' ? buildShape(entry, rand, isBand(s)) : null;
    shapes.push(built && { light: built, dark: built });
  }

  // Per-dot extras that never change, packed in one vec4 to save attribute slots: a direction to
  // loosen towards (xyz) and a start delay (w).
  // 1 for the repeated slots of shapes beside the text (see BAND_COPIES), 0 for the first copy.
  var copies = new Float32Array(DOT_COUNT);
  for (var c = 0; c < DOT_COUNT; c++) copies[c] = c % BAND_COPIES ? 1 : 0;

  var extras = new Float32Array(DOT_COUNT * 4);
  for (var i = 0; i < DOT_COUNT; i++) {
    var a = rand() * Math.PI * 2, b = Math.acos(2 * rand() - 1), r = 0.4 + rand() * 0.6;
    extras[i * 4] = Math.sin(b) * Math.cos(a) * r * 1.4;   // wider than tall, like a drifting band
    extras[i * 4 + 1] = Math.sin(b) * Math.sin(a) * r * 0.85;
    extras[i * 4 + 2] = Math.cos(b) * r;
    // Mostly random, partly left-to-right, so the change sweeps across the shape.
    extras[i * 4 + 3] = 0.65 * rand() + 0.35 * (i / DOT_COUNT);
  }

  // ---- WebGL program ----
  var SWEEP = 0.25;                        // how much a dot's start follows its position (0 = random)
  var FALL = reducedMotion ? 0 : 0.35;     // how far dots sag while falling into a band (clip space)

  var VERTEX = [
    // Light-mode and dark-mode dots of the two shapes being blended.
    'attribute vec3 aFrom;',
    'attribute vec3 aTo;',
    'attribute vec3 aColorFrom;',
    'attribute vec3 aColorTo;',
    'attribute vec3 aFromDark;',
    'attribute vec3 aToDark;',
    'attribute vec3 aColorFromDark;',
    'attribute vec3 aColorToDark;',
    'attribute vec4 aExtras;',    // loosen direction (xyz), start delay (w)
    'attribute float aCopy;',     // 1 = a repeat slot, only shown while the dots form a band
    'uniform vec2 uBand;',        // 1 where the first (x) / second (y) shape is a band
    'uniform float uMix;',        // 0 = first shape, 1 = second shape
    'uniform float uTheme;',      // 0 = light mode, 1 = dark mode, in between while switching
    'uniform float uIntro;',      // fly-in on page load: 0 = scattered, 1 = in place
    'uniform vec3 uPage;',        // page background colour, where the fly-in starts
    'uniform float uLoosen;',
    'uniform float uTurn;',       // rotation around the vertical axis, in radians
    'uniform vec2 uTint;',        // share of black mixed in for light mode (x), white for dark (y)
    'uniform vec2 uScaleFrom;',   // shape units to screen units (x, y) for the first shape
    'uniform vec2 uScaleTo;',     // and for the second
    'uniform vec2 uOffsetFrom;',  // where the first shape sits on screen
    'uniform vec2 uOffsetTo;',    // where the second shape sits
    'uniform float uSizeFrom;',   // dot size for each shape (a band covers more screen)
    'uniform float uSizeTo;',
    'uniform float uVert;',       // 1 = falling into a band, -1 = rising out of one, 0 = neither
    'uniform vec4 uTextBox;',     // text over a band, in clip space (x0, y0, x1, y1)
    'uniform float uDim;',        // how much dots behind that text fade (0–1)
    'uniform float uArch;',       // how high dots rise while crossing the screen
    'uniform float uDir;',        // sideways travel: 1 = to the right, -1 = to the left, 0 = none
    'uniform float uBoxW;',       // half width of the shape box, to read a dot's left-right place
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'void main() {',
    // Each dot runs its own part of the change, starting at its own moment. The moment is mostly
    // random, with a gentle sweep (SWEEP) in the direction things move: sideways, the edge facing
    // the destination leaves a little earlier; into a band the ground lands a little earlier; out
    // of one the sky leaves a little earlier. A strong sweep made regions land or leave as
    // blocks, with a visible seam between formed dots and flying ones (user, 2026-10-22).
    '  float chance = fract(aExtras.w * 97.13);',
    '  float lead = 0.5;',
    '  if (uVert > 0.0) lead = clamp((aTo.y / uBoxW + 1.0) * 0.5, 0.0, 1.0);',
    '  else if (uVert < 0.0) lead = 1.0 - clamp((aFrom.y / uBoxW + 1.0) * 0.5, 0.0, 1.0);',
    '  else if (uDir != 0.0) {',
    '    float nx = clamp((aFrom.x / uBoxW + 1.0) * 0.5, 0.0, 1.0);',
    '    lead = uDir > 0.0 ? 1.0 - nx : nx;',
    '  }',
    '  float order = (1.0 - SWEEP) * chance + SWEEP * lead, window = 0.55;',
    '  float e = clamp((uMix - order * (1.0 - window)) / window, 0.0, 1.0);',
    '  e = e * e * (3.0 - 2.0 * e);',
    '  float flight = sin(3.14159 * e);',
    // The theme glide uses the same staggered start, so it ripples too, with a gentler loosen.
    '  float t = clamp((uTheme - aExtras.w * 0.4) / 0.6, 0.0, 1.0);',
    '  t = t * t * (3.0 - 2.0 * t);',
    '  vec3 from = mix(aFrom, aFromDark, t), to = mix(aTo, aToDark, t);',
    // In flight the shape narrows a little and loosens less on sideways moves, so the stream
    // stays readable as an arch.
    '  vec3 p = mix(from, to, e);',
    // Fly-in: each dot comes from far out along its loosen direction, at its own moment.
    '  float k = clamp((uIntro - aExtras.w * 0.45) / 0.55, 0.0, 1.0);',
    '  k = 1.0 - pow(1.0 - k, 3.0);',
    '  p += aExtras.xyz * vec3(2.6, 2.2, 1.0) * (1.0 - k);',
    '  p.xy *= 1.0 - 0.3 * flight * abs(uDir);',
    '  p += aExtras.xyz * (flight * uLoosen * (1.0 - 0.5 * abs(uDir) - 0.65 * abs(uVert)) + sin(3.14159 * t) * 0.06);',
    '  float c = cos(uTurn), s = sin(uTurn);',
    '  vec3 q = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);',
    // Simple perspective: the turned field spreads a little wider on its near side.
    '  float near = 3.0 / (3.0 - q.z);',
    // Scroll changes travel in an arch (user, 2026-10-21): dots rise as they cross the screen and
    // land on the other side. Each dot's height varies a little (from its loosen direction), so
    // the crossing reads as a flowing stream, not a rigid block. The theme glide has no arch.
    '  float rise = uArch * flight * (0.8 + 0.25 * aExtras.y);',
    // Into a band the dots sag as if falling; out of one they lift (user: "go down to form it").
    '  rise -= uVert * FALL * flight * (0.8 + 0.25 * aExtras.y);',
    '  vec2 scale = mix(uScaleFrom, uScaleTo, e);',
    '  gl_Position = vec4(q.xy * near * scale + mix(uOffsetFrom, uOffsetTo, e) + vec2(0.0, rise), 0.0, 1.0);',
    // Dot size and brightness follow the picture, not the twist: only a faint size cue for depth
    // (a quarter of the perspective), so the far side of a turned page doesn't fade.
    '  gl_PointSize = mix(uSizeFrom, uSizeTo, e) * (1.0 + 0.25 * (near - 1.0));',
    '  vec3 color = mix(mix(aColorFrom, aColorTo, e), mix(aColorFromDark, aColorToDark, e), t);',
    '  color = mix(color, vec3(0.0), uTint.x * (1.0 - uTheme));',
    // Light mode, landscape only: deepen pale tones (a power curve darkens light colours most),
    // so pale blue mountains stand out on the light page (user, 2026-10-22).
    '  float deepen = mix(uBand.x, uBand.y, e) * (1.0 - uTheme);',
    '  color = mix(color, pow(color, vec3(1.9)), deepen);',
    '  vColor = mix(color, vec3(1.0), uTint.y * uTheme);',
    '  vColor = mix(uPage, vColor, k);',   // from the page colour (pale or dark) to the picture's
    '  vAlpha = clamp(0.8 + p.z * 0.7, 0.55, 1.0);',
    // Fade dots behind the text over a band: strongest at the text's centre, easing off over an
    // oval about twice the text's size, so there is no edge (a rectangle with a short feather
    // showed as a seam through the clouds, user 2026-10-22).
    '  vec2 g = gl_Position.xy;',
    '  vec2 mid = 0.5 * (uTextBox.xy + uTextBox.zw), span = 0.5 * (uTextBox.zw - uTextBox.xy) + 1e-4;',
    '  float behind = 1.0 - smoothstep(0.35, 1.9, length((g - mid) / span));',
    '  vAlpha *= 1.0 - 0.8 * uDim * behind;',
    '  vAlpha *= aCopy > 0.5 ? mix(uBand.x, uBand.y, e) : 1.0;',
    // Hidden repeat slots get no size and sit off screen, so the GPU skips them entirely
    // (two thirds of all slots whenever no landscape is on screen).
    '  if (vAlpha < 0.004) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }',
    '}'
  ].join('\n').split('FALL').join(FALL.toFixed(3)).split('SWEEP').join(SWEEP.toFixed(3));

  var FRAGMENT = [
    'precision mediump float;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'void main() {',
    // Round dots with a soft edge, instead of the square points WebGL draws by default.
    '  float d = length(gl_PointCoord - 0.5);',
    '  if (d > 0.5) discard;',
    '  gl_FragColor = vec4(vColor, vAlpha * (1.0 - smoothstep(0.32, 0.5, d)));',
    '}'
  ].join('\n');

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  var program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);

  function attribute(name, data, size) {
    var buffer = gl.createBuffer();
    var loc = gl.getAttribLocation(program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return buffer;
  }

  // Filled by showPair() once the shapes on screen are ready.
  var blank = new Float32Array(DOT_COUNT * 3);
  var buffers = {
    from: attribute('aFrom', blank, 3),
    to: attribute('aTo', blank, 3),
    colorFrom: attribute('aColorFrom', blank, 3),
    colorTo: attribute('aColorTo', blank, 3),
    fromDark: attribute('aFromDark', blank, 3),
    toDark: attribute('aToDark', blank, 3),
    colorFromDark: attribute('aColorFromDark', blank, 3),
    colorToDark: attribute('aColorToDark', blank, 3)
  };
  attribute('aExtras', extras, 4);
  attribute('aCopy', copies, 1);

  var u = {};
  ['uMix', 'uTheme', 'uIntro', 'uPage', 'uLoosen', 'uTurn', 'uTint', 'uScaleFrom', 'uScaleTo', 'uOffsetFrom', 'uOffsetTo', 'uSizeFrom', 'uSizeTo', 'uArch', 'uDir', 'uVert', 'uBoxW', 'uTextBox', 'uDim', 'uBand'].forEach(function (name) {
    u[name] = gl.getUniformLocation(program, name);
  });

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // ---- Which pair of shapes is on screen ----
  var currentPair = 0;

  // Overwrites a buffer in place: every shape has the same number of dots, so the buffers never
  // change size and need not be re-created.
  function upload(buffer, data) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  }

  // Returns false when neither shape of the pair has loaded yet (then nothing is drawn). When only
  // one has, it stands in for the other, so the shape on screen shows without waiting for the
  // next picture (the warbler is a large file).
  function showPair(pair) {
    var a = shapes[pair] || shapes[pair + 1], b = shapes[pair + 1] || shapes[pair];
    if (!a) return false;
    if (pair === currentPair) return true;
    currentPair = pair;
    upload(buffers.from, a.light.pos);
    upload(buffers.to, b.light.pos);
    upload(buffers.colorFrom, a.light.color);
    upload(buffers.colorTo, b.light.color);
    upload(buffers.fromDark, a.dark.pos);
    upload(buffers.toDark, b.dark.pos);
    upload(buffers.colorFromDark, a.dark.color);
    upload(buffers.colorToDark, b.dark.color);
    return true;
  }

  // ---- Fly-in on page load, together with the signed name ----
  // `intro` runs from 0 to 1 over INTRO_MS once the first picture is ready, drawing a frame each
  // step. The name in the title (signature.svg) waits paused until then, so pen and dots start
  // together; WAIT_MS is a safety limit in case the picture is slow. Without this script the
  // name signs on its own (_signature.scss).
  var WAIT_MS = 1500;
  var intro = INTRO_MS ? 0 : 1;
  var title = document.querySelector('.dot-step__text--title');

  function releaseTitle() {
    if (title) title.classList.remove('is-waiting');
  }

  if (title && INTRO_MS) {
    title.classList.add('is-waiting');
    window.setTimeout(releaseTitle, WAIT_MS);
  }

  function startIntro() {
    releaseTitle();
    if (intro >= 1) return;
    var start = performance.now();
    function step(now) {
      intro = Math.min(1, (now - start) / INTRO_MS);
      render();
      if (intro < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  // ---- Light or dark mode: glide between the two dot sets ----
  // `theme` runs from 0 (light) to 1 (dark). On a switch it eases towards the new value over
  // THEME_MS, drawing a frame each step; the page background fades at the same time (CSS).
  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  var theme = isDark() ? 1 : 0;
  var glide = null;

  function startGlide() {
    var target = isDark() ? 1 : 0;
    if (!THEME_MS) { theme = target; requestRender(); return; }
    glide = { from: theme, to: target, start: performance.now() };
    window.requestAnimationFrame(stepGlide);
  }

  function stepGlide(now) {
    if (!glide) return;
    var k = Math.min(1, (now - glide.start) / THEME_MS);
    theme = glide.from + (glide.to - glide.from) * k;
    render();
    if (k < 1) window.requestAnimationFrame(stepGlide);
    else glide = null;
  }

  // ---- Size and placement ----
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Wide screens: the box takes up to 40% of the width, centred in one half of the screen (see
    // placeOf()), and up to 63% of the height. Phones: most of the width, in the upper part.
    // All pictures were made 15% smaller (user, 2026-10-22: "kinda large"); dot size follows the
    // box (dotSize()), so dots got smaller with them and the density stayed the same.
    wide = !phone.matches;
    view = { w: w, h: h, dpr: dpr };
    var scale = wide
      ? Math.min(0.63, (0.4 * w) / (BOX_W * h))
      : Math.min(0.43, (0.68 * w) / (BOX_W * h));
    sideScale = [(scale * h) / w, scale];
    // Box size on screen in CSS pixels; dot diameter = sqrt(coverage × box area per dot).
    sideDot = dotSize(scale * h * BOX_W * scale * h * BOX_H, BASE_COUNT);
    gl.uniform1f(u.uLoosen, LOOSEN);
    gl.uniform2f(u.uTint, LIGHT_TINT, DARK_TINT);
    gl.uniform1f(u.uBoxW, BOX_W);
  }

  // ---- Where each shape sits ----
  // Wide screens alternate (user, 2026-10-21): even steps on the left, odd steps on the right;
  // the text takes the other side (_dot-stage.scss). Band shapes span the full width, anchored to
  // the bottom edge, on every screen size. Returns { offset, scale, size } in clip space / pixels.
  var wide = true, view = { w: 1, h: 1, dpr: 1 }, sideScale = [1, 1], sideDot = 2;

  function dotSize(areaPx, count) {
    var dot = Math.sqrt((COVERAGE * areaPx) / count);
    if (!wide) return Math.max(PHONE_DOT_MIN, Math.min(DOT_MAX, dot) * PHONE_DOT) * view.dpr;
    return Math.max(DOT_MIN, Math.min(DOT_MAX, dot)) * view.dpr;
  }

  // The content column in CSS pixels: the top bar's inner box without its padding, i.e. from
  // the site name to the light/dark switch. [left, right] from the canvas's left edge.
  function columnEdges() {
    var inner = document.querySelector('.site-header__inner');
    if (!inner) return [view.w * 0.05, view.w * 0.95];
    var cs = getComputedStyle(inner), r = inner.getBoundingClientRect();
    var left = r.left - canvas.getBoundingClientRect().left;
    return [left + parseFloat(cs.paddingLeft), left + r.width - parseFloat(cs.paddingRight)];
  }

  function columnWidth() {
    var c = columnEdges();
    return c[1] - c[0];
  }

  // Left and right edge of a side picture as it shows at rest, in shape units: with its page's
  // twist and the slight perspective of the shader (the dots have some depth), 0.2nd–99.8th
  // percentile of its dots. The light and dark pictures are framed a little differently, so it
  // blends both by the theme (smooth while the theme glides). Worked out once per dot set.
  function restExtent(index) {
    if (!shapes[index]) return { x0: -BOX_W, x1: BOX_W, y0: -BOX_H, y1: BOX_H };
    var l = setExtent(index, shapes[index].light), d = setExtent(index, shapes[index].dark);
    return {
      x0: l.x0 + (d.x0 - l.x0) * theme, x1: l.x1 + (d.x1 - l.x1) * theme,
      y0: l.y0 + (d.y0 - l.y0) * theme, y1: l.y1 + (d.y1 - l.y1) * theme
    };
  }

  function setExtent(index, set) {
    if (!set.rest) {
      // A band is shown flat-on (no twist; see render()).
      var turn = isBand(index) ? 0 : TURN * Math.sin(index * 1.6);
      var c = Math.cos(turn), sn = Math.sin(turn), xs = [], ys = [];
      for (var n = 0; n < DOT_COUNT; n += 9) {
        var x = set.pos[n * 3], y = set.pos[n * 3 + 1], z = set.pos[n * 3 + 2];
        var qx = x * c + z * sn, qz = -x * sn + z * c, near = 3 / (3 - qz);
        xs.push(qx * near);
        ys.push(y * near);
      }
      xs.sort(function (a, b) { return a - b; });
      ys.sort(function (a, b) { return a - b; });
      set.rest = {
        x0: xs[Math.floor((xs.length - 1) * 0.002)], x1: xs[Math.floor((xs.length - 1) * 0.998)],
        // The bottom edge, for the caption. The landscape's forest runs dense to its foot (in
        // light mode especially), so it is measured lower down: 0.1% instead of 0.5% (user,
        // 2026-10-23: its caption touched the trees in light mode).
        y0: ys[Math.floor((ys.length - 1) * (isBand(index) ? 0.001 : 0.005))],
        y1: ys[Math.floor((ys.length - 1) * 0.995)]   // the top edge (a low shape on phones)
      };
    }
    return set.rest;
  }

  function isBand(index) {
    var entry = window.DotShapes[index];
    return !!entry && entry.place === 'band';
  }

  // Shapes the dots fall into and rise out of: a band, or on phones a phonePlace: 'low' shape
  // (it sits under its text line; placeOf()).
  function isPhoneLow(index) {
    var entry = window.DotShapes[index];
    return !wide && !!entry && entry.phonePlace === 'low';
  }
  function isLow(index) { return isBand(index) || isPhoneLow(index); }
  // Its line goes to the top on phones (.dot-step--phone-top in _dot-stage.scss; line-moves.js
  // lets it leave upward). One source for both: the shape list.
  window.DotShapes.forEach(function (entry, index) {
    var box = entry && entry.phonePlace === 'low' && stage.querySelector('[data-pin="' + index + '"]');
    if (box) box.classList.add('dot-step--phone-top');
  });

  // Least room a band's text line needs above the band, in CSS pixels: the space over the line
  // (its box's top padding), the line and the least gap under it (its margin), set in
  // _dot-stage.scss.
  // Not its offsetTop: the line rests on the band, so that would only repeat the band's top.
  var bandRoom = 0;
  var bandCaption = 0;   // height of the band's caption plus its gap, in CSS pixels
  var lineFoot = [];     // phones: bottom of a low shape's text line (and link), from the canvas top
  // Width of each side picture's text line, in CSS pixels: from the start of its longest line to
  // its end (the line's box is wider than its words). Used to size the picture beside it.
  var textWidth = [];

  // Measured on resize, language change and once the fonts arrive.
  function measureText() {
    bandRoom = 0;
    bandCaption = 0;
    textWidth = [];
    lineFoot = [];
    captions.forEach(function (caption) {
      if (isBand(Number(caption.dataset.caption))) bandCaption = caption.offsetHeight + captionGap();
    });
    window.DotShapes.forEach(function (entry, index) {
      var box = stage.querySelector('[data-pin="' + index + '"]');
      var text = box && Array.prototype.find.call(box.querySelectorAll('[data-scroll-words]'),
        function (el) { return el.offsetParent !== null; });
      if (!text) return;
      if (isPhoneLow(index)) {
        var line = text.closest('.dot-step__line') || text;   // its box is the canvas-sized layer
        lineFoot[index] = line.offsetTop + line.offsetHeight;
        return;
      }
      if (isBand(index)) {
        // The line with its page link under it (.dot-step__line), and the gap below the pair.
        var pair = text.closest('.dot-step__line') || text;
        var room = parseFloat(getComputedStyle(box).paddingTop) + pair.offsetHeight +
          parseFloat(getComputedStyle(pair).marginBottom);
        bandRoom = Math.max(bandRoom, room);
        return;
      }
      var range = document.createRange();
      range.selectNodeContents(text);
      var rects = Array.prototype.slice.call(range.getClientRects());
      if (!rects.length) return;
      textWidth[index] = Math.max.apply(null, rects.map(function (r) { return r.right; })) -
        Math.min.apply(null, rects.map(function (r) { return r.left; }));
    });
  }

  // Space between a side picture and its text: 8% of the window, 48–120 px. It never grows as
  // the window narrows (user, 2026-10-23: the gap widened as the window got smaller).
  function sideGap() { return Math.max(48, Math.min(120, 0.08 * view.w)); }
  var bandTopPx = -1;   // the band's top edge, shared with the CSS as --band-top
  var BAND_GAP = 0.07;  // space under a band, as a share of the screen height
  // Space under a band's caption, the same way (user, 2026-10-25: at 3% the landscape rested too
  // close to the bottom; the user's screenshot had the caption ending ~8% above it).
  var BAND_CAPTION_GAP = 0.08;
  var BAND_AIR = 0.05;  // least extra space between a band and its line, the same way
  function placeOf(index) {
    if (isBand(index)) {
      // As wide as the content column: from the site name to the light/dark switch in the top
      // bar (user, 2026-10-23; was 85% of it). Centred across, low on the screen, with its text
      // line centred in the open space above it, well clear of it (user, 2026-10-23: the line was
      // too close when the band sat in the middle). On a short screen it gets narrower, so the
      // line still fits above it with some air (BAND_AIR).
      var b = shapes[index] ? shapes[index].light.bounds : { x0: -1, x1: 1, y0: -1, y1: 1 };
      // Height from its top to the true foot of the picture in the current theme (restExtent),
      // so the room left under it is really free for the caption.
      var foot = shapes[index] ? restExtent(index).y0 : b.y0;
      var aspect = (b.y1 - foot) / (b.x1 - b.x0);           // height / width of the picture
      // Under it: the usual gap, or room for its caption plus BAND_CAPTION_GAP below that.
      var bottomPx = Math.max(view.h * BAND_GAP, bandCaption + view.h * BAND_CAPTION_GAP);
      var roomPx = view.h * (1 - BAND_AIR) - bottomPx - bandRoom;
      // Its sides are ragged: scattered edge dots reach ~2.5% past the measured extent on each
      // side, so 95% of the column makes the outermost dots meet the top bar's edges.
      var widthPx = Math.max(0, Math.min(0.95 * columnWidth(), roomPx / aspect));
      var sx = (2 * widthPx) / view.w / (b.x1 - b.x0);
      var sy = (sx * view.w) / view.h;            // same scale vertically, in clip units
      var heightPx = widthPx * aspect;
      var topPx = Math.round(Math.max(view.h - bottomPx - heightPx, bandRoom));
      if (topPx !== bandTopPx) {
        // The CSS rests the text line on this edge (.dot-step--top in _dot-stage.scss).
        bandTopPx = topPx;
        stage.style.setProperty('--band-top', topPx + 'px');
      }
      var top = 1 - (2 * topPx) / view.h;         // in clip space
      return {
        offset: [-(b.x0 + b.x1) / 2 * sx, top - b.y1 * sy],
        scale: [sx, sy],
        size: dotSize(widthPx * Math.min(heightPx, view.h), DOT_COUNT)
      };
    }
    if (wide && index > 0) {
      // Every picture after the portrait lines up with the content column (user, 2026-10-23):
      // its outer edge on the column's edge (the site name on the left, the light/dark switch on
      // the right). Its text sits on the column's other edge, and the picture fills the space in
      // between, less a fixed gap (sideGap()), so the gap stays the same as the window changes
      // (user, 2026-10-23; before, the picture shrank with the window and the gap opened up).
      // Its height is capped at 63% of the screen. So it is placed by its inner edge, the gap
      // away from the text: normally it then fills the space and meets the column's edge; on a
      // short window, where the height cap stops it first, it sits a little in from the edge
      // instead of the gap growing.
      var col = columnEdges(), ext = restExtent(index), left = index % 2 === 0;
      var text = textWidth[index] || 0.3 * view.w;
      var room = col[1] - col[0] - text - sideGap();
      var scale = Math.max(0, Math.min(0.63, (2 * room) / (view.h * (ext.x1 - ext.x0))));
      var sx = (scale * view.h) / view.w;          // clip units per shape unit, across
      // Inner edge in pixels: left pictures end the gap before the text; right ones start after it.
      var innerPx = left ? col[1] - text - sideGap() : col[0] + text + sideGap();
      var inner = (innerPx / view.w) * 2 - 1;
      return {
        offset: [inner - (left ? ext.x1 : ext.x0) * sx, 0],
        scale: [sx, scale],
        size: dotSize(scale * view.h * BOX_W * scale * view.h * BOX_H, BASE_COUNT)
      };
    }
    if (isPhoneLow(index)) {
      // Phones, under its line (user, 2026-11-01): the picture's top edge a caption gap below the
      // line's foot; its caption hangs under it as usual.
      var top = ((lineFoot[index] || 0.3 * view.h) + captionGap()) / view.h;
      var y1 = shapes[index] ? restExtent(index).y1 : BOX_H;
      return { offset: [0, 1 - 2 * top - y1 * sideScale[1]], scale: sideScale, size: sideDot };
    }
    return {
      // The portrait (and every picture on phones). It sits a little in from the screen edge
      // (0.37, was 0.43): with the twist the near side spread almost to the edge (user,
      // 2026-10-22/23).
      offset: !wide ? [0, 0.38] : [index % 2 === 0 ? -0.37 : 0.37, 0],
      scale: sideScale,
      size: sideDot
    };
  }

  // The text line of a band step, as a clip-space box over the canvas (for fading dots behind it).
  function textBox(index) {
    // The line in the current language (the other one is hidden and has no box).
    // It sits in its step, or in the sticky layer when line-moves.js moves it ([data-pin]).
    var holder = stage.querySelector('[data-pin="' + index + '"]') || steps[index];
    var text = Array.prototype.find.call(holder.querySelectorAll('[data-scroll-words]'),
      function (el) { return el.offsetParent !== null; });
    if (!text) return [0, 0, 0, 0];
    // With its page link under it, so dots fade behind both.
    var pair = text.closest('.dot-step__line') || text;
    var c = canvas.getBoundingClientRect(), r = pair.getBoundingClientRect();
    return [
      ((r.left - c.left) / c.width) * 2 - 1, 1 - ((r.bottom - c.top) / c.height) * 2,
      ((r.right - c.left) / c.width) * 2 - 1, 1 - ((r.top - c.top) / c.height) * 2
    ];
  }

  // ---- Captions under the pictures (user, 2026-10-23) ----
  // Each [data-caption] hangs below its picture's bottom edge (captionGap()), from the picture's
  // left edge, right edge or centre (data-align; always the centre on phones, where pictures are
  // centred). Its lines don't wrap, so it may be wider than the picture. It shows while its
  // picture holds still and fades out as the dots leave.
  var captions = Array.prototype.slice.call(stage.querySelectorAll('[data-caption]'));
  // 4% of the screen height, 24–44 px, under every picture (user, 2026-10-23: 14 px sat too
  // close to the warbler and the moment, and to the landscape in light mode).
  function captionGap() {
    return Math.max(24, Math.min(44, 0.04 * view.h));
  }

  function placeCaption(caption, index, place) {
    if (!shapes[index]) return;
    var e = restExtent(index);
    if (isBand(index)) {
      var b = shapes[index].light.bounds;    // placed by these across (placeOf())
      e = { x0: b.x0, x1: b.x1, y0: e.y0 };
    }
    var left = ((place.offset[0] + e.x0 * place.scale[0] + 1) / 2) * view.w;
    var right = ((place.offset[0] + e.x1 * place.scale[0] + 1) / 2) * view.w;
    var bottom = ((1 - (place.offset[1] + e.y0 * place.scale[1])) / 2) * view.h;
    var align = wide ? caption.dataset.align : 'center';
    var x = align === 'left' ? left : align === 'right' ? right : (left + right) / 2;
    var shift = align === 'left' ? '0' : align === 'right' ? '-100%' : '-50%';
    var key = Math.round(x) + ',' + Math.round(bottom) + ',' + align + ',' + Math.round(right - left);
    if (caption.dataset.at === key) return;   // unchanged: don't touch the style
    caption.dataset.at = key;
    caption.style.setProperty('--pic-w', Math.round(right - left) + 'px');   // wrap width for long poems
    caption.style.transform = 'translate(' + Math.round(x) + 'px, ' + Math.round(bottom + captionGap()) + 'px) translateX(' + shift + ')';
  }

  function updateCaptions(position, pair, from, to) {
    captions.forEach(function (caption) {
      var index = Number(caption.dataset.caption);
      // Fully shown within 0.12 of its page, gone by 0.35 (the dots hold still for 0.18).
      var d = Math.abs(position - index);
      var o = Math.max(0, Math.min(1, (0.35 - d) / 0.23));
      o = o * o * (3 - 2 * o);
      caption.style.opacity = o > 0 ? o.toFixed(3) : '';
      if (o > 0 && (index === pair || index === pair + 1)) {
        placeCaption(caption, index, index === pair ? from : to);
      }
    });
  }

  // ---- Draw the frame for the current scroll position ----
  function headerHeight() {
    var header = document.querySelector('.site-header');
    return header ? header.offsetHeight : 0;
  }

  function render() {
    queued = false;
    var stepHeight = steps[0].offsetHeight;
    // 0 when the first step fills the screen, 1 at the second, and so on.
    var position = (headerHeight() - stage.getBoundingClientRect().top) / stepHeight;
    position = Math.max(0, Math.min(shapeCount - 1, position));

    var pair = Math.min(Math.floor(position), shapeCount - 2);
    var local = position - pair;
    // Hold each shape still around its own step; change only in the middle of the scroll between.
    var mix = Math.max(0, Math.min(1, (local - 0.18) / 0.64));

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!showPair(pair)) return;
    // First frame with real dots: show the canvas and start the fly-in.
    if (!canvas.classList.contains('is-ready')) {
      canvas.classList.add('is-ready');
      startIntro();
    }
    var from = placeOf(pair), to = placeOf(pair + 1);
    updateCaptions(position, pair, from, to);
    gl.uniform2fv(u.uOffsetFrom, from.offset);
    gl.uniform2fv(u.uOffsetTo, to.offset);
    gl.uniform2fv(u.uScaleFrom, from.scale);
    gl.uniform2fv(u.uScaleTo, to.scale);
    gl.uniform1f(u.uSizeFrom, from.size);
    gl.uniform1f(u.uSizeTo, to.size);

    // Into or out of a band (or a low shape on phones): the dots fall or rise, no sideways arch.
    var vert = isLow(pair + 1) ? 1 : isLow(pair) ? -1 : 0;
    // Phones: re-share where each picture ends once its place may have moved (theme glide too).
    if (theme > 0 && theme < 1) feetDirty = true;
    if (feetDirty && !wide) { feetDirty = false; sharePhoneFeet(); }
    gl.uniform1f(u.uVert, vert);
    // Arch height grows with the distance crossed: none on phones, where shapes don't move sideways.
    var travel = vert ? 0 : to.offset[0] - from.offset[0];
    gl.uniform1f(u.uArch, ARCH * Math.abs(travel));
    gl.uniform1f(u.uDir, Math.sign(travel));

    // Fade the dots behind the band's own text line, only while the band is (becoming) the shape.
    var band = isBand(pair + 1) ? pair + 1 : isBand(pair) ? pair : -1;
    gl.uniform4fv(u.uTextBox, band < 0 ? [0, 0, 0, 0] : textBox(band));
    // From the second half of the change, once the dots are landing around the text; earlier the
    // faded patch would show in the loose cloud.
    var weight = band < 0 ? 0 : band === pair ? 1 - mix : mix;
    gl.uniform1f(u.uDim, Math.max(0, Math.min(1, (weight - 0.4) / 0.4)));
    gl.uniform2f(u.uBand, isBand(pair) ? 1 : 0, isBand(pair + 1) ? 1 : 0);
    gl.uniform1f(u.uMix, mix);
    gl.uniform1f(u.uTheme, theme);
    gl.uniform1f(u.uIntro, intro);
    gl.uniform3fv(u.uPage, theme > 0.5 ? PAGE_DARK : PAGE_LIGHT);
    // A small twist that alternates left and right from page to page, also at rest (the user
    // likes it). Brightness and size no longer depend on it (see the shader), which is what made
    // the far side of the moment fade. A band (the landscape) is shown flat-on: turned, its left
    // side looked smaller than its right (user, 2026-10-23). The twist eases out as it forms.
    gl.uniform1f(u.uTurn, TURN * Math.sin(position * 1.6) * (1 - weight));
    gl.drawArrays(gl.POINTS, 0, DOT_COUNT);
  }

  // Phones: where each picture that sits above its line ends (its foot, or its caption's foot
  // when it has one), from the canvas top, shared on its line's box as --pic-foot so the CSS
  // sets the line just under it (user, 2026-11-01: the title and the moment's line sat far below
  // their pictures). Low shapes (the warbler, the landscape) sit under their lines instead.
  // Worked out again whenever a picture may have moved: resize, language, a picture loaded, the
  // theme glide (feetDirty). Wide screens: not used.
  var feetDirty = true;
  function sharePhoneFeet() {
    for (var i = 0; i < shapeCount; i++) {
      var box = stage.querySelector('[data-pin="' + i + '"]');
      if (!box || isLow(i) || !shapes[i]) continue;
      var place = placeOf(i);
      var foot = ((1 - (place.offset[1] + restExtent(i).y0 * place.scale[1])) / 2) * view.h;
      var caption = captions.find(function (c) { return Number(c.dataset.caption) === i; });
      if (caption) {
        placeCaption(caption, i, place);   // sets its wrap width, so its height is the real one
        foot += captionGap() + caption.offsetHeight;
      }
      var px = Math.round(foot) + 'px';
      if (box.style.getPropertyValue('--pic-foot') !== px) box.style.setProperty('--pic-foot', px);
    }
  }

  var queued = false;
  function requestRender() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(render);
  }

  // ---- Pictures: load, turn into dots, swap in ----
  // One at a time in story order, the version for the current mode first, so the first shape
  // shows as soon as its own picture arrives instead of sharing bandwidth with every other
  // picture. Until a shape's second version arrives, the first stands in for both; once both
  // are in, pairUp() keeps each dot's light/dark glide short.
  var queue = [];
  window.DotShapes.slice(0, shapeCount).forEach(function (entry, i) {
    if (typeof entry === 'function') return;
    var versions = { light: entry.image, dark: entry.imageDark };
    var first = isDark() && entry.imageDark ? 'dark' : 'light';
    queue.push({ i: i, entry: entry, mode: first, url: versions[first] });
    if (entry.imageDark) {
      var second = first === 'dark' ? 'light' : 'dark';
      queue.push({ i: i, entry: entry, mode: second, url: versions[second] });
    }
  });

  var loaded = {};   // shape index → { light: dots, dark: dots }

  function buildFrom(job, img) {
    var sets = loaded[job.i] = loaded[job.i] || {};
    sets[job.mode] = shapeDots(function (ctx) { drawPicture(ctx, img, job.entry.outline); }, seeded(100 + job.i), isBand(job.i));
    if (sets.light && sets.dark) {
      shapes[job.i] = { light: pack(sets.light), dark: pack(pairUp(sets.light, sets.dark)) };
    } else {
      var only = pack(sets.light || sets.dark);
      shapes[job.i] = { light: only, dark: only };
    }
    // Reload the buffers only if this shape is on screen now (about 15 MB of dot data each time).
    if (job.i === currentPair || job.i === currentPair + 1) currentPair = -1;
    feetDirty = true;
    requestRender();
  }

  // Turning a picture into dots blocks the page for 150–300 ms, which would make the signing
  // stutter. So only the first picture is prepared right away; the rest wait until the name is
  // signed (about INTRO_MS + 0.6 s after the dots start) and then go one at a time with a short
  // break between, so scrolling and drawing keep running smoothly.
  var LATER_MS = INTRO_MS + 600, BREAK_MS = 120;
  var firstDone = false;

  function loadNext() {
    var job = queue.shift();
    if (!job) return;
    var img = new Image();
    img.onload = function () {
      buildFrom(job, img);
      var wait = firstDone ? BREAK_MS : LATER_MS;
      firstDone = true;
      window.setTimeout(loadNext, wait);
    };
    img.onerror = function () {   // a missing picture leaves its shape empty; carry on with the rest
      firstDone = true;
      window.setTimeout(loadNext, BREAK_MS);
    };
    img.src = job.url;
  }

  loadNext();

  // ---- Events ----
  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', function () { resize(); measureText(); feetDirty = true; requestRender(); });
  // The line over the landscape changed (language) or got its real font: measure it again.
  function remeasure() { measureText(); feetDirty = true; requestRender(); }
  window.addEventListener('langchange', remeasure);
  if (document.fonts) document.fonts.ready.then(remeasure);
  // Light/dark switch: theme-toggle.js changes data-theme on <html>.
  new MutationObserver(startGlide)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  resize();
  measureText();
  render();
})();
