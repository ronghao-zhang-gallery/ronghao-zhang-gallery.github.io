/*
 * Count-up for the Traces / Avians count line ("10 places · 86 species"; user,
 * 2026-11-04: "when refresh the page, it should fastly increase from 0 to this number").
 *   - Loaded right after the count line, not deferred: it sets every number to 0 before the
 *     first paint, so the final numbers never flash up first.
 *   - Each number ([data-count-to], _includes/places/count-num.html) climbs to its value over
 *     the same 4 s, quick at first and slowing as it nears its number, so the last steps tick
 *     over one by one; smaller numbers settle a little sooner.
 *   - It starts once the fonts are ready (they load with font-display: block, so earlier frames
 *     might not be seen). Reduced motion: the final numbers stay, no counting.
 */
(function () {
  'use strict';

  var DURATION = 4000;  // ms (user, 2026-11-04: 0.9 s, then 2.2 s, were too fast)

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var nums = Array.prototype.slice.call(document.querySelectorAll('[data-count-to]'));
  if (!nums.length) return;

  var targets = nums.map(function (el) { return parseInt(el.getAttribute('data-count-to'), 10) || 0; });
  nums.forEach(function (el) { el.textContent = '0'; });

  // Ease out (quartic): quick at first, then slowing more and more near the end (user,
  // 2026-11-04: "a bit more slower when approaching"). A steeper curve would reach the last
  // whole number long before the end and seem to stop.
  function ease(t) { return 1 - Math.pow(1 - t, 4); }

  function run() {
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / DURATION);
      var k = ease(t);
      nums.forEach(function (el, i) { el.textContent = String(Math.round(targets[i] * k)); });
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  // Never wait on the fonts for more than half a second.
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 500); })]).then(run);
})();
