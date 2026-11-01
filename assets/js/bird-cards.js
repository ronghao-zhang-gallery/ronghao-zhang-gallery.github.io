/*
 * Avians bird cards: search and sort (user, 2026-10-31: "a sort button (by time, by name) and a
 * search textbox"). Markup: the .card-tools bar above the list in
 * _includes/places/places-map.html; styles: _sass/components/_card-tools.scss.
 *
 *   - Search matches each card's data-search (bird names in all three languages, scientific
 *     name, place names), ignoring case and accents. Cards that don't match get
 *     .is-search-off; the continent bar keeps using `hidden`, so the two don't undo each other.
 *   - Sort: Recent is the page's own order (birds with photos first, each group newest sighting
 *     first); A–Z sorts by the name in the page's language (Chinese by its collation), keeping
 *     birds with photos first. It re-sorts when the language changes.
 *   - "No birds match." shows when the search leaves no card in view.
 */
(function () {
  'use strict';

  var tools = document.querySelector('[data-card-tools]');
  var list = document.querySelector('.visit-list');
  if (!tools || !list) return;

  var cards = Array.prototype.slice.call(list.querySelectorAll('.visit--bird'));
  var recent = cards.slice();                 // the page's order, kept for "Recent"
  var input = tools.querySelector('[data-card-search]');
  var buttons = Array.prototype.slice.call(tools.querySelectorAll('[data-card-sort]'));
  var none = document.querySelector('[data-card-none]');
  var empty = document.querySelector('[data-visit-empty]');
  var mode = 'recent';

  // ---- Text matching: lower case, accents dropped (so "forster" finds "Forster's") ----
  function fold(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '');
  }
  cards.forEach(function (c) { c._words = fold(c.dataset.search); });

  function lang() { return document.documentElement.dataset.lang || 'en'; }

  // ---- Search ----
  function search() {
    var terms = fold(input.value).split(/\s+/).filter(Boolean);
    var shown = 0;
    cards.forEach(function (c) {
      var off = terms.some(function (t) { return c._words.indexOf(t) === -1; });
      c.classList.toggle('is-search-off', off);
      if (!off && !c.hidden) shown++;
    });
    // Only this message when a search empties the list; the continent's own one otherwise.
    var searching = terms.length > 0;
    if (none) none.hidden = !searching || shown > 0;
    if (empty && searching) empty.hidden = true;
    list.scrollTop = 0;
    list.scrollLeft = 0;
    list.dispatchEvent(new Event('scroll'));     // edge fades follow the new length
  }

  // ---- Sort ----
  function hasPhoto(c) { return !!c.querySelector('.visit__camera'); }
  function sort() {
    var order = recent.slice();
    if (mode === 'name') {
      var l = lang();
      var key = 'name' + (l === 'en' ? 'En' : l === 'zh-Hant' ? 'ZhHant' : 'ZhHans');
      var collator = new Intl.Collator(l === 'en' ? 'en' : l, { sensitivity: 'base' });
      order.sort(function (a, b) {
        return (hasPhoto(b) - hasPhoto(a)) || collator.compare(a.dataset[key], b.dataset[key]);
      });
    }
    order.forEach(function (c) { list.appendChild(c); });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.cardSort === mode)); });
    list.scrollTop = 0;
    list.scrollLeft = 0;
    list.dispatchEvent(new Event('scroll'));
  }

  // ---- Placeholder in the page's language ----
  function placeholder() {
    input.placeholder = input.getAttribute('data-placeholder-' + lang().toLowerCase()) || input.dataset.placeholderEn;
  }

  // ---- Wiring ----
  input.addEventListener('input', search);
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      if (mode === b.dataset.cardSort) return;
      mode = b.dataset.cardSort;
      sort();
    });
  });
  window.addEventListener('langchange', function () {   // lang-switch.js fires it on window
    placeholder();
    if (mode === 'name') sort();
  });
  // A continent change resets the list's own messages; keep the search's in step.
  document.addEventListener('continentchange', function () { if (input.value) search(); });
  placeholder();
})();
