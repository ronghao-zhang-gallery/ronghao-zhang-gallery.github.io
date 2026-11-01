/*
 * Full-screen photo viewer for the Avians gallery (user, 2026-10-26: "like Apple Finder's
 * gallery mode"). Clicking a gallery tile opens its large copy with ‹ › to step through the
 * photos, an Information sidebar with the EXIF data, and a strip of thumbnails at the bottom.
 *   - Each gallery tile is one photo or a stack of similar ones; its photos are hidden
 *     .photo-item elements. The viewer steps through every photo one by one, across all tiles
 *     in view and in their order (the continent bar and the sidebar's filters hide others, its
 *     sort reorders them), starting at the clicked tile's cover.
 *   - Keys: ← → step, Esc closes, I toggles the sidebar. Phones: swipe left / right.
 *   - The sidebar starts closed; a small 摄影参数 / Photo Details tab on the photo's right edge opens it (ⓘ on narrow windows).
 *   - Names, places and dates are copied from the photo item, which holds all three
 *     languages, so the language switch keeps working while the viewer is open.
 *   - The site's top bar stays above the viewer (user, 2026-10-26), so theme and language can
 *     be switched while viewing; Tab cycles through the top bar and the viewer.
 *   - Focus moves into the viewer and back to the tile on close; the page doesn't scroll.
 * Markup: _includes/avians/viewer.html; styles: _sass/components/_photo-viewer.scss.
 */
