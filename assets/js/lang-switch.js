/*
 * Language switch in the top bar: EN | 简 | 繁 (user, 2026-10-23; was a two-language button).
 * lang-init.html has already set data-lang before the first paint and provides
 * window.siteLang.apply(), which also loads that language's font. This handles clicks, saves
 * the choice, marks the current language for screen readers (aria-pressed), and tells the page
 * the language changed (the 'langchange' event), so scripts that measure text can measure the
 * newly shown version.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var buttons = document.querySelectorAll('[data-lang-set]');
  if (!buttons.length || !window.siteLang) return;

  function sync() {
    var current = root.getAttribute('data-lang');
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-lang-set') === current));
    });
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      var lang = button.getAttribute('data-lang-set');
      if (lang === root.getAttribute('data-lang')) return;
      window.siteLang.apply(lang);
      try { localStorage.setItem('lang', lang); } catch (e) { /* storage blocked: still switches */ }
      sync();
      window.dispatchEvent(new Event('langchange'));
    });
  });

  sync();
})();
