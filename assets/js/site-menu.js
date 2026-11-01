/*
 * Site menu (narrow screens): the page links fold into a button in the site bar
 * (site-header.html, _site-header.scss). Tapping it opens or closes them; a tap elsewhere, a
 * link, or Escape closes them.
 */
(function () {
  'use strict';

  var bar = document.querySelector('[data-site-bar]');
  var button = bar && bar.querySelector('[data-menu-toggle]');
  if (!button) return;

  function setOpen(open) {
    bar.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  }

  button.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(!bar.classList.contains('is-open'));
  });
  bar.querySelectorAll('.site-nav__link').forEach(function (link) {
    link.addEventListener('click', function () { setOpen(false); });
  });
  document.addEventListener('click', function (e) {
    if (!bar.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });
})();
