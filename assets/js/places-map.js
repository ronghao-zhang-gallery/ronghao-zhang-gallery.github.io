/*
 * Places map on the Traces page (traces.html, user 2026-10-24): puts each place marker
 * and route on the world map, links them with the dated list, and runs the continent bar.
 *   - Markers are placed from data-lat / data-lon with the Equal Earth projection, the same one
 *     scripts/make_world_map.py drew the map with (scaled ×100, the SVG's units), as percentages
 *     of the map's current view, so they follow it through every zoom.
 *   - Continent bar (user, 2026-10-25): picking a continent zooms the map to it (the viewBox
 *     glides to the continent's box, data-view on its mask shape), fades the other continents
 *     out through the map's mask, and moves the list beside the map with only that continent's
 *     rows. Antarctica cross-fades to its own polar map. "World" goes back. The choice is kept
 *     in the address (#europe), so a continent can be linked to.
 *   - Hover a marker or a list row (or tap it on a phone): every ring pauses, that place's marker
 *     shows its label, and the other markers and rows dim. On Avians, a species' range map shows
 *     only while the cursor is on its card (on phones, while its card is at the reading line).
 *   - Phones, while scrolling the list: the row at the reading line (40% down the screen) is
 *     picked, like lyrics lighting up.
 */
(function () {
  'use strict';

  var section = document.querySelector('[data-places]');
  var map = document.querySelector('[data-places-map]');
  if (!section || !map) return;
  var svg = map.querySelector('svg.world-map:not(.polar-map)');
  var content = svg.querySelector('.world-map__content');
  var focusShapes = Array.prototype.slice.call(svg.querySelectorAll('.world-map__focus'));
  var markers = Array.prototype.slice.call(map.querySelectorAll('.place-marker'));
  // Rows: Traces' visits (data-place, data-continent) or Avians' species cards (data-places,
  // data-continents: every place / continent the species was seen in).
  var rows = Array.prototype.slice.call(document.querySelectorAll('.visit[data-place], .visit[data-places]'));
  function placesOf(el) { return (el.dataset.places || el.dataset.place || '').split(' ').filter(Boolean); }
  var list = document.querySelector('.visit-list');
  var empty = document.querySelector('[data-visit-empty]');
  var gallery = document.querySelector('[data-gallery]');          // Avians: every photo
  var galleryTiles = gallery ? Array.prototype.slice.call(gallery.querySelectorAll('.photo-tile')) : [];
  var bar = document.querySelector('[data-continent-bar]');
  var options = bar ? Array.prototype.slice.call(bar.querySelectorAll('.continent-bar__option')) : [];
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---- Equal Earth projection (same constants as make_world_map.py) ----
  var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  function project(lon, lat) {
    var t = Math.asin(M * Math.sin(lat * Math.PI / 180));
    var t2 = t * t, t6 = Math.pow(t, 6);
    var x = (lon * Math.PI / 180) * Math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
    var y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
    return [x * 100, -y * 100];
  }

  // ---- The view: the part of the map on show, as [x, y, width, height] in map units ----
  var vb0 = svg.viewBox.baseVal;
  var WORLD = [vb0.x, vb0.y, vb0.width, vb0.height];
  // Antarctica swaps to the polar map, which is square: the world map (faded out) takes a
  // square-ish view of the far south, so the map box gets the polar map's shape.
  var ANTARCTICA = [-120, -10, 240, 200];
  var view = WORLD.slice();
  var routes = map.querySelector('[data-routes]');
  var ranges = map.querySelector('[data-ranges]');     // Avians: species' range maps

  function setView(v) {
    view = v;
    var attr = v.map(function (n) { return n.toFixed(2); }).join(' ');
    svg.setAttribute('viewBox', attr);
    if (routes) routes.setAttribute('viewBox', attr);
    if (ranges) ranges.setAttribute('viewBox', attr);
    placeMarkers();
  }

  // ---- Markers, as percentages of the current view ----
  markers.forEach(function (m) { m._xy = project(Number(m.dataset.lon), Number(m.dataset.lat)); });
  function placeMarkers() {
    markers.forEach(function (m) {
      m.style.left = ((m._xy[0] - view[0]) / view[2]) * 100 + '%';
      m.style.top = ((m._xy[1] - view[1]) / view[3]) * 100 + '%';
    });
  }
  setView(WORLD);
  markers.forEach(function (m) { m.classList.add('is-placed'); });

  // ---- Routes: each trip's line, along the roads it took ----
  var routeLines = routes ? Array.prototype.slice.call(routes.querySelectorAll('.route')) : [];
  // data-path: stretches split by "|" (the line breaks between them), points by ";".
  routeLines.forEach(function (route) {
    var d = route.dataset.path.split('|').map(function (piece) {
      return 'M' + piece.split(';').map(function (pt) {
        var ll = pt.split(',');
        var p = project(Number(ll[0]), Number(ll[1]));
        return p[0].toFixed(2) + ' ' + p[1].toFixed(2);
      }).join(' L');
    }).join(' ');
    route.setAttribute('d', d);
  });

  // ---- Ranges (Avians): only while the cursor is on that species' card (user, 2026-10-25) ----
  var rangeGroups = ranges ? Array.prototype.slice.call(ranges.querySelectorAll('.range')) : [];
  function showRange(species) {
    rangeGroups.forEach(function (g) { g.classList.toggle('is-shown', !!species && g.dataset.species === species); });
  }

  // Zoomed into a continent, the map shows only that continent's part of a range. The other
  // continents it reaches (the card's data-range, _data/range_continents.yml) turn the accent
  // colour in the continent bar, and the line under the range legend names them (user,
  // 2026-10-31: "some birds are distributed not only in one continent").
  var beyond = document.querySelector('[data-range-beyond]');
  var beyondList = beyond && beyond.querySelector('[data-range-beyond-list]');
  function showBeyond(card) {
    var others = card && current ? (card.dataset.range || '').split(' ').filter(function (c) {
      return c && c !== current;
    }) : [];
    options.forEach(function (o) { o.classList.toggle('is-in-range', others.indexOf(o.dataset.continent) !== -1); });
    if (!beyond) return;
    beyond.classList.toggle('is-shown', others.length > 0);
    if (!others.length) return;
    // The names in all three languages, from the bar's own labels, in the bar's order.
    beyondList.innerHTML = options.filter(function (o) { return others.indexOf(o.dataset.continent) !== -1; })
      .map(function (o) { return '<span class="range-beyond__name">' + o.innerHTML + '</span>'; })
      .join('<span class="range-beyond__dot" aria-hidden="true"> · </span>');
  }

  // ---- Pick: a marker (one place) or a row / card (its places). Its markers and rows stand
  // out, everything else pauses and dims; a card also shows its species' range. ----
  var picked = null;
  function pick(source) {
    if (source === picked) return;
    picked = source;
    var card = source && source.classList.contains('visit') ? source : null;
    var ids = source ? placesOf(source) : [];
    function hit(el) { return placesOf(el).some(function (p) { return ids.indexOf(p) !== -1; }); }
    map.classList.toggle('is-paused', !!source);
    map.classList.toggle('is-card-picked', !!card);    // Avians: only a card makes dots pop
    if (list) list.classList.toggle('is-picking', !!source);
    markers.forEach(function (m) {
      m.classList.toggle('is-active', ids.indexOf(m.dataset.place) !== -1);
      // Avians: of a bird's places, only where it was last seen moves (user, 2026-10-25).
      m.classList.toggle('is-latest', !!card && m.dataset.place === card.dataset.lastPlace);
    });
    rows.forEach(function (r) { r.classList.toggle('is-active', card ? r === card : hit(r)); });
    routeLines.forEach(function (l) { l.classList.toggle('is-active', hit(l)); });
    showRange(card && card.dataset.species);
    showBeyond(card);
  }

  function hoverable(el) {
    el.addEventListener('mouseenter', function () { pick(el); });
    el.addEventListener('mouseleave', function () { pick(null); });
    el.addEventListener('focus', function () { pick(el); });
    el.addEventListener('blur', function () { pick(null); });
  }
  markers.forEach(hoverable);
  rows.forEach(hoverable);

  // Tap a marker (phones): toggle it. Tap anywhere else: let go.
  markers.forEach(function (m) {
    m.addEventListener('click', function (e) {
      e.stopPropagation();
      pick(picked === m ? null : m);
    });
  });
  document.addEventListener('click', function () { pick(null); });

  // ---- Continent bar ----
  var GLIDE = 700;   // ms: the zoom, the same as the layout change in _places.scss
  var FADE = 200;    // ms: the list fades out before the layout changes, and back in after
  var current = '';
  var glide = null;
  var timers = [];

  // The line under the chosen option slides to it (user, 2026-10-25: an underline, not a pill).
  var line = bar && bar.querySelector('.continent-bar__line');
  function moveLine(instant) {
    var on = options.filter(function (o) { return o.getAttribute('aria-pressed') === 'true'; })[0];
    if (!line || !on) return;
    if (instant) line.style.transition = 'none';
    line.style.width = on.offsetWidth + 'px';
    line.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    if (instant) {
      line.getBoundingClientRect();     // apply before the transition comes back
      line.style.transition = '';
    }
  }

  function viewOf(id) {
    if (!id) return WORLD;
    if (id === 'antarctica') return ANTARCTICA;
    var shape = focusShapes.filter(function (s) { return s.dataset.continent === id; })[0];
    return shape ? shape.dataset.view.split(' ').map(Number) : WORLD;
  }

  // The view glides to `to`; the zoom is eased, and width and height move by ratio rather than
  // by difference, so a big zoom doesn't rush at its start.
  function glideTo(to, ms) {
    if (glide) cancelAnimationFrame(glide);
    var from = view.slice(), start = null;
    if (!ms) { setView(to); return; }
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / ms);
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // ease in-out
      var w = from[2] * Math.pow(to[2] / from[2], e);
      var h = from[3] * Math.pow(to[3] / from[3], e);
      // Centres move with the same easing.
      var cx = from[0] + from[2] / 2 + (to[0] + to[2] / 2 - from[0] - from[2] / 2) * e;
      var cy = from[1] + from[3] / 2 + (to[1] + to[3] / 2 - from[1] - from[3] / 2) * e;
      setView([cx - w / 2, cy - h / 2, w, h]);
      glide = t < 1 ? requestAnimationFrame(frame) : null;
    }
    glide = requestAnimationFrame(frame);
  }

  // Which markers, routes and rows belong to the chosen continent (all, for the world).
  function filter(id) {
    function off(el) {
      var where = (el.dataset.continents || el.dataset.continent || '').split(' ');
      return !!id && where.indexOf(id) === -1;
    }
    markers.forEach(function (m) { m.classList.toggle('is-off', off(m)); });
    routeLines.forEach(function (l) { l.classList.toggle('is-off', off(l)); });
    var shown = 0;
    rows.forEach(function (r) { r.hidden = off(r); if (!r.hidden) shown++; });
    if (empty) empty.hidden = shown > 0;
    if (list) list.dispatchEvent(new Event('scroll'));   // the fade follows the new length
    // Avians gallery: only this continent's photos; hidden when it has none.
    var tiles = 0;
    galleryTiles.forEach(function (t) { t.hidden = off(t); if (!t.hidden) tiles++; });
    if (gallery) gallery.hidden = galleryTiles.length > 0 && tiles === 0;
    document.dispatchEvent(new CustomEvent('continentchange'));   // the gallery count follows
  }

  // The other continents fade out through the mask; it is only applied while zoomed in, so the
  // world view is drawn exactly as made.
  function focusOn(id) {
    var land = id && id !== 'antarctica' ? id : '';
    var layer = ranges && ranges.querySelector('[data-range-layer]');
    if (land) {
      content.setAttribute('mask', 'url(#world-map-focus)');
      if (layer) layer.setAttribute('mask', 'url(#world-map-focus)');
      requestAnimationFrame(function () {
        focusShapes.forEach(function (s) { s.classList.toggle('is-out', s.dataset.continent !== land); });
      });
    } else {
      focusShapes.forEach(function (s) { s.classList.remove('is-out'); });
      timers.push(setTimeout(function () {
        if (current) return;
        content.removeAttribute('mask');
        if (layer) layer.removeAttribute('mask');
      }, GLIDE));
    }
  }

  function show(id, instant) {
    if (id === current && !instant) return;
    current = id;
    timers.forEach(clearTimeout);
    timers = [];
    pick(null);
    options.forEach(function (o) { o.setAttribute('aria-pressed', String(o.dataset.continent === id)); });
    moveLine(instant);
    var still = instant || reduceMotion.matches;

    function change() {
      section.classList.toggle('is-zoomed', !!id);
      section.classList.toggle('is-polar', id === 'antarctica');
      filter(id);
      focusOn(id);
      glideTo(viewOf(id), still ? 0 : GLIDE);
      timers.push(setTimeout(function () { section.classList.remove('is-switching'); }, still ? 0 : GLIDE));
    }
    if (still) { change(); return; }
    section.classList.add('is-switching');      // the list fades out first
    timers.push(setTimeout(change, FADE));
  }

  options.forEach(function (o) {
    o.addEventListener('click', function () {
      show(o.dataset.continent);
      var hash = o.dataset.continent ? '#' + o.dataset.continent : location.pathname;
      history.replaceState(null, '', hash);
    });
  });

  // Opened with a continent in the address: start there, without the glide.
  var start = location.hash.slice(1);
  if (start && options.some(function (o) { return o.dataset.continent === start; })) show(start, true);
  else moveLine(true);
  // Labels change width with the language and the window: keep the line under its option.
  window.addEventListener('langchange', function () { moveLine(true); });   // fired on window (lang-switch.js)
  window.addEventListener('resize', function () { moveLine(true); });

  // ---- Avians: fade the list's bottom edge while more cards are below (it scrolls inside a set
  // height on wider screens, _places.scss) ----
  if (list) {
    // The list beside a zoomed map is as tall as the map with its legend and credit under it
    // (user, 2026-10-28): --mapcol-h, used in _places.scss. In the world view the map column is
    // display: contents (no box, height 0) and the variable isn't used.
    var mapcol = map.closest('.places-mapcol') || map;
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (mapcol.offsetHeight) section.style.setProperty('--mapcol-h', mapcol.offsetHeight + 'px');
        list.dispatchEvent(new Event('scroll'));
      }).observe(mapcol);
    }
    // Which edges have more cards beyond them: below (a scrolling column) or to the sides
    // (Avians' world view: one row scrolling left and right). Those edges fade (_places.scss).
    var more = function () {
      var row = list.scrollWidth > list.clientWidth + 4;
      list.classList.toggle('has-more', !row && list.scrollTop + list.clientHeight < list.scrollHeight - 4);
      list.classList.toggle('has-more-right', row && list.scrollLeft + list.clientWidth < list.scrollWidth - 4);
      list.classList.toggle('has-more-left', row && list.scrollLeft > 4);
    };
    // The row is left to the browser: scrolling up / down over it scrolls the page (user,
    // 2026-10-27; turning the wheel into sideways scrolling trapped the page), and sideways
    // swipes, Shift + wheel or the scroll bar move the row.
    list.addEventListener('scroll', more, { passive: true });
    window.addEventListener('resize', more);
    window.addEventListener('langchange', more);
    more();
  }

  // ---- Phones: the row at the reading line is picked while the list scrolls past ----
  var phone = window.matchMedia('(max-width: 760px)');
  var queued = false;
  function readingLine() {
    queued = false;
    if (!phone.matches || !rows.length) return;
    var line = window.innerHeight * 0.4, best = null, bestDist = Infinity;
    rows.forEach(function (r) {
      if (r.hidden || r.classList.contains('is-search-off')) return;   // continent / card search
      var b = r.getBoundingClientRect();
      var d = Math.abs((b.top + b.bottom) / 2 - line);
      if (d < bestDist) { bestDist = d; best = r; }
    });
    var listBox = list.getBoundingClientRect();
    var inList = listBox.top < line && listBox.bottom > line;
    pick(inList && best ? best : null);
  }
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(readingLine);
  }, { passive: true });
})();
