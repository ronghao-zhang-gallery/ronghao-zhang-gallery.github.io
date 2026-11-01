/*
 * Avians gallery sidebar (user, 2026-10-27: "search and filter and sort"). Markup:
 * _includes/avians/gallery-sidebar.html; styles: _sass/components/_gallery-side.scss.
 *   - Search matches each tile's data-search (bird and place names in all three languages).
 *   - Filters: species, place, year checkboxes; nothing ticked in a group = no limit.
 *   - Sort reorders the tiles in the grid, so the full-screen viewer follows the same order.
 *   - Tiles that don't match get .is-filtered-out (the continent bar uses `hidden`; the two
 *     work together). The result line counts the photos shown.
 *   - The search box's placeholder follows the page language.
 *   - Phones: the panel folds behind a "Filter & sort" button.
 *   - A bird card's photo (data-gallery-jump, user 2026-10-30) scrolls to its tile here, first
 *     clearing any filter that hides it, and briefly outlines the tile.
 */
(function () {
  'use strict';

  var side = document.querySelector('[data-gallery-side]');
  var grid = document.querySelector('[data-gallery-grid]');
  if (!side || !grid) return;

  var tiles = Array.prototype.slice.call(grid.querySelectorAll('.photo-tile'));
  var search = side.querySelector('[data-filter-search]');
  var boxes = Array.prototype.slice.call(side.querySelectorAll('[data-filter]'));
  var sorts = Array.prototype.slice.call(side.querySelectorAll('[data-filter-sort]'));
  var counts = Array.prototype.slice.call(side.querySelectorAll('[data-result-n]'));
  var empty = document.querySelector('[data-gallery-empty]');

  // ---- Filtering ----
  function chosen(group) {
    return boxes.filter(function (b) { return b.dataset.filter === group && b.checked; })
      .map(function (b) { return b.value; });
  }

  function apply() {
    var words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var want = { species: chosen('species'), place: chosen('place'), year: chosen('year') };
    var photos = 0, shown = 0;
    tiles.forEach(function (t) {
      var d = t.dataset;
      var ok = words.every(function (w) { return d.search.indexOf(w) !== -1; }) &&
        Object.keys(want).every(function (g) { return !want[g].length || want[g].indexOf(d[g]) !== -1; });
      t.classList.toggle('is-filtered-out', !ok);
      if (ok && !t.hidden) { shown++; photos += Number(d.count) || 1; }
    });
    counts.forEach(function (n) { n.textContent = photos; });
    if (empty) empty.hidden = shown > 0;
  }

  // ---- Sorting: reorder the tiles in place ----
  function sort() {
    var by = (sorts.filter(function (r) { return r.checked; })[0] || {}).value || 'newest';
    var newest = function (a, b) { return a.dataset.taken < b.dataset.taken ? 1 : -1; };
    var order = {
      newest: newest,
      oldest: function (a, b) { return -newest(a, b); },
      name: function (a, b) { return a.dataset.name.localeCompare(b.dataset.name) || newest(a, b); },
      count: function (a, b) { return (b.dataset.count - a.dataset.count) || newest(a, b); }
    }[by];
    tiles.slice().sort(order).forEach(function (t) { grid.appendChild(t); });
  }

  search.addEventListener('input', apply);
  boxes.forEach(function (b) { b.addEventListener('change', apply); });
  sorts.forEach(function (r) { r.addEventListener('change', sort); });
  function clearAll() {
    search.value = '';
    boxes.forEach(function (b) { b.checked = false; });
    sorts[0].checked = true;
    sort();
    apply();
  }
  side.querySelector('[data-filter-clear]').addEventListener('click', clearAll);
  document.addEventListener('continentchange', apply);

  // ---- Bird cards → gallery: a card's photo goes to its tile (user, 2026-10-30) ----
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-gallery-jump]');
    if (!link) return;
    var tile = document.getElementById(link.getAttribute('href').slice(1));
    if (!tile) return;
    e.preventDefault();
    // Hidden by the continent bar (the cover was taken on another continent): the species'
    // first tile in view instead; none in view, then stay put.
    if (tile.hidden) {
      tile = tiles.filter(function (t) { return !t.hidden && t.dataset.species === tile.dataset.species; })[0];
      if (!tile) return;
    }
    if (tile.classList.contains('is-filtered-out')) clearAll();
    tile.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    tile.querySelector('.photo-tile__open').focus({ preventScroll: true });
    // Restart the outline even if the same tile was just marked.
    tile.classList.remove('is-flash');
    void tile.offsetWidth;
    tile.classList.add('is-flash');
  });
  grid.addEventListener('animationend', function (e) {
    if (e.animationName === 'photo-tile-flash') e.target.closest('.photo-tile').classList.remove('is-flash');
  });

  // ---- Placeholder in the page's language ----
  function placeholder() {
    var lang = (document.documentElement.dataset.lang || 'en').toLowerCase();
    search.placeholder = search.getAttribute('data-placeholder-' + lang) || search.dataset.placeholderEn;
  }
  window.addEventListener('langchange', placeholder);   // fired on window (lang-switch.js)
  placeholder();

  // ---- Phones: fold the panel ----
  var toggle = side.querySelector('[data-side-toggle]');
  toggle.addEventListener('click', function () {
    var open = side.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  apply();
})();
