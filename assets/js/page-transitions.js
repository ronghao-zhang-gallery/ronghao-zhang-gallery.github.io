/*
 * Page changes from the site bar, for browsers WITHOUT cross-document view transitions
 * (_page-transitions.scss does the work everywhere else): clicking another page's link first
 * slides the filled pill over to it, then opens the page. Same-page links (Contact Me), clicks
 * with a modifier key and reduced motion are left alone.
 */
(function () {
  'use strict';

  if ('CSSViewTransitionRule' in window) return;   // the browser animates the change itself
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var nav = document.querySelector('.site-nav');
  var pill = nav && nav.querySelector('.site-nav__pill');
  if (!pill) return;
  var from = pill.parentElement;
  var SLIDE_MS = 320;

  nav.querySelectorAll('.site-nav__link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href');
      if (link === from || href.charAt(0) === '#') return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      var a = from.getBoundingClientRect(), b = link.getBoundingClientRect();
      pill.style.transition = 'transform ' + SLIDE_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1), ' +
        'width ' + SLIDE_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1), height ' + SLIDE_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
      pill.style.right = 'auto';
      pill.style.bottom = 'auto';
      pill.style.width = a.width + 'px';
      pill.style.height = a.height + 'px';
      pill.getBoundingClientRect();                 // start from the old size
      pill.style.transform = 'translate(' + (b.left - a.left) + 'px, ' + (b.top - a.top) + 'px)';
      pill.style.width = b.width + 'px';
      pill.style.height = b.height + 'px';
      from.classList.add('is-leaving');
      link.classList.add('is-arriving');
      window.setTimeout(function () { window.location.href = link.href; }, SLIDE_MS);
    });
  });
})();
