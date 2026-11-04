/*
 * Avians checklist (_includes/avians/checklist.html): folds each trip to its heading row
 * (user, 2026-11-03: "only when click the '>', it shows the full bird list") and fades the
 * foot of the checklist's scroll box while more trips are below it.
 *   - On load every trip is closed (the page's HTML has them open, so without this script
 *     nothing is hidden). A trip's ">" button opens or closes its bird rows.
 *   - The box has a set height and scrolls inside itself; .has-more fades its foot until the
 *     end is reached, like the bird card list.
 */
(function () {
  'use strict';

  var section = document.querySelector('[data-checklist]');
  if (!section) return;
  var box = section.querySelector('[data-checklist-scroll]');
  var toggles = Array.prototype.slice.call(section.querySelectorAll('[data-checklist-toggle]'));

  // ---- Bottom fade: only while there is more below ----
  function fade() {
    box.classList.toggle('has-more', box.scrollTop + box.clientHeight < box.scrollHeight - 4);
  }

  // ---- Open / close a trip ----
  function setOpen(button, open) {
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    button.closest('.checklist__trip').classList.toggle('is-open', open);
  }

  toggles.forEach(function (b) {
    setOpen(b, false);
    b.addEventListener('click', function () {
      setOpen(b, b.getAttribute('aria-expanded') !== 'true');
      fade();
    });
  });
  section.classList.add('checklist--folded');   // CSS hides the closed trips' bird rows

  box.addEventListener('scroll', fade, { passive: true });
  window.addEventListener('resize', fade);
  window.addEventListener('langchange', fade);            // names change length
  document.addEventListener('continentchange', fade);     // places-map.js hides other trips
  fade();
})();
