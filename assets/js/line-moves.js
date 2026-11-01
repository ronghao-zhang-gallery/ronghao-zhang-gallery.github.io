/*
 * Line moves: homepage story lines that are held level on screen and slide in and out as the
 * dots change, instead of scrolling up with the page (user, 2026-10-23):
 *   - the title "Ronghao Zhang Photography" slides out past the right edge as the warbler forms;
 *   - the warbler line flies in from the left at the same time, then sinks away down (fading)
 *     as the dots change into the moment;
 *   - the moment line rises in from below, then sinks away down (fading) as the dots fall into
 *     the landscape;
 *   - the last line comes down from the top at the same time.
 * Which line moves how is set in _data/home.yml (enter / leave) and written into the markup by
 * dot-story.html as data-pin (the page the line belongs to), data-enter and data-leave.
 * On phones a line at the top (.dot-step--phone-top, the warbler's: its picture sits under it)
 * leaves upward instead of down, out under the top bar (user, 2026-11-01).
 *
 * Every move follows the scroll position, so scrolling back plays it backwards and stopping
 * halfway leaves the line halfway. The lines sit in the sticky layer with the dots, so the
 * browser itself keeps them level; this only moves them, which avoids the shake of correcting
 * their height one frame late.
 */
(function () {
  'use strict';

  var stage = document.querySelector('[data-dot-stage]');
  var step = stage && stage.querySelector('[data-dot-step]');
  var lines = stage ? stage.querySelectorAll('[data-pin]') : [];
  if (!step || !lines.length) return;

  // ---- Timing: the same stretch of scroll as the dot change (dot-morph.js holds each shape
  // still for the first and last 18% of the scroll between two pages) ----
  // Phones: every line rests in the same place (low, full width), so a line leaving and the next
  // one arriving would cross. There the old line leaves in the first half of the change and the
  // new one arrives in the second half; on wider screens the lines sit on different sides and
  // both move over the whole change.
  var HOLD = 0.18;
  var phone = window.matchMedia('(max-width: 760px)');
  function windowOf(arriving) {
    if (!phone.matches) return [HOLD, 1 - HOLD];
    return arriving ? [0.5, 1 - HOLD] : [HOLD, 0.5];
  }

  function header() {
    var h = document.querySelector('.site-header');
    return h ? h.offsetHeight : 0;
  }

  // How far a line's move has got, 0–1, eased in and out like the dots. `fraction` is how far
  // the scroll is between two pages.
  function move(fraction, arriving) {
    var w = windowOf(arriving);
    var m = Math.max(0, Math.min(1, (fraction - w[0]) / (w[1] - w[0])));
    return m * m * (3 - 2 * m);
  }

  // The text that is showing (the line has an English and a Chinese version; one is hidden).
  function visibleText(box) {
    return Array.prototype.find.call(box.querySelectorAll('.dot-step__text'), function (el) {
      return el.offsetParent !== null;
    });
  }

  // ---- Place every moving line for the current scroll position ----
  function update() {
    queued = false;
    // Scroll position in pages: 0 on the first page, 1 on the second, 1.5 halfway to the third.
    var page = Math.max(0, header() - stage.getBoundingClientRect().top) / step.offsetHeight;

    lines.forEach(function (box) {
      var text = visibleText(box);
      if (!text) return;
      var pin = Number(box.dataset.pin);
      var x = 0, y = 0, opacity = 1, shown = true;

      if (page < pin) {
        // Arriving: off screen until the change into this line's page starts.
        var m = move(page - (pin - 1), true);
        if (box.dataset.enter === 'left') x = -(1 - m) * (text.offsetLeft + text.offsetWidth + 40);
        // From the top: it starts just above the canvas, hidden under the top bar.
        if (box.dataset.enter === 'top') y = -(1 - m) * (text.offsetTop + text.offsetHeight + 40);
        // From the bottom: it starts just below the bottom edge.
        if (box.dataset.enter === 'bottom') y = (1 - m) * (box.offsetHeight - text.offsetTop);
        shown = m > 0 || !box.dataset.enter;
      } else if (page > pin) {
        // Leaving: gone once the change into the next page is done.
        var n = move(page - pin, false);
        var leave = box.dataset.leave;
        if (leave === 'down' && phone.matches && box.classList.contains('dot-step--phone-top')) leave = 'up';
        if (leave === 'right') x = n * (window.innerWidth - text.offsetLeft + 40);
        if (leave === 'up') {
          y = -n * (text.offsetTop + text.offsetHeight + 40);   // out under the top bar
          opacity = 1 - n;
        }
        if (leave === 'down') {
          y = n * (box.offsetHeight - text.offsetTop);   // its top reaches the bottom edge
          opacity = 1 - n;
        }
        shown = n < 1 || !box.dataset.leave;
      }

      box.style.transform = x || y ? 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)' : '';
      box.style.opacity = opacity < 1 ? opacity.toFixed(3) : '';
      // Set both ways: lines that fly in start hidden in the CSS (_dot-stage.scss), so they
      // don't flash in place before this script runs.
      box.style.visibility = shown ? 'visible' : 'hidden';
    });
  }

  var queued = false;
  function requestUpdate() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('langchange', requestUpdate);   // the other language's text has another width
  update();
})();
