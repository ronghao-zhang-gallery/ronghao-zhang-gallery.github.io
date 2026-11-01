/*
 * Scroll-read text: the words of each [data-scroll-words] line turn from pale to full ink
 * one by one as the line moves up the screen, and turn pale again when you scroll back.
 * Like the dots, it follows the scroll position, not a timer.
 * Without this script the text simply shows in full ink.
 */
(function () {
  'use strict';

  var lines = document.querySelectorAll('[data-scroll-words]');
  if (!lines.length) return;

  // ---- Split each line into word spans ----
  var words = [];
  lines.forEach(function (line) {
    // Chinese has no spaces between words, so it lights up character by character.
    var chinese = /^zh/.test(line.getAttribute('lang') || '');
    var text = line.textContent.trim();
    var parts = chinese ? Array.from(text) : text.split(/\s+/);
    line.textContent = '';
    var spans = parts.map(function (word, i) {
      var span = document.createElement('span');
      span.className = 'scroll-word';
      span.textContent = word;
      line.appendChild(span);
      if (!chinese && i < parts.length - 1) line.appendChild(document.createTextNode(' '));
      return span;
    });
    line.classList.add('is-split');
    words.push({ line: line, spans: spans });
  });

  // ---- Light up words by how far the line has risen ----
  // Wide screens: starts when the line is 85% down the screen, done by the middle.
  // Phones: the line rests near the bottom (under the shape), so it starts just below the
  // screen and is done by 85%.
  var phone = window.matchMedia('(max-width: 760px)');
  var steps = document.querySelectorAll('[data-dot-step]');

  // Where the line's top is on screen, or for a line held level by line-moves.js (inside a
  // [data-pin] box), where it would be if it scrolled with its page: its own step's top plus its
  // place in the box. That way it lights up on the same stretch of scroll as before it was held.
  function topOf(line) {
    var box = line.closest('[data-pin]');
    var top = line.getBoundingClientRect().top;
    var step = box && steps[Number(box.dataset.pin)];
    if (!step) return top;
    return step.getBoundingClientRect().top + top - box.getBoundingClientRect().top;
  }

  function update() {
    queued = false;
    var vh = window.innerHeight;
    var start = phone.matches ? 1.1 : 0.85;
    var end = phone.matches ? 0.85 : 0.52;
    words.forEach(function (entry) {
      var top = topOf(entry.line);
      var progress = Math.max(0, Math.min(1, (vh * start - top) / (vh * (start - end))));
      var lit = Math.round(progress * entry.spans.length);
      entry.spans.forEach(function (span, i) {
        span.classList.toggle('is-lit', i < lit);
      });
    });
  }

  var queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener('resize', update);
  window.addEventListener('langchange', update);   // the other language's lines are now the visible ones
  update();
})();
