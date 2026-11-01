/*
 * Shapes for the homepage dot story (_includes/home/dot-story.html), in story order. One line of
 * text per shape comes from `story` in _data/home.yml.
 *
 * A shape is { image: url, imageDark: url, outline: [[x, y], ...], place: 'band' } (all but image
 * optional): imageDark is used in dark mode; outline (picture pixels) keeps only the subject
 * inside it; place: 'band' spans the content width at the bottom of the screen, and its story
 * line then needs `place: top`. dot-morph.js also accepts a function that paints on a hidden
 * 1000 × 700 canvas. It places more dots where a pixel stands out from the picture's background
 * and gives each dot the colour underneath it.
 *
 * All pictures live in assets/images/homepage/dots/, one version per theme (ivory paper for light
 * mode, dark backdrop for dark mode). They are only read, never changed.
 */
(function () {
  'use strict';

  var DOTS = '/assets/images/homepage/dots/';

  // ---- 1. The photographer at work with a long lens on a tripod (left) ----
  var portrait = { image: DOTS + 'portrait_bright.png', imageDark: DOTS + 'portrait_dark.png' };

  // ---- 2. The warbler, whole: bird, branch and leaves (right) ----
  var warbler = { image: DOTS + 'wabler_bright.png', imageDark: DOTS + 'wabler_dark.png' };

  // ---- 4. The landscape, at the bottom of the screen ----
  var landscape = { image: DOTS + 'landscape_bright.png', imageDark: DOTS + 'landscape_dark.png', place: 'band' };

  // ---- 3. Graduates jumping in front of a stone building (left) ----
  // Replaced the drawn test tree (user, 2026-10-22). Faces are too small to come through in dots,
  // which the user accepted: the dots carry the scene's mood, not each face.
  var moment = { image: DOTS + 'moment_bright.png', imageDark: DOTS + 'moment_dark.png' };

  // Order follows the story sentence (user, 2026-10-23): wings, then the celebration, then the journey.
  window.DotShapes = [portrait, warbler, moment, landscape];
})();
