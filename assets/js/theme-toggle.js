/*
 * Light/dark switch in the top bar.
 * theme-init.html has already set data-theme before the first paint; this script only
 * handles clicks, saves the visitor's choice, and keeps the button's state in sync.
 */
(function () {
  'use strict';

  // ---- Elements ----
  var root = document.documentElement;
  var button = document.querySelector('[data-theme-toggle]');
  if (!button) return;

  function isDark() {
    return root.getAttribute('data-theme') === 'dark';
  }

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    button.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  // ---- Click: switch and remember ----
  button.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked: still switches */ }
  });

  // ---- System setting changes: follow it until the visitor has chosen ----
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', function (event) {
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) { /* storage blocked */ }
    if (!saved) setTheme(event.matches ? 'dark' : 'light');
  });

  setTheme(isDark() ? 'dark' : 'light');
})();