(function () {
  'use strict';

  var viewer = document.querySelector('[data-viewer]');
  var gallery = document.querySelector('[data-gallery]');
  if (!viewer || !gallery) return;

  var img = viewer.querySelector('[data-viewer-img]');
  var title = viewer.querySelector('[data-viewer-title]');
  var count = viewer.querySelector('[data-viewer-count]');
  var strip = viewer.querySelector('[data-viewer-strip]');
  var infoBtn = viewer.querySelector('[data-viewer-info]');
  var stage = viewer.querySelector('[data-viewer-stage]');
  var field = {};
  Array.prototype.forEach.call(viewer.querySelectorAll('[data-field]'), function (dd) {
    field[dd.dataset.field] = dd;
  });

  var tiles = [];       // the photos (.photo-item) of the tiles in view when the viewer opened
  var index = 0;
  var opener = null;    // the tile button to give focus back to

  // ---- Showing one photo ----
  function copyOf(tile, selector) {
    var el = tile.querySelector(selector);
    return el ? el.cloneNode(true).innerHTML : '';
  }

  function setField(name, html) {
    var dd = field[name];
    if (!dd) return;
    dd.innerHTML = html || '—';
    dd.parentNode.hidden = !html;           // rows with no data (e.g. no lens) are left out
  }

  function show(i) {
    index = (i + tiles.length) % tiles.length;
    var t = tiles[index], d = t.dataset;

    // The large copy; if it isn't there (not imported yet), the local thumbnail.
    img.classList.remove('is-loaded');
    img.onload = function () { img.classList.add('is-loaded'); };
    img.onerror = function () { if (d.local && img.src.indexOf(d.local) === -1) img.src = d.local; };
    img.src = d.large;

    title.innerHTML = copyOf(t, '.photo-item__name');
    count.textContent = (index + 1) + ' / ' + tiles.length;
    setField('name', copyOf(t, '.photo-item__name'));
    setField('place', copyOf(t, '.photo-item__place'));
    var time = ((d.taken || '').split('T')[1] || '').slice(0, 8);   // whole seconds
    setField('taken', copyOf(t, '.photo-item__date') + (time ? '&ensp;' + time : ''));
    setField('camera', d.camera);
    setField('lens', d.lens);
    setField('focal', d.focal && d.focal + ' mm');
    setField('aperture', d.aperture && 'f/' + d.aperture);
    setField('exposure', d.exposure && d.exposure + ' s');
    setField('iso', d.iso);

    Array.prototype.forEach.call(strip.children, function (b, k) {
      b.setAttribute('aria-current', k === index ? 'true' : 'false');
    });
    var on = strip.children[index];
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

    // Fetch the neighbours' large copies ahead, so stepping is instant.
    [index - 1, index + 1].forEach(function (k) {
      var n = tiles[(k + tiles.length) % tiles.length];
      if (n) new Image().src = n.dataset.large;
    });
  }

  // ---- The bottom strip: one thumbnail button per photo in view ----
  function buildStrip() {
    strip.innerHTML = '';
    tiles.forEach(function (t, k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'viewer__thumb';
      var name = t.querySelector('.photo-item__name [data-l="en"]');
      b.setAttribute('aria-label', (name ? name.textContent : '') + ' ' + (k + 1));
      var im = document.createElement('img');
      im.src = t.dataset.thumb;
      im.alt = '';
      im.onerror = function () { if (im.src.indexOf(t.dataset.local) === -1) im.src = t.dataset.local; };
      b.appendChild(im);
      b.addEventListener('click', function () { show(k); });
      strip.appendChild(b);
    });
  }

  // ---- Open / close ----
  function open(tile, button) {
    tiles = [];
    Array.prototype.forEach.call(gallery.querySelectorAll('.photo-tile'), function (t) {
      if (!t.hidden && !t.classList.contains('is-filtered-out')) tiles = tiles.concat(Array.prototype.slice.call(t.querySelectorAll('.photo-item')));
    });
    opener = button;
    buildStrip();
    viewer.hidden = false;
    document.documentElement.classList.add('has-viewer');   // page behind doesn't scroll
    requestAnimationFrame(function () { viewer.classList.add('is-open'); });
    show(tiles.indexOf(tile.querySelector('.photo-item--cover') || tile.querySelector('.photo-item')));
    viewer.querySelector('[data-viewer-close]').focus();
  }

  function close() {
    viewer.classList.remove('is-open');
    document.documentElement.classList.remove('has-viewer');
    var done = function () { viewer.hidden = true; img.removeAttribute('src'); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 250);
    if (opener) opener.focus();
  }

  gallery.addEventListener('click', function (e) {
    var button = e.target.closest('[data-viewer-open]');
    if (button) open(button.closest('.photo-tile'), button);
  });
  viewer.querySelector('[data-viewer-close]').addEventListener('click', close);
  viewer.querySelector('[data-viewer-prev]').addEventListener('click', function () { show(index - 1); });
  viewer.querySelector('[data-viewer-next]').addEventListener('click', function () { show(index + 1); });

  // The sidebar can be hidden (Finder's "Show Less"). Two buttons open it: the small labelled tab
  // on the photo's right edge (wide windows) and ⓘ in the top bar (narrow windows, where it takes a row under the photo). Closed by default (user,
  // 2026-10-27: shown when someone wants to look), and again when the window is resized across
  // the 760 px line (a wide window made small used to keep it open over the photo).
  var drawerBtn = viewer.querySelector('[data-viewer-drawer]');
  function setInfo(on) {
    viewer.classList.toggle('is-info-hidden', !on);
    infoBtn.setAttribute('aria-pressed', String(on));
    drawerBtn.setAttribute('aria-expanded', String(on));
  }
  function toggleInfo() { setInfo(viewer.classList.contains('is-info-hidden')); }
  infoBtn.addEventListener('click', toggleInfo);
  drawerBtn.addEventListener('click', toggleInfo);
  setInfo(false);
  window.matchMedia('(max-width: 760px)').addEventListener('change', function () { setInfo(false); });

  // ---- Keys, and keeping Tab inside the viewer and the site's top bar ----
  // The top bar stays usable over the viewer (theme and language switches), so Tab cycles
  // through its visible links and buttons, then the viewer's buttons.
  document.addEventListener('keydown', function (e) {
    if (viewer.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'i' || e.key === 'I') toggleInfo();
    else if (e.key === 'Tab') {
      var focusable = Array.prototype.filter.call(
        document.querySelectorAll('.site-header a, .site-header button, [data-viewer] button:not([hidden])'),
        function (el) { return el.getClientRects().length > 0; });   // skip hidden ones (e.g. phone menu)
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });

  // ---- Swipe on touch screens ----
  var startX = null;
  stage.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
})();
