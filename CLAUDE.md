# Ronghao Zhang — Photography Site

Personal photography website built with Jekyll and deployed to GitHub Pages
(https://ronghao-zhang-gallery.github.io).

## Status

Rebuilding from scratch (started 2026-10-20) with a **new design** and a **new
content structure**. The previous site was kept in `archive/` for reference until the user
removed it (2026-11-01, commit 776f75b "remove the archived old repository"); it is still in
git history (e.g. `git show b025e21:archive/…`). New code must not depend on it.

## Commands

- `bundle exec jekyll serve` — local preview at http://localhost:4000
- `bundle exec jekyll build` — build into `_site/`
- Deploy: push to `master` → `.github/workflows/jekyll.yml` builds and publishes to Pages.
- **The user works with GitHub Desktop** (said 2026-10-25): creating repos, committing and
  pushing happen there. Claude prepares files and says what to commit; give Desktop steps, not
  `gh` commands.
  Because the deploy uses Actions (not the `github-pages` gem), any Jekyll plugin can be used.

## Working rules (always follow)

1. **Pull before you edit.** Run `git pull --ff-only` before changing any file.
   If the pull fails (diverged history, or it would overwrite local changes),
   stop and tell the user. Do not merge, rebase, stash or discard to force it through.
2. **Comment and organise every edit.**
   - Start each file with a short header comment saying what it is for.
   - Label sections of a file with clear divider comments, and keep one concern
     per file (e.g. one Sass partial per component, one JS module per feature).
   - Comment the *why* and anything non-obvious; don't narrate trivial lines.
   - In code you touch, remove dead code, unused styles and stale comments.
3. **Every uploaded photo goes through the photo script.** See [Photo workflow](#photo-workflow).
4. **Save every memory in this file.** Anything worth remembering across sessions
   (decisions, preferences, who owns what) goes into the right section of this
   CLAUDE.md, not into Claude's private memory folder, so it lives with the project.

## Photo workflow

### Where photos live

- **Not in this repo.** All photos go in **one image repo** under the
  `ronghao-zhang-gallery` GitHub account (name to decide, e.g. `photos`), cloned
  next to this one in `/Users/zhangronghao/Documents/github_gallary/`.
- Inside it, photos are **grouped by year** (the year the photo was taken, from
  EXIF). Each year holds only web-sized copies:
  ```
  <image-repo>/
    2025/
      large/2025-09-19_001.jpg   # 2560 px long edge, ~1 MB:   full-screen viewer, slideshow
      thumb/2025-09-19_001.jpg   # 800 px long edge, ~0.1 MB:  grids, cards, previews
    2026/
      large/...
      thumb/...
  ```
- Trips, subjects and places are **not** folders. They live in the site's photo
  data, so a photo can belong to a trip and a subject at the same time.
- **Originals never go on GitHub.** CR3 raws and full-size exports stay on local
  disk or backup (e.g. `../2026-05-03_Birding/RAW_RAW/`). Photo exports left in the repo root
  (e.g. a test photo) are gitignored (`/*.jpg`), so they are never committed or deployed (a
  `"*.jpg"` build exclude was tried and dropped: Jekyll applies it in every folder, so it also
  dropped local-photos/ thumbnails).
- Why: full-size JPEG exports are large (roughly 15–20 MB each).
  GitHub recommends repos under 1 GB, a Pages site is capped at 1 GB, and git
  keeps every version of a file forever.
- The image repo is served with GitHub Pages:
  `https://ronghao-zhang-gallery.github.io/<image-repo>/2025/large/2025-09-19_001.jpg`.
  Do not use `raw.githubusercontent.com` (generic content type, 5-minute cache).
- **Room to grow:** at ~1.1 MB per photo, one repo holds roughly 900 photos before
  the 1 GB limit. The site data stores only filenames, and the site builds each URL
  from a per-year base URL in `_config.yml`. If the repo gets full, move the oldest
  year folders to a new repo and change one line of config; no photo data changes.

### Adding new photos: the inbox

The inbox is how the script knows which photos are new: anything in it is new,
everything already in the image repo is done and never touched again.

1. Export JPEGs from the raws (any filename) into `inbox/` in this repo,
   e.g. `inbox/IM8A7076.jpg`. No subfolders needed: the year comes from EXIF.
2. Run `python3 scripts/import_photos.py` (to be written).
3. For each photo in the inbox, the script:
   - reads EXIF: date taken, camera, lens, focal length, aperture, shutter, ISO,
     and GPS if present;
   - assigns its name (see [Naming](#naming));
   - writes the `large/` and `thumb/` copies into `../<image-repo>/<year>/`;
   - adds the photo to the site's photo data with EXIF filled in, leaving
     `title` and `location` blank for the user (location comes from GPS if present);
   - moves the export to `inbox/_done/` so it is never processed twice;
   - prints a summary of what it did.
4. The user fills in titles and locations, then commits and pushes both the
   image repo and this repo.

- The script does **not** watermark photos (see [Out of scope](#out-of-scope)).
- `inbox/` is gitignored and excluded from the Jekyll build.
- This script replaces the older ones in `../00_PRELIMINARIES/02_Scripts/src/`:
  `rename_dir_images.py` (old long names) and `lower_resolution.py` (720 px
  `_low-res` copies). They stay there for reference.

### Naming

Format: `YYYY-MM-DD_NNN.jpg`, e.g. `2025-09-19_001.jpg`, `2025-09-19_002.jpg`, `2025-09-20_001.jpg`.

- `YYYY-MM-DD` is the date the photo was **taken**, read from EXIF
  (`DateTimeOriginal`), never the upload date.
- `NNN` is a 3-digit counter that restarts at `001` for each date.
- Camera settings are **not** in the filename. The script reads them from EXIF
  and stores them in the site data.
- Numbering rules for the script:
  1. Find the highest number already used for that date in `<image-repo>/<year>/large/`.
  2. Give new photos the next free numbers. When several new photos share a date,
     number them in the order they were taken (EXIF time).
  3. **Never renumber or rename a photo that already has a number.** Image URLs
     must stay stable. A late addition gets the next free number even if it was
     taken earlier in the day; the site sorts by EXIF time, not by filename.

### Decided 2026-10-25: git image repo, web copies only

- **Hosting: a GitHub image repo** (user: "lets use git"), split by year, served with GitHub
  Pages; originals (25 MB exports, CR3 raws) never online. Measured on IM8A1985-2 (6348×4220,
  25 MB): 2560 px JPEG q85 168 KB / WebP q80 72 KB; 800 px JPEG 29 KB / WebP 14 KB (soft
  background; detailed landscapes run ~0.5–1.5 MB as 2560 px JPEG). Plan on ~0.5 MB per photo
  (large + thumb) → ~2,000 photos per 1 GB repo; when one fills, move the oldest years to a new
  repo and change `photo_hosts` in `_config.yml`.
- **WebP for the web copies** (Claude's recommendation, about half of JPEG; the user went with
  the plan; confirm before the import script writes files). That changes the `.jpg` in the
  layout above to `.webp`.
- **Write once, never rewrite**: git keeps every version, so re-exports must not overwrite a
  published file (the naming rules already forbid renumbering).
- If the collection ever outgrows this (thousands a year, or photos to replace): Cloudflare R2
  (10 GB free, no egress fees), only `photo_hosts` changes.
- **The image repo exists: `bird-2026`** (made 2026-10-25 in a separate session, from a
  hand-off): `ronghao-zhang-gallery/bird-2026`, cloned at `../bird-2026/`, Pages at
  https://ronghao-zhang-gallery.github.io/bird-2026. **Its own README / CLAUDE.md are the source
  of truth for its layout**, which differs from the plan above:
  - **one repo per subject and year** (`bird-2026`; other years / subjects get their own);
  - `large/` up to **3840 px** (never enlarged) and `thumb/` 800 px, **WebP**, same name in both;
  - names **`YYYYMMDD-NNN_bird-name_year_place.webp`**, e.g.
    `20261025-001_eastern-bluebird_2026_atlanta-ga.webp` (counter per day in order taken);
  - the user may drop the original exports in its root for reference; they are gitignored there.
  `photo_hosts` in `_config.yml` is keyed by repo name (`bird-2026: <Pages URL>`); Avians builds
  a thumbnail URL as `photo_hosts["bird-" + year] + "/thumb/" + photo`, falling back to
  `local-photos/` (local preview only) for photos not imported yet, then hiding.
  Still to build: `scripts/import_photos.py` (inbox → EXIF → names → large/thumb into the image
  repo → site data), folding in `scripts/add_sighting.py`.

### Still to decide

- The name of the image repo.
- The format of the site's photo data, which depends on the content structure
  chosen under Requirements.
- The user will set these up and give instructions (other repositories will be
  created). Don't decide or build any of them until then.

## Requirements

<!-- Fill these in. Anything written here overrides the defaults below. -->

**Who the site is for and what it must do** lives in [PRODUCT.md](PRODUCT.md)
(written with the impeccable skill). Read it before design work; don't repeat its
content here.

**Site text** (user, 2026-10-21): the user describes what each paragraph should contain, and
Claude writes the text. Don't invent the content of a paragraph the user hasn't described;
use a marked placeholder instead.

**Design skills in this repo** (`.claude/skills/`): `impeccable` and `frontend-design`
(saved from the user 2026-10-21). Follow `frontend-design` for any design work.

### Design
<!-- Mood, colours, light/dark, typography, reference sites you like. -->
- **Illustrated postcard art is Codex's job, not Claude's** (decided 2026-10-20).
  The idea (vintage screen-print illustrations on ivory paper, made from a photo)
  is back on after being dropped earlier. Codex uses
  `.codex/skills/photo-postcard/SKILL.md`. Claude does not create, edit or delete
  postcard art, `.codex/`, or the postcard images (e.g. the warbler,
  `assets/images/homepage/dots/wabler.png`). Exception: the user asked Claude to rename and
  move the warbler there (2026-10-21; it was "ChatGPT Image Oct 20, 2026, 05_43_20 PM.png"
  in the repo root). The image itself was not changed.
- **Top bar on every page** (said 2026-10-21): **three floating segments** (user, 2026-10-24;
  idea from https://1in8b.life/en/'s floating header): (1) the site bar "Ronghao Zhang
  Photography" + page links Home · Traces · Avians · Contact Me (user, 2026-10-25), (2) the language switch, unchanged,
  (3) the light/dark switch. The header itself is transparent and lets clicks through, so the
  page shows in the gaps as it scrolls underneath; each segment has the floating surface
  (`--float-bg/-border/-shadow` in `_tokens.scss`: a little lighter than the page, slightly
  see-through with a blur, thin border, soft shadow). The page links are pill options styled
  like the language switch, the current page filled in (user: no "|" dividers). The name stays
  in English on every page. "Contact Me" jumps to the footer (`#contact`, which has the email;
  no contact page yet). Under 860 px the links fold into a menu button in the site bar
  (`site-menu.js`, a solid floating panel); under 520 px "Photography" is dropped; under 400 px
  the name gets smaller (and cuts off with "…" rather than overlap, ~320 px). `--header-h` is
  4rem. The segments' outer edges are the content column's, so the pictures still line up with
  them. `html { scrollbar-gutter: stable }` keeps the page from shaking sideways when a
  scrollbar would come and go (user saw the first segment shake after switching language).
  **Smooth page changes** (user, 2026-10-24: "do not abruptly change"): cross-document view
  transitions (`_page-transitions.scss`): the filled pill (`.site-nav__pill`, a separate element
  in the current link) slides to the new page's link in 0.45 s, the labels' colours cross-fade
  above it (their layers raised with z-index), and the page cross-fades in 0.35 s. Browsers
  without it (Firefox) get the pill sliding before the page opens (`page-transitions.js`).
  Reduced motion: no animation.
- **Three languages: English, 简体中文, 繁體中文** (user, 2026-10-23; first a two-way
  English/Chinese button). A pill switch in the top bar, left of the theme switch: EN | 简 | 繁,
  the current one filled in. It switches all page text, not the URL. How it works:
  - `_includes/lang-init.html` sets `data-lang` and `lang` on `<html>` (`en`, `zh-Hans`,
    `zh-Hant`) before the first paint: the saved choice, else the browser language (zh-TW/HK/MO
    or zh-Hant → Traditional, other Chinese → Simplified, else English). A saved `zh` from the old
    switch counts as Simplified. It also holds the font list and `window.siteLang.apply()`.
  - `assets/js/lang-switch.js` handles clicks, saves the choice (localStorage `lang`), sets
    aria-pressed and fires a `langchange` event; scripts that measure text (scroll-words.js,
    dot-morph.js, line-moves.js) listen for it.
  - Every text exists in all three: `{% include t.html en=… zh=… zh_hant=… %}` writes three
    spans and `_sass/base/_language.scss` hides the others. In the data: `text_zh` (Simplified)
    and `text_zh_hant` (Traditional) next to `text`, the same for `title`; `location_zh` /
    `location_zh_hant` in `_config.yml`. Traditional uses Taiwan forms (裡, 佔位).
  - **Fonts** (user, 2026-10-23): English EB Garamond for the story lines (was Literata);
    Simplified 霞鹜文楷 (LXGW WenKai, `lxgw-wenkai-webfont@1.7.0`); Traditional 汇文明朝体
    (Huiwen Mincho, `@chinese-fonts/hwmct@3.0.0`, public domain), font pieces from jsDelivr
    (font lists copied locally, see below). Every
    font stack in `_tokens.scss` has `var(--font-cjk)` after its Latin font, set per language in
    `_language.scss`, so Chinese anywhere on the page uses that script's font. Each Chinese font's
    CSS (100–150 KB) loads only once its language is chosen; the fonts come in small pieces, so
    only the characters on the page download. Both cover every character the site uses (checked).
    Both have one upright weight, so Chinese story lines are regular weight and
    `font-synthesis: none` stops fake bold/italic Chinese.
  - **No stand-in fonts on page changes** (user, 2026-10-25: going Home → Places, the text first
    showed in a Times-like font, then switched). The Latin fonts (EB Garamond, Hanken Grotesk,
    Bricolage Grotesque; Latin and Latin-extended pieces, SIL OFL, licences beside them) are
    served from `assets/fonts/` with `font-display: block` (`_sass/base/_fonts.scss`), not from
    Google Fonts; Garamond and Hanken are preloaded in `default.html`. The Chinese font lists are
    local copies with `font-display: block` (`assets/fonts/lxgw-wenkai.css`,
    `huiwen-mincho.css`, made by `scripts/make_cjk_font_css.py`; the pieces still come from
    jsDelivr), loaded render-blocking by lang-init.html. Checked: on the new page every font is
    ready from the first frame, and nothing is drawn in a system font.
  - Chinese story lines (`:lang(zh)`, both scripts) light up per character and have a width
    limit in em (19ch fits only ~9 Chinese characters).
  - Story lines in English are a bit bold (user, 2026-10-23): weight 500.
  - **Switch labels in their own fonts on every page** (user, 2026-10-23): EN in EB Garamond, 简
    in 霞鹜文楷, 繁 in 汇文明朝体. Only the one web-font piece holding each character is loaded
    (`Lang Label Hans` / `Lang Label Hant` in `_lang-switch.scss`, ~50 KB each, the same files the
    full fonts use). If the font packages are updated, those piece file names change too.
  - **EB Garamond for "Ronghao Zhang" in the top bar and "PHOTOGRAPHY" under the signature**
    (user, 2026-10-23), weight 600, a little larger than before because Garamond runs small.
  - More space between lines (user, 2026-10-23): line height 1.45 for English (was 1.25), 1.7
    for Chinese.
  - **The homepage title is not translated** (user, 2026-10-23): the signed "Ronghao Zhang" and
    "PHOTOGRAPHY" under it stay in English on both Chinese pages.
- **Light and dark mode across the whole site, easy to switch** (said 2026-10-21).
  The switch lives in the top bar, so it is one click from any page. Every page and
  component must work in both modes. Already in the skeleton: `theme-init.html` applies the
  visitor's saved choice (or their system setting) before the first paint, so there's no flash
  of the wrong mode; `site-header.html` holds the switch.
- **Dark mode background: #282828** (user, 2026-10-22), a neutral dark grey, the same as the
  dark pictures' backdrop. Dark text and line colours were made neutral to match
  (`dark-palette` in `_sass/base/_tokens.scss`); `PAGE_DARK` in `dot-morph.js` must match it.
- **Reference site: Ariel Mu's sketchbook** (shared 2026-10-21), https://aarice.github.io/ArielMu/.
  The user likes all of its homepage:
  1. the drawing you can play with (hover a hand-drawn tree: it sways and a poem's letters
     fall like leaves and pile up),
  2. navigation labels hanging inside the drawing and swinging with it,
  3. the letter-by-letter typing intro,
  4. the calm hand-drawn sketchbook look (off-white, grey text, typewriter font),
  5. a single screen with no scrolling.
  Its Experience page (https://aarice.github.io/ArielMu/experience.html) was also shared:
  big typewriter page title ending in a period; a pale world map with softly pulsing place
  markers (hover one: all pause, its name shows); a dated list where hovering one item dims
  the rest, and on phones the item at the reading line lights up like song lyrics.
  Open: this pulls against the scroll-down homepage sections and tech-product motion below,
  and the typewriter font was part of the earlier dropped postcard design. Ask before
  resolving either.
- **Reference site: point.cloud** (shared 2026-10-21, "understand the point cloud style"),
  https://point.cloud/. One cloud of ~30,000 dots (three.js + the ParticleSaga library) sits
  fixed beside the text. Each scrolling section has its own 3D shape (head, drone, glasses,
  car, chip) in one colour. When a section's heading enters the screen, the dots fly from the
  old shape to the new one, in a random order so it ripples, and the cloud changes colour.
  Dots shrink with distance, so shapes read as 3D. Loose dots drift across the background
  like dust. Dark ground, thin light sans headlines, text on the left, left-side section menu
  with a line marking the current section. Whether and how to use it: ask.
- **Preferred dot style: Datacurve** (https://datacurve.ai/, user's screenshots 2026-10-21).
  The user likes it better than point.cloud. The user's three must-haves:
  1. **Light background** (off-white), dots dark grey.
  2. **No loose dots scattered over the background**; dots only form the shapes.
  3. **The transition is tied to the scroll position, not played on a timer.** Every scroll
     position is one exact frame of the morph, scrolling back plays it backwards, and the
     visitor can stop halfway with the dots still between two shapes.
  Also seen in the screenshots (not stated as must-haves): shapes are whole scenes in dense
  stippling (people, a cathedral, a boat, a telescope); between shapes the dots loosen into a
  soft band or cloud; short serif lines on the right whose words turn from pale grey to black
  as you scroll; a small top bar (logo left, links right).
  - **Prototype built 2026-10-21, moved to the homepage 2026-10-22 (not committed):** files `assets/js/dot-shapes.js` (four test shapes Claude drew in code: camera, bird on a
    branch, mountains over a lake, tree), `assets/js/dot-morph.js` (stippling, scroll-linked
    morph, WebGL drawing, follows light/dark mode), `assets/js/scroll-words.js` (words darken
    with scroll), `_sass/components/_dot-stage.scss`. Not linked from the site. Waiting for
    the user's feedback on the motion.
  - Feedback: the dots should be **sparser during the transition** (2026-10-21); the
    halfway spread was more than doubled (`LOOSEN` 0.32 → 0.75 in `dot-morph.js`).
  - The user swapped the bird test shape for **the warbler illustration** (2026-10-21).
    `dot-morph.js` now also takes `{ image: url }` shapes: the picture fills the hidden
    canvas, paper colour is read from its edges and gets no dots, and strong colours count
    as ink. The warbler file is only read, never changed.
  - Images used as dot shapes live in `assets/images/homepage/dots/` (user, 2026-10-21).
  - **Colour, round dots, larger shapes** (user, 2026-10-21): every dot takes the original
    colour of the spot it came from, and shifts from its old colour to its new one during the
    change. Dots are round with a soft edge (2.4 px, 2 px on phones). Every shape is scaled to
    fill the same box (its subject, not its paper), about 5%–52% of the screen width on
    desktop. In dark mode colours get 30% white mixed in so dark inks stay visible. The three
    drawn test shapes were repainted in colour.
  - **First step: the portrait, on the left** (user, 2026-10-22), replacing the drawn camera
    (its code was removed): `portrait_bright.png` / `portrait_dark.png` in
    `assets/images/homepage/dots/`, the photographer with a long lens on a tripod. In light mode
    the white jacket and lens are close to the paper colour, so they come out lighter and
    sparser than the dark parts.
  - **Title signed by hand on load** (user, 2026-10-22): "Ronghao Zhang" in Mrs Saint Delafield
    (a signature-style script; font + OFL licence in `scripts/fonts/`), larger; "PHOTOGRAPHY"
    below it, small, spaced capitals, fading in once the name is done. The name is written the
    way a hand writes it (user asked for this after a first, letter-by-letter outline version
    looked jerky): `scripts/make_signature.py` traces the centre line of the handwriting,
    walks it like a pen (left to right, straight on at crossings, closing bowls first, running
    back over drawn lines instead of lifting), and writes `_includes/home/signature.svg`: the
    letters under a mask of ~380 small areas, each the ink around one short stretch of the pen's
    path (ink nearly as close to an earlier stretch goes with that one, SHARE), fading in at
    one steady speed over 3 s with a short pen lift between the words. The Z is one stroke
    starting at its inner hook; the R goes curl, long loop down and back up, bowl, stem, leg
    (user corrected both, 2026-10-22; areas replaced round brushes, which let a bit of the
    R's bowl show before the pen reached it; the pen may run back up a drawn line when that is much
    straighter than turning, RETRACE_PENALTY, and judges direction over 30 px, TANGENT). Rerun the script after changing text, font or
    timing (`--preview out.png` saves the pen path); it needs fontTools, uharfbuzz, scipy,
    scikit-image and skan in the gallery env. Styles: `_sass/components/_signature.scss`.
    Screen readers get the plain text.
  - **Title slides out to the right** (user, 2026-10-23): scrolling from the first page, the
    title stays level and slides out past the right edge as the dots change into the warbler,
    on the same stretch of scroll; scrolling back brings it in. The title lives in the sticky
    canvas layer (`.dot-step--pinned` in `dot-story.html`), so the browser holds it level; the
    script (`assets/js/line-moves.js`) only moves it. A first version cancelled the
    scroll with a transform one frame late and made the text shake. `.dot-stage` has
    `overflow-x: clip` so the slide doesn't widen the page.
  - **The warbler line flies in from the left and sinks away down** (user, 2026-10-23): it
    comes in from the left edge while the title leaves to the right, its words lighting up as
    it lands; on the way to the moment it moves down to the bottom edge and fades out. Set in the
    story data (`enter: left`, `leave: down`; the title has `leave: right`): any line with
    `enter`/`leave` is held in the sticky layer like the title, its scroll step stays empty, and
    `scroll-words.js` lights it as if it were still in that step. Other lines scroll up as before.
  - **Dots fly in on load** (same request): while the name is signed, the portrait's dots fly in
    from a wide scatter over 2.8 s, starting in the page colour and settling into the picture's
    colours (pale → dark in light mode, dark → light in dark mode). `uIntro` in `dot-morph.js`.
    The name waits (paused, `.is-waiting`) until the portrait's dots are ready, so pen and dots
    start together (1.5 s safety limit). Turning a picture into dots blocks the page for
    150–300 ms, which made the signing stutter (user, 2026-10-22), so the other pictures are
    prepared only after the signing ends, one at a time with short breaks. Hidden band-copy
    dot slots are skipped on the GPU.
  - **Second step: the warbler, on the right, one picture per theme** (user, 2026-10-21):
    `wabler_bright.png` (ivory paper) in light mode, `wabler_dark.png` (charcoal) in dark mode,
    both in `assets/images/homepage/dots/` (`image` / `imageDark` in `dot-shapes.js`). Both load
    up front. Before that: briefly a 2 × 2 bird grid, then the owl alone; hawk/owl/phoebe and
    `wabler.png` stay in the folder unused. Picture files are never changed.
  - **No warbler pose animation** (user, 2026-10-22): moving the bird between three poses
    (wabler_1/_2/_3) was built and then dropped as too complicated. The warbler is the single
    `wabler_bright.png` / `wabler_dark.png`.
  - **Theme switch glides the dots** (user, 2026-10-21): every shape has a light and a dark dot
    set (the same set for drawn shapes); clicking the top-bar switch moves each dot from one set
    to the other over 0.9 s with the same ripple as the scroll change. Dark dots are paired with
    light dots along a Hilbert curve (`pairUp()`), so each dot only moves a short way and the
    bird stays recognisable mid-switch. Instant with reduced motion.
  - **Scroll changes travel in an arch** (user, 2026-10-21; the theme glide is "fantastic", leave
    it unchanged). On sideways moves the edge facing the destination leaves first, so the shape
    peels off as a stream; dots rise in an arch (ARCH 0.5 × distance, each dot a little
    different), the shape narrows 30% in flight, and the loose scatter is halved. Phones (no
    sideways move) keep the old ripple. The arch may briefly pass over the outgoing text.
  - **Fourth (last) step: the landscape, centred** (user, 2026-10-22; moved last 2026-10-23), replacing the
    drawn mountains: `landscape_bright.png` / `landscape_dark.png` in
    `assets/images/homepage/dots/` (`place: 'band'` in `dot-shapes.js`). **As wide as the top
    bar's content**, from the site name to the light/dark switch (user, 2026-10-23; was 85% of
    it; 2026-10-22: full screen width was a mistake). Its sides are ragged, so it is placed at
    95% of that width, measured across the 0.2nd–99.8th percentile of its dots, which puts the
    outermost dots on the top bar's edges (checked at 1440 and 1920 px). On short screens it gets
    narrower so its line still fits above it. **No twist on the landscape** (user, 2026-10-23:
    turned, its left side looked smaller than its right): the page-to-page twist eases out as
    the dots form it.
    **Low on the screen with its line centred across and centred in the space above it, well
    clear of the picture** (user, 2026-10-23; before that it sat at the bottom with the line at
    the top left, then briefly in the middle with the line right on top of it, which was too
    close). It rests with its caption ending 8% of the screen height above the bottom edge
    (`BAND_CAPTION_GAP`; user, 2026-10-25, with a screenshot: at 3% it sat too close to the
    bottom), so the picture's foot is ~16% up; at least 7% without a caption (`BAND_GAP`); dot-morph.js
    shares its top edge as `--band-top`, and the CSS centres the line in the space above that
    edge (`.dot-step--top`); if the line wouldn't fit above, the landscape moves down. **The line comes down from the top** (out from
    under the top bar) as the dots fall into the landscape (`enter: top`, line-moves.js). At the
    same time the moment's line ("one hundredth of a second…") sinks down and fades
    (`leave: down`; user, 2026-10-23: not up); it rises in from below (`enter: bottom`). Every
    story line is now held and moved this way, none scrolls with the page. On phones all lines
    rest in the same place, so there the old line leaves in the first half of each change and
    the new one arrives in the second half (on wider screens both move at once). Dots behind the line fade while they fall past it. Into the landscape the dots fall and
    build it from the ground up (FALL sag, ground dots first); out of it they rise, sky first.
    It gets 3× the dots (108000 desktop / 54000 phone) so it is as dense as the other shapes:
    shapes beside the text repeat each of their 36000 dots in 3 slots, and the repeats only show
    while the dots form the landscape.
  - **Landscape stronger in light mode** (user, 2026-10-22: pale mountains hard to see): in
    light mode only, landscape colours are deepened with a power curve (1.9), and band shapes
    place dots with a lower density curve (0.5 instead of 0.8) so pale areas get more dots.
    Other shapes and dark mode are unchanged.
  - **Third step: the moment, on the left** (user, 2026-10-22; moved before the landscape
    2026-10-23, so it went from the right to the left side), replacing the drawn test tree
    (the last hand-drawn shape; its code was removed, `dot-shapes.js` is now a list of pictures):
    `moment_bright.png` / `moment_dark.png`, graduates jumping in front of a stone building.
    Faces don't come through in dots; the user accepted that (the mood matters, not the faces).
    In dark mode the navy gowns are close to the background, so the figures are faint.
  - **No stand-in shape while pictures load** (user, 2026-10-22: the drawn tree flashed before
    the portrait on every refresh). Picture shapes stay empty until loaded; the canvas stays
    hidden until the first real dots, then fades in (0.6 s). Pictures load one at a time in
    story order, the current mode's version first, so the portrait does not wait for the
    others; a shape's first loaded version stands in for its other version until that arrives.
  - **1.5× the dots, no turn at rest** (user, 2026-10-22: the moment's figures were faint and
    faded toward the left in dark mode). 54000 dots desktop / 27000 phone (landscape 3× that),
    COVERAGE 1.65 so dots keep their size; side shapes use density curve 0.65 (more dots in
    subtle tones like navy gowns). The small left/right twist on each page stays (user likes
    it), but brightness no longer depends on the twist and dot size only slightly, so the far
    side doesn't fade. Pages sit a little in from the screen edges (offset ±0.37; right side
    2026-10-22, left side 2026-10-23), so the twist doesn't push them against the edge.
  - **All pictures 15% smaller** (user, 2026-10-22: "kinda large"): side pictures up to 40% of
    the screen width (was 47%) and 63% of its height; the landscape 85% of the content width.
    Dot size follows each picture's size on screen, so dots shrank with them and the density
    stayed the same. Dot data is
    sent to the graphics card in place, and only when a loaded picture is on screen.
  - **No seams during scroll changes** (user, 2026-10-22: some dots formed or left early and
    made the picture look stitched, most visible in dark mode). Each dot's start is now mostly
    random with only a gentle sweep in the direction of travel (SWEEP 0.25, was 0.7), so areas
    form and dissolve evenly instead of in blocks. The fade behind the landscape's text is a
    soft oval instead of a feathered rectangle. The light/dark glide is unchanged.
  - **No snapping** (user, 2026-10-22): the story has four main pages (portrait, warbler,
    moment, landscape). Snapping to them after each scroll gesture was tried and removed: the
    user prefers free scrolling, where every scroll position is its own frame.
  - Paper specks no longer get dots: a spot must also stand out on average with its neighbours
    4 px away, and any dot landing far outside the shape's box is moved onto the shape.
  - **Dot count halved** (user, 2026-10-21): 36000 on desktop, 18000 on phones. Dot size
    follows from COVERAGE, so dots got a little larger again (about 2.3 px on a laptop).
  - **The moment's line is set flush right**, ending under the light/dark switch, in all three
    languages (user, 2026-10-23: it sat too close to the picture; the picture stays put). It
    mirrors the warbler's line, which starts under the site name. Phones: left-aligned, full width.
  - **Captions under the pictures** (user, 2026-10-23), from `caption` in the story data: a line
    of classical poetry, then **one line "name · place · date" in the page's language only**
    (user, 2026-10-23: no mixed English/Chinese names):
    - English: `Cape May Warbler · Atlanta GA · 2026-05-05`
    - 简体: `栗颊林莺 · 美国佐治亚州亚特兰大 · 二零二六年五月五日` (繁體 the same in Traditional)
    The data holds `name` (optional) and `place` as { en, zh, zh_hant } and one `date`
    ("YYYY-MM-DD" or "YYYY-MM"); `_includes/date-zh.html` writes the date in Chinese numerals.
    - warbler: 山林多奇采，阳鸟吐清音。 / Cape May Warbler / Atlanta GA / 2026-05-05 (the user's
      example line; an earlier message said April 2026)
    - moment: 庾郎年最少，青草妒春袍。 / Atlanta GA / 2026-05 (day not given yet)
    - landscape: 昏旦变气候，山水含清晖。 / Dietrich River AK / 2025-09 (day not given yet; the user
      gave this place for the landscape illustration, it is not one of the Alaska photos ruled
      out below)
    **Poems in quotation marks; English page shows the user's translation** (user, 2026-10-23):
    English “…” with `poem_en`, 简 “…” with `poem`, 繁 「…」 (the Traditional convention) with
    `poem_zh_hant`; the page adds the marks. Translations (user's wording, grammar checked):
    - warbler: Forests brim with vibrant hues, while birds chasing the sun fill the air with song.
    - moment: Even the lush green grass of spring seems envious of their vibrant gowns.
    - landscape: Light shifts between dawn and dusk, yet hills and rivers retain their limpid glow.
    On the English page the poem wraps within the picture's width (`--pic-w`, set by
    dot-morph.js) in balanced lines. Claude added the closing 。 to the landscape poem for
    consistency. English pages show no Chinese now, so they don't load a Chinese font.
    dot-morph.js hangs each caption below its picture, 4% of the screen height (24–44 px; user
    2026-10-23: 14 px was too close). The landscape's foot is measured lower (0.1% of its dots,
    current theme's picture), because its forest runs dense to the bottom: in light mode the
    caption had touched the trees. from the picture's left edge, right
    edge or centre (`data-align`; centre on phones), its lines unwrapped, and fades it in while
    the picture holds still (`updateCaptions()`); the landscape leaves room under it for its
    caption. Styles: `_sass/components/_dot-caption.scss`.
  - **Pictures line up with the top bar** (user, 2026-10-23): on wide screens every picture
    after the portrait has its outer edge on the top bar's content edge: the warbler's right edge
    under the light/dark switch, the moment's left edge under the "R" of the site name (the
    landscape spans both, see above). **The gap to the text stays fixed** (user, 2026-10-23: it
    widened as the window got smaller): each picture fills the column between its edge and its
    text, less a gap of 8% of the window width (48–120 px, `sideGap()`), so it grows and shrinks
    with the window instead of the gap. Text widths are measured in the page (`measureText()`),
    so pictures are a little larger on the Chinese pages. The height cap is 63% of the screen;
    on a short window that stops the picture first, it is placed the gap away from its text and
    sits a little in from the column's edge. Edges are
    measured from the dots as they show at rest (with the page's twist and depth, light and dark
    picture blended by theme); checked to within 2 px at 1280, 1440 and 1920 px. The portrait
    keeps its own place (offset −0.37). Phones are unchanged.
  - **Sides alternate on wide screens** (user, 2026-10-21): portrait left, warbler right, moment
    left, landscape centred under its line; the text takes the other side, and the dots cross the screen as they
    change (`placeOf()` in `dot-morph.js`, `.dot-step:nth-child(even)` in `_dot-stage.scss`).
    Phones: shape on top, text below.
  - **Dots follow any background, light or dark**: a pixel gets dots by how much its colour
    differs from the picture's background (median edge colour). White feathers on a dark
    backdrop now get white dots naturally, so the earlier white-feather workaround
    (`enclosedLight()`) was removed. Colours are nudged towards the page's opposite (30% white
    in dark mode, 15% black in light mode) so near-background colours stay visible.
  - **Dot size follows the window size** (user, 2026-10-21): phones looked too dense, large
    screens too sparse. Dot diameter = sqrt(COVERAGE × shape box area on screen ÷ dot count),
    clamped, recalculated on resize. Then the user asked for slightly bigger dots, less
    sparse: COVERAGE 0.42 → 0.6. Then COVERAGE 1.1, clamp 1.4–7 CSS px (user, 2026-10-21): the
    user liked a denser look first seen when a narrowed window pushed dots to their minimum
    size, and found normal windows too sparse; 1.1 makes every window size that dense.
- **Motion: tech-product-site style** (said 2026-10-20). The user prefers the kind
  of scroll and hover effects seen on tech product launch pages over a quiet,
  static gallery. Details (which effects, how much) still to define.

### Content structure
<!-- How photos are organised: by trip, by subject, by place, by date... -->
<!-- How you want to add new photos (one YAML list, one file per photo, per trip...). -->
- **First version covers only two subjects: Birds and Landscape** (decided 2026-10-21).
  Other subjects (the old Wildlife, Traces and Portrait categories) are left out for now.
- Why the old categories were dropped: Birds overlapped Wildlife, and Landscape overlapped
  Traces. How to bring the other subjects back is undecided.

### Pages
<!-- Which pages exist and what each one shows. -->
- **Homepage: the dot story only** (user, 2026-10-31: "Remove these sections"). The page is
  the dot story and then the footer; it ends on the landscape and its poem.
  - **Subject sections removed** (2026-10-31). The first plan (user, 2026-10-21) put one section
    per subject (Birds, Landscape) below the story: a plate of 6–9 postcard icons of the most
    recent photos beside a paragraph. It never got photos or text and showed empty slots, a
    placeholder paragraph and "coming soon". Its files were deleted, never committed:
    `_includes/home/subject-section.html`, `_includes/photo-url.html`, `_sass/components/_subject.scss`,
    `_plate.scss`, `assets/js/plate-reveal.js`, `plate-caption.js`, `sections` in
    `_data/home.yml`, the empty `_data/photos.yml` and the `--paper` token. The top bar's Avians
    and Traces links take the place of "see all". Offered and not chosen: ending the story with
    two quiet links (Avians / Traces with counts) or a strip of the newest bird photos. Ask
    before bringing back homepage postcards (Codex's postcard art had been planned for them).
  - **A page link under every frame's line** (user, 2026-10-31: "one line direct the user to the
    specific page, if the page is not built yet, say it's coming soon"; grey, the highlight
    colour under the cursor). `go: { page, en, zh, zh_hant }` per story line in `_data/home.yml`;
    `_includes/home/story-go.html` writes "Explore Avians…" (探索鸟类…… / 探索鳥類……) as a link
    while that page exists, else "Moments · coming soon" (· 即将上线 / 即將上線), so a link
    appears by itself once the page is built. Colour `--ink-soft` → `--accent` on hover (the
    "coming soon" text too). **No arrows** (user, 2026-10-31: "I do not like the right arrows";
    an ellipsis instead). Pages: warbler → **Avians**, moment → **Moments** `/moments/` (soon;
    Claude's name, the user can rename it), landscape → **Traces · coming soon** (user,
    2026-10-31: "still building"; `soon: true` in its `go` keeps "coming soon" though the page
    exists; drop it to turn the line into a link). **None under the title**
    (user, 2026-10-31: "do not add About me · coming soon"). Line and link are wrapped in `.dot-step__line`, so they
    move and centre as one; the scrolling steps layer and the held lines let the pointer through
    (`pointer-events: none`), only the links take it. dot-morph.js measures the pair for the
    landscape's room above it and the dot fade behind its text. Checked at 1440 (EN light, 繁
    dark) and 390 px (简).
  - **Phone layout of the story, 2026-11-01** (user; wide screens unchanged, checked
    pixel-identical at 1440):
    - **Smaller dots**: 0.75× (`PHONE_DOT`), floor 1 px (`PHONE_DOT_MIN`; phone dots already
      sat near the 1.4 px minimum). Same dot count, so pictures read lighter and finer.
    - **Portrait stays where it was; the title sits just under it** (it was ~230 px lower).
    - **Every line close to its picture** (user, same day: "for the moments and the mountain,
      also make the text close to the dot image, at distance comparable to the wabler"): the
      moment's line just under its caption, the landscape's line just above the landscape (no
      longer centred in the space above), both the warbler's gap (24–44 px, 4% of the screen
      height, `captionGap()`); the title a little closer (no caption). dot-morph.js
      `sharePhoneFeet()` puts each picture's foot (or its caption's) on its line's box as
      `--pic-foot`; `_dot-stage.scss` sets the line under it.
    - **Warbler under its line, like the landscape**: `phonePlace: 'low'` in dot-shapes.js puts
      the picture under its text (dot-morph.js adds `.dot-step--phone-top` to the line, which
      goes to the top; the picture's top a caption gap below the line and its link, measured as
      `lineFoot`), and the change from the portrait **falls** into it, the change on to the
      moment **rises** out of it (`isLow()`: bands, and low shapes on phones). On phones the
      warbler line leaves **upward** under the top bar (line-moves.js), not down through the
      picture. Checked at 390 × 844, EN light and 繁 dark, at rest and mid-change.
  - **Open:** on wide screens, at the very bottom the footer pushes the pinned story up by its
    height, so the landscape's line slides under the top bar (phones are fine).
  - **The dot story is now the homepage opening** (user, 2026-10-22), replacing the disliked
    title-in-autofocus-brackets opening, whose files were deleted. Order: portrait with
    the title "Ronghao Zhang Photography" as its line, warbler, moment, landscape. Story lines live in `story` in `_data/home.yml`; markup in
    `_includes/home/dot-story.html`.
  - **Story sentence** (written with the user, 2026-10-23), one part per picture, and the
    picture order follows it:
    - warbler: "Most of photography, to me, is a rustle of wings sweeping over the forest
      canopy," / 摄影于我，是羽翼拂过林冠的一声轻响，
    - moment: "one hundredth of a second for a celebratory moment," (user, 2026-10-23; was
      "…of celebration,") / 是欢腾瞬间里的百分之一秒，
    - landscape: "or a long journey towards the parts unknown." / 亦是奔赴未知之境的迢迢长途。
    The `/lab/dot-morph/` demo page was deleted. Text sits in the screen half opposite the
    dots (`_dot-stage.scss`), so it never overlaps them at any width.
  - **Built 2026-10-21 (first draft, not committed):** `index.html`, `_includes/home/`,
    `_data/home.yml`, `_sass/`, `assets/js/`.
    The look (colours, fonts) is a first draft for the user to react
    to; impeccable's direction round has not been run yet, and there is no DESIGN.md.
  - **User feedback on the draft (2026-10-21):** hates the opening (title pulling into focus
    inside autofocus brackets). No "latest frame" camera readout; it was removed. A new
    opening is to be chosen.

- **Traces page** (user, 2026-10-24, first called Places, then Experience; renamed **Traces**
  2026-10-25; first example, waiting for the user's feedback on the markers). **Still being
  built; no list for now** (user, 2026-10-31: "do not include the list so far"): `show_list` in
  places-map.html is false for Traces, so the page is title, count, continent bar, map, legend
  and credit; zoomed in, the map keeps the whole column (`.places--no-list`). The list's code is
  kept: set `show_list` true to bring it back. The notes below on rows describe it. A link
  "Traces / 足迹 / 足跡" in the top bar's site bar opens `/traces/` (`traces.html`; the old
  `/experience/` address is gone, nothing was published yet).
  Only the page was renamed: the map component keeps the name "places" (`_data/places.yml`,
  `_includes/places/`, `_places.scss`, `places-map.js`), since it holds the places. A big title, a count line, a **world** map (user chose world over North America;
  pale filled land with landform colours, see Map below), one pulsing accent-colour marker (dot 0.42rem, ring 2px, swelling to
  1.7× and fading, ~1.1rem across; user 2026-10-25: 3.4× then 2.2× spread too far, ring was too
  thin at 1.5px, then "make the dot smaller" on both pages: was 0.6rem with a 2.5px ring; dot and ring are
  both centred with translate(-50%, -50%), since fractional margins left the ring off-centre) per
  place, and a dated list of visits, newest first, in the caption format. Hover or tap a marker
  or a row: the rings pause, its label (name and dates) shows, the rest dims; on phones the row
  at the reading line is picked while scrolling. Idea from Ariel Mu's Experience page.
  - **Continent bar** (user, 2026-10-25, "1." of a list of changes, given in English): to the
    right of the title, a smaller bar: **World** (Claude added it, as the way
    back) + the 7 continents from `_data/continents.yml` (North America, South America, Europe,
    Africa, Asia, Oceania, Antarctica; names in three languages, Oceania rather than Australia).
    **Style** (user, 2026-10-25, second pass): on the title's line, sitting on its baseline (count
    under the title); plain words separated by dots (World · North America · …), no pill or
    outline; the chosen one in full ink with a line under it, and the line slides to the new
    word. Under 860 px the bar goes under the count and scrolls sideways. Picking a continent: the list fades out, the
    map **zooms to the continent** (viewBox glides 0.7 s to the continent's box, `data-view`
    from the script) and moves to the **left**, **other continents fade out** through an SVG mask
    (regions per continent from Natural Earth's country table, sea shared out to the nearest;
    overseas parts by location; Russia split at the Urals, 60°E), markers/routes/rows of other
    continents hide (`.is-off`, which beats every other opacity rule with `!important` and also
    sets `visibility: hidden`; user, 2026-10-29: on Avians the Atlanta dot stayed on South
    America, since the half see-through dot rule outweighed it), and the **list sits to the right** with only that continent's visits ("No
    places here yet." when none). Zoomed, map and list keep to the content column. **Antarctica**
    cross-fades to its own polar map (`_includes/places/antarctica-map.svg`, Lambert azimuthal
    equal-area; Equal Earth squashes it into a strip); markers can't be placed on it yet. The
    choice is kept in the address (`/experience/#europe`). Phones: map above the list, the bar
    scrolls sideways. Every place and route in `_data/places.yml` needs a `continent:`. Reduced
    motion: no glide.
  - **Routes in magenta, along the real roads** (user, 2026-10-25): a trip is drawn as a 1.25 px
    line in the accent colour (`--accent`, fireweed magenta), the same width at every map size,
    over the map and under the markers; it dims with the rest when a place is picked. **No dots
    at the stops, and the line follows the highways' bends** (user disliked the first version's
    straight lines and stop dots). `routes` in `_data/places.yml` lists the stops in travel order;
    `scripts/make_routes.py` traces the roads between them (Natural Earth 1:10m roads, public
    domain, ~50 MB, downloaded outside the repo; see the script) into the generated
    `_data/route_paths.yml`. Rerun it after changing a route; a route without a path is drawn
    straight. Stops off Natural Earth's roads get a short in-and-out stub (Talkeetna's spur road
    is missing). First route, one way: Seward → Anchorage → Talkeetna → Denali (park entrance) →
    Fairbanks → Atigun Pass, all AK (no date given): Seward, Parks, Elliott and Dalton highways.
    **No line from Talkeetna to Denali** (user, 2026-10-25): a stop with `gap_before: true` gets
    no line from the stop before it, so the route is drawn as separate stretches (Seward →
    Talkeetna, then Denali → Atigun Pass).
  - **Only Atlanta keeps a dot** (user, 2026-10-25). A place with `route: <id>` in
    `_data/places.yml` gets no marker; the route's line stands for it. Its row stays in the dated
    list, and hovering or tapping the row lights up that route while the rest dims. Dietrich
    River AK is on `alaska-2025`.
  - Data: `_data/places.yml` (`places` with rounded lat/lon, ~0.1°, never the exact spot;
    `visits` with place, date, optional subject). For now only the places from the homepage
    captions (Atlanta GA, Dietrich River AK). One marker per place: the user wants to see the
    markers before deciding between per-place and per-trip.
  - **Map: flat land, every part one landscape type, no overlaps, no dots** (user, 2026-10-25,
    in steps: Ariel Mu's flat map instead of dots, with low-saturation colour for mountains,
    grassland and rivers; "also forest?"; then "each part of this map is covered by one type of
    geography, no overlap", "the country border line stay on top", and "a better resource for
    all long rivers and their main branches"). Six types, each a soft colour (`--map-*` tokens,
    light and dark; user, 2026-10-25: a step darker in light mode and a step lighter in dark
    mode than first set, still low-saturation; ice stays near white in light mode), with a legend
    in three languages:
    **mountains** (from NOAA ETOPO elevation: high, or rugged for its height, after the
    UNEP-WCMC/Kapos mountain definition loosened for a 0.05° grid), **forest**, **grassland**
    (incl. savanna, scrub, Mediterranean), **desert**, **tundra** (all from the RESOLVE
    Ecoregions 2017 biomes) and **ice** (RESOLVE "Rock and Ice": Greenland). Priority ice >
    mountain > biome. Savanna-biome ecoregions named "woodland"/"forest", and the Southeast US
    conifer savannas, count as forest (RESOLVE files the area round Atlanta under savanna). These
    are natural landscape regions, not today's land use. On top: Natural Earth lakes (filled in the rivers' colour, `--map-river`,
    so they stand out like the rivers; user, 2026-10-25), then
    **rivers from HydroRIVERS** (every river draining ≥ 100,000 km², so long rivers and their
    main branches; ≥ 500,000 km² drawn heavier; none across ice; 0.7 / 1.2 px. User,
    2026-10-25: narrower and fainter rivers were tried, then "change it back": the request had
    meant the borders), then the **country borders,
    always the top layer**; a faint **coastline** in the border colour round all land (user,
    2026-10-25: liked it on Avians, "apply that in Traces"; 1.2 px there, since the blocks cover
    its inner half, 0.6 px on Avians); kept soft (user, 2026-10-25: "shallow"; `--map-border` #b6bdb4 light /
    #5e5e5a dark).
    How: `scripts/make_world_map.py` puts every spot on one grid cell (0.25 SVG units) with
    exactly one type, smooths it (5-cell majority, specks under 40 cells merged), and traces
    each type's outline, so neighbours share edges (a hairline of each block's own colour hides
    rounding slivers); Natural Earth 1:50m land clips them. Data, all downloaded outside the
    repo (see the script; ~800 MB): Natural Earth (public domain), NOAA ETOPO via ERDDAP (public
    domain), RESOLVE Ecoregions 2017 (CC BY 4.0), HydroRIVERS v1.0 (free; asks for a citation
    and a link to hydrosheds.org). **The credit line under the legend names all four; keep it.**
    The scratch folder holding the data can be wiped between sessions (it was on 2026-10-25);
    re-download with the script's commands. Elevation and biomes now run to the South Pole for
    the polar Antarctica map.
    Runs in ~20 s (Pillow fills the ecoregions; skimage took 9 min). Output
    `_includes/places/world-map.svg`, ~270 KB (~80 KB gzipped), Equal Earth projection, **Antarctica included** as the strip along
    the foot (user, 2026-10-29: "the world map misses the Antarctica area"; it was left out
    before, polar map only); it is in no continent's mask shape, so it fades when another
    continent is picked, and picking Antarctica still opens the polar map. **Framed to hold every piece of land, with the main land centred** (user, 2026-10-26: the
    map sat too far right, then "do not trim any land": a first fix cropped to the main land and
    cut 128 islands, Hawaiʻi, the Aleutians, Fiji, Samoa, Tonga, Vanuatu, French Polynesia…; all
    restored). `map_frame()`: centred on the middle of the polygons ≥ 5 SVG units²
    (`MAIN_LAND_AREA`, Antarctica aside), wide enough to reach the farthest land on each side, so some open ocean
    sits on the right (the continents lean east of 0° while the islands at ±180° sit evenly at
    both edges). viewBox −266.24 −131.23 579.43 263.66 (238.7 tall before Antarctica), the same for the plain map; checked: no
    land polygon falls outside it. **The map is wider than the text column** (user,
    2026-10-24): up to the whole window less its gutters (max 100rem); title, legend and list
    keep to the column. **Then a bit smaller** (user, 2026-10-31, Traces and Avians): in the
    world view, off phones, 85% of that space, centred, at most 85rem (1126 px at a 1440 window,
    was 1325; 1360 at 1920, was 1600); zoomed views and phones unchanged, and the map glides
    between the two sizes with the zoom (`.places-map` max-width transition). `assets/js/places-map.js` places markers and routes with the same
    projection and the SVG's viewBox; change both together.
  - Styles: `_sass/components/_places.scss`; tab: `.site-nav` in `_site-header.scss`.

- **Avians page** (user, 2026-10-25: "add another new page called Avians", then "exactly the
  design of Traces, just do not add landscape information to the map; each dot represents the
  place I observe the bird"). `/avians/` (`avians.html`), link "Avians / 鸟类 / 鳥類" in the top
  bar after Traces (Chinese name chosen by Claude). Same template as Traces
  (`_includes/places/places-map.html` with `page="avians"`; Traces passes `page="traces"`), same
  continent bar, zoom, list and markers, but:
  - data from `_data/avians.yml` (same fields as places.yml: `places` = where birds were
    observed, one dot each; `visits` = sightings, with `species` (an id in `_data/species.yml`:
    names in three languages + eBird code) and the photo's EXIF). **The Cape May Warbler record
    was deleted** (user, 2026-10-25). Now one sighting: **Carolina Wren, Atlanta GA, 2026-10-25
    09:00**, photo `IM8A1985-2.jpg` (Canon EOS R5, EF500mm f/4L IS II USM +1.4x III, 700 mm,
    f/5.6, 1/500 s, ISO 400; no GPS in the photo, place given by the user). Chinese names
    卡罗苇鹪鹩 / 卡羅葦鷦鷯 chosen by Claude;
  - **Chipping Sparrow** (2026-10-26): 3 photos, `bird-2026` 008–010 (exports IM8A1220, 1232,
    1238, 08:11:56–58), Atlanta GA, 1/3200 s ISO 3200; Chinese 棕顶雀鹀 / 棕頂雀鵐; eBird range
    `chispa` (all four seasons). Its data was already added by another session; this session
    checked it and added the range. Now **10 photos, 3 species**; sparrow cover = newest (010).
  - **`taken` is to the hundredth of a second** (EXIF SubsecTimeOriginal, e.g.
    "2026-10-25T08:11:58.52"): 009 and 010 share a second, so whole seconds left their order
    to chance. `add_sighting.py` writes it; existing entries were filled from the WebP copies'
    EXIF (they keep it; some original exports are no longer in bird-2026's root). The viewer
    shows whole seconds.
  - **Now 7 photos, all in `bird-2026`** (checked 2026-10-26): Eastern Bluebird 001–005
    (exports IM8A1015, 1051, 1069, 1081-2, 1103) and Carolina Wren 006–007 (IM8A1966, IM8A1985).
    Exports are matched to web copies by EXIF time to the hundredth of a second (the WebP copies
    keep their EXIF). 007 is the same frame as the old test export IM8A1985-2.jpg, so the wren's
    entry points to 007 (no duplicate); its local thumbnail was deleted, and nothing on Avians
    uses `local-photos/` now.
  - **Eastern Bluebird** added 2026-10-26: 3 photos already in `bird-2026` (001–003, exports
    IM8A1015 / 1051 / 1069 matched by time taken, 08:00:40–56), Atlanta GA, 700 mm f/5.6
    1/2000 s ISO 1600; Chinese 东蓝鸲 / 東藍鴝 (Claude's choice); eBird range `easblu` (all four
    seasons). Each sighting row is **one photo**: Avians' count line reads "1 place · 2 species ·
    7 photos" (种鸟 / 张照片).
  - **2026-10-26: four more in `bird-2026`** (cropped by Claude at the user's request, "make the
    bird feather look more clean"): bluebird 004 (IM8A1081-2) and 005 (IM8A1103, take-off,
    portrait), Carolina Wren 006 (IM8A1966) and 007 (IM8A1985), all Atlanta GA, added with
    `add_sighting.py --web`. The wren row that used the local `IM8A1985-2.jpg` now points to
    007 (same moment, 09:00:05; export IM8A1985.jpg), so every Avians photo is in the image repo.
  - **2026-10-26: Chipping Sparrow** (new species; ID by Claude, confirmed by the user): 008
    (IM8A1220, calling, full frame), 009 (IM8A1232), 010 (IM8A1238), Atlanta GA, 08:11:56–58,
    700 mm f/5.6 1/3200 s ISO 3200. Chinese 棕顶雀鹀 / 棕頂雀鵐 (Claude's choice), eBird `chispa`;
    range map added (all four seasons). Count now "1 place · 3
    species · 10 photos". No `cover:` set, so its card and stack show the newest (010). Rows sort newest first by **`taken`** (date and time to the
    second; several photos a day); `date` stays for display. (Previews: see the card notes above.)
  - **2026-10-27: House Finch + Northern Cardinal** (new species; IDs by Claude: finch from the
    plain face and curved bill, not Purple Finch). Cropped by Claude "as a senior photographer"
    (user): 011 House Finch (IM8A1444, wings open, 4:3, room ahead), cardinals 012 (IM8A1677,
    singing male), 013 (IM8A1752, feeding in the cone), 014 (IM8A1842, male, blue sky), all 4:3,
    and 015 (IM8A1849, female, 3:2, along the branch); Atlanta GA, 08:20–08:43. The pine-needle
    and ISO 3200 frames came out over the 1.5 MB budget at quality 82, so their large copies
    were saved at the highest quality that fits (013 q80, 014 q76, 015 q64; checked at 100 %:
    feathers clean). Chinese 家朱雀 and 主红雀 / 主紅雀 (Claude's choice), eBird `houfin`, `norcar`;
    **range maps added 2026-10-27** (user: "add the location information"; both are eBird
    "resident", so year-round only). **Cardinal cover = 012**
    (Claude's pick; the four cardinals stack, female included). Count "1 place · 5 species · 15
    photos".
  - **2026-10-29: Downy Woodpecker + Eastern Phoebe** (new species; web copies and names made
    by the user in `bird-2026`, IDs checked by Claude: male downy from the short bill and red nape;
    phoebe from the dark cap, no wing bars, long tail): 20261017-001 woodpecker (IM8A0718),
    -002 and -003 phoebe (IM8A0775, IM8A0777, same second, 08:05:27.51 / .61), Atlanta GA,
    EF500mm f/4 at 500 mm, ISO 3200; exports matched to web copies by EXIF time. Chinese 绒啄木鸟 /
    絨啄木鳥 and 灰胸长尾霸鹟 / 灰胸長尾霸鶲 (Claude's choice), eBird `dowwoo` (year-round) and
    `easpho` (all four seasons), ranges added. No `cover:`, so the newest shows. Count "1 place ·
    7 species · 18 photos".
  - **2026-10-30: six photos removed, woodpecker replaced** (user deleted them from bird-2026
    `large/`; Claude removed the matching `thumb/` copies and their rows in avians.yml): bluebird
    001, 004, 005, sparrow 009, cardinals 013, 015. 20261017-001 woodpecker re-exported from the
    user's new edit of IM8A0718 (same name, large q70 1.54 MB; the user asked to overwrite it).
    Count "1 place · 7 species · 12 photos".
  - **Cards list every bird seen, not only photographed ones** (user, 2026-10-30: "a list of all
    the birds I have seen, but some do not have photos"). A row in avians.yml **without `photo`**
    is a sighting with no photo (place, species, date, `taken` = the date or date + time): it
    gets a card and its dot; its card shows a dashed **"No photo yet"** frame (暂无照片 / 暫無照片)
    the photo's size. **Photo-less cards come after every card with a photo** (user,
    2026-10-31; `card_order` in places-map.html), each group newest sighting first. The gallery, its sidebar and the "N photos" count use only rows with a
    photo (`photo_visits` in places-map.html); the species count includes every bird. Photo-less
    birds so far: **American Goldfinch**, Atlanta GA, 2026-10-25 (user, 2026-10-31; also seen at Murphey Candler Park on 2026-10-17, added 2026-11-04; Chinese
    北美金翅雀, Claude's choice; eBird `amegfi`, all four seasons, range added); **Grey Catbird**,
    Atlanta GA, 2026-10-17 (user, 2026-10-31; the user's spelling, eBird says "Gray"; Chinese
    灰嘲鸫 / 灰嘲鶇, Claude's choice; eBird `grycat`, all four seasons, range added; run the
    script with `/opt/miniconda3/envs/gallery/bin/python`, the system Python has no numpy). Count "1 place · 9 species · 12 photos".
  - **A card's photo jumps to the gallery** (user, 2026-10-30: "when click on that thumbnail
    photo, go directly to the Gallery, at that position"): the photo is a link to its tile
    (`#photo-<newest photo of the stack>`, the tile's id); gallery-filter.js scrolls the tile to
    the middle of the window, clears sidebar filters first if they hide it (another continent's
    tile: the species' first tile in view), focuses it and outlines it in the accent for ~2 s
    (`.is-flash`). It does not open the viewer. Checked in headless Chrome at 1440 (world row
    and zoomed list) and 390 px.
  - **Compact framed cards** (user, 2026-10-31: "the bird card is still too large… thumbnail
    really small and to the right of the text, each bird card should have an edge"). **This
    replaces the card sizes in the notes above** (10rem preview, world-view tiles with a 3:2
    photo on top, three cards filling the zoomed map's height): every view now uses one card:
    name (1.1rem), "Last seen", date · place on the left, the thumbnail on the right,
    a 1px `--line` border with 0.6rem corners, cards 0.6rem apart (no rules between them), line
    height 1.3 in all languages; the card in focus gets a firmer border. World view: one row of
    cards scrolling sideways (25.5rem, see below); zoomed: the cards stack and scroll inside the
    map column's height; phones: full-width cards. Styles in `_places.scss`; checked at 1440
    (world, zoomed) and 390 px.
  - **The thumbnail fills the card's right end, top to bottom** (user, 2026-10-31: "the photo
    should take entire height of the bird card. the left edge should be a straight line"):
    6.25rem wide, square corners, no padding on that side; the card (`overflow: hidden`) clips
    its right corners to the card's round ones. The text's padding sets the card's height; the
    photo is laid over its slot (absolute) so it never adds height. "No photo yet" fills the
    same slot on a faint tint (no dashed frame). The link's focus ring sits inside the card.
  - **No image on the bird cards; stickers removed** (user, 2026-11-04: "for the same reason,
    let's remove all the bird stickers from the website", then "put nothing on the card, do not
    show any image"). **This replaces the sticker, cover-photo and "No photo yet" slot in the
    notes below**: a card is text only (name + camera, scientific name, morphology, IUCN, Last
    seen, date · place), one column, padding on both sides; birds with photos reach them through
    the camera by the name. World-row cards kept 25.5rem. Reason: the stickers are AI drawings
    made from other people's photos, mostly under non-commercial or all-rights-reserved terms
    (see the reference-photo check below). Deleted: `assets/images/stickers/` (86 stickers +
    LICENSE.md), the sticker credit (PolyForm Shield notice, Blue Jay / Bald Eagle photo credits),
    the `sticker_*` fields, the sticker and photo-slot styles. `scripts/fetch_stickers.py` became
    **`scripts/fetch_bird_facts.py`**: it only writes `_data/bird_facts.yml` (the library's data,
    MIT; measurements AVONET). Rerun it after adding a species; "sticker fetched" in older notes
    means the facts now. Don't bring stickers or card images back without asking. Checked at
    1440 (world, North America) and 390 px (繁 dark): no images, no sideways page scroll, the
    Sensitive pill clear of the text.
  - **The bird's name links to All About Birds** (user, 2026-11-04: "add a link to
    https://www.allaboutbirds.org/ for each bird… .../guide/Stellers_Jay/overview"), in a new tab;
    under the cursor it takes the accent with a thin underline (`.visit__guide`). The page name is
    the English name with apostrophes dropped and spaces as underscores; `allaboutbirds:` in
    species.yml where it differs (Gray_Catbird, Whimbrel and Cattle_Egret: the pages from before
    the splits, Leachs_Storm-Petrel), `none` for a bird with no page (it covers North America).
    allaboutbirds.org blocks scripts (Cloudflare 403), so the slugs were checked by web search,
    not fetched; check a new bird's link the same way.
  - **The resting card shows its range on wide screens too** (user, 2026-11-04: "when the bird
    card is in the center, it will show that distribution. do that also for the website mode").
    With no cursor on a card, places-map.js `restingCard()` picks the card under a line across the
    list: the middle of the world row or of the zoomed column, sliding to the start / end as the
    list nears them, so the first card is picked on load and the last at the end. Hovering a card
    or a dot wins; leaving goes back to the resting card. Phones keep "the card seen whole". The
    other cards dim as on phones. Checked at 1440 (world, North America) and 390 px.
  - **Stickers in place of the card thumbnails** (removed 2026-11-04, see above; user, 2026-10-31: "replace the thumbnail
    images in the bird card to the corresponding sticker"): Huashu's bird-sticker library, the
    user's fork https://github.com/ronghao-zhang-gallery/huashu-bird-sticker (upstream
    alchaincyf/huashu-bird-sticker; 11,064 species, AI illustrations, transparent with a white
    outline). The fork is 1.4 GB, over what Pages serves, so `scripts/fetch_stickers.py` copies
    only the site's species (matched by eBird code) to `assets/images/stickers/<species id>.webp`
    (360 px long edge, ~20 KB). **Rerun it after adding a species** (gallery env Python). The
    sticker sits in the photo's slot, whole (`object-fit: contain`, no tint), and grows a little
    on hover; birds with photos still link to their gallery tile. Photo-less birds show their
    sticker too (Claude's call; "No photo yet" remains only for a species with no sticker
    fetched, as does the cover photo for a photographed one). **Licence: PolyForm Shield 1.0.0**,
    free for a personal site, but not for a product competing with the licensor's bird app
    Mingji (a bird-watching / bird-ID / field-guide app, site or service), so keep the Avians
    page a personal photo record. It requires the Required Notice and the terms: kept in
    `assets/images/stickers/LICENSE.md` and in the Avians map credit ("bird stickers: …").
    The 34 photo-cutout stickers have other licences; the script flags them (none used yet).
    **Reference-photo check, 2026-11-04** (user asked whether the sticker author had permission,
    after public criticism of AI stickers): no sign the author asked photographers; the library
    relies on each reference photo's licence plus an opt-out ("email us, removed within 7
    days") and says itself that whether a drawing is bound by its photo's licence is unsettled.
    For the site's 86 species (upstream data/species.json `sticker.reference`): 19 open
    (CC0 / CC BY / CC BY-SA), 48 non-commercial or no-derivatives, 2 Macaulay Library terms
    (Anhinga, White-faced Ibis), 1 all rights reserved (Northern Hawk Owl), 16 not recorded;
    23 fall below the library's own quality bar (`meetsQualityBar: false`). Upstream v2.0
    (2026-11-03) made every sticker an AI drawing; the site's Blue Jay and Bald Eagle are still
    the older photo cutouts (credited). The page's credit does not yet say the stickers are AI
    illustrations; suggested to the user, not done.
  - **Scientific name under the common name** (user, 2026-10-31), in italics on every card in
    all three languages: `scientific:` in `_data/species.yml` (IOC names, the same as the
    sticker library; `fetch_stickers.py` prints it as Genus_species for a new bird). EB Garamond
    italic (Latin piece, `assets/fonts/eb-garamond-italic-latin.woff2`, same OFL) was added for
    it: without it the slant would be faked, and missing on the Chinese pages (`font-synthesis:
    none`). Style `.visit__sci` in `_places.scss`.
  - **Morphology line and IUCN bar on every card** (user, 2026-10-31: "a morphology line for each
    bird… and another line for protection: IUCN LC or what, make this as a discrete color bar"),
    under "Last seen" and date · place. Data: `_data/bird_facts.yml`, **generated** by
    `fetch_stickers.py` (rewritten each run) from the sticker library: mean weight (g), wing and
    tail (mm) from AVONET (CC BY 4.0, credited in the Avians credit line; body length is in the
    library for only 3 of 9 birds, so it was left out to keep cards alike), and the IUCN category
    via Wikidata. Line: "Weight 19 g · Wing 59 mm · Tail 51 mm" / 体重 · 翼长 · 尾长, breaking only
    at the dots. Bar: "IUCN" label + seven cells EX EW CR EN VU NT LC (IUCN's order and colours,
    `_data/iucn.yml` with names in three languages, `_sass/components/_iucn.scss`); each cell a
    light wash of its colour, the bird's category filled in full; screen readers get "IUCN Red
    List: Least Concern". DD lights no cell. All 9 birds so far are LC.
  - **Card order and sizes, second pass** (user, 2026-10-31): morphology and IUCN come **before**
    "Last seen" (name, scientific name, morphology, IUCN, then Last seen and date · place).
    **IUCN colours toned down** ("a more low saturating color series"; IUCN's hues, softened, in
    `_iucn.scss`). **Bigger stickers** off phones: the card is a size container and the sticker
    slot is 40% of the card's width, 6.25–10rem (`cqi`); phones keep 6.25rem. **World row cards
    25.5rem** (morphology beside a 10rem sticker). Checked at 1126
    and 1440 px, light and dark.
  - **World row card style is settled at 25.5rem** (user, 2026-10-31). To fit map and cards in
    one window, two variants were tried and rejected that day: tall portrait cards with the map
    shrunk to the window's height ("I like the previous version"), then 37rem-wide cards with
    the text in two columns of three lines ("too narrow, change it back to this style"). Don't
    change the world card's shape again without asking.
  - **Savannah NWR checklist, 17 birds, no photos** (user, 2026-10-31): seen 2026-04-18 on
    Laurel Hill Wildlife Drive, Jasper County **SC** (the user wrote "South Carolina, GA"; the
    refuge straddles both states, the drive is on the SC side). New place `savannah-nwr`
    ("Savannah NWR SC", 32.2, −81.1). Birds: Common Gallinule, Black-necked Stilt, Killdeer,
    Spotted and Solitary Sandpiper, Forster's Tern, Wood Stork, Anhinga, Glossy and White-faced
    Ibis, Tricolored Heron, Snowy and Great Egret, Great Blue Heron ("Great Blur Heron" read as
    Blue), Osprey (card shows the user's subspecies *Pandion haliaetus carolinensis*),
    Red-winged Blackbird, Boat-tailed Grackle. Chinese: IOC Simplified, Traditional by character
    conversion (not Taiwan's different names). Stickers, facts and eBird ranges for all.
    **Black-necked Stilt has no IUCN in the library**: `iucn: LC` set by hand in species.yml
    (fetch_stickers.py now takes a hand-set `iucn:` over the library's). **Killdeer shows NT**
    from the library (Wikidata); not checked against the current Red List. Same-time rows keep
    their avians.yml order (the list is built time by time; Liquid's sort shuffled ties), so
    the day reads in the user's checklist order. Count "2 places · 26 species · 12 photos".
    **Page weight**: ranges are inline in avians.html; with 26 species the page is 1.26 MB
    (327 KB gzipped), mostly ranges.yml (944 KB). Loading ranges per species on hover would
    fix it if it grows much more.
  - **First Savannah NWR photos** (user, 2026-10-31: "2 are Boat-tail Grackle, 1 is Common
    Gallinule"): exports IM8A3070 and IM8A3191 (grackles), IM8A3342 (gallinule), all
    2026-04-18, RF100-400mm. Image-repo names use the place slug **`savannah-nwr-sc`** (from
    "Savannah NWR SC", as "Atlanta GA" → `atlanta-ga`): `20260418-001/-002_boat-tailed-grackle`,
    `20260418-003_common-gallinule`. Added with `add_sighting.py --web`; the two birds'
    photo-less rows were removed (the photo rows replace them). Count "2 places · 26 species ·
    15 photos". **Grackle cover = 001** (user, 2026-10-31: "use the other grackle photo as the
    cover"; before, no cover, so the newest, 002 in the reeds, showed).
    Then (user, 2026-10-31, "add Red-winged Blackbird"): IM8A3725, 09:35 that day →
    `20260418-004_red-winged-blackbird_2026_savannah-nwr-sc`, same steps; 16 photos.
  - **First 2025 photos, new image repo `bird-2025`** (user, 2026-10-31: chose a new repo over
    keeping them in bird-2026; place Murphey Candler Park): exports IM8A0095 (Eastern Bluebird),
    IM8A0229 and IM8A0277 (a juvenile hawk with a squirrel), all
    2025-12-27, RF200-800mm, dropped by the user in bird-2026's root. Claude made
    `../bird-2025/` (`git init`, bird-2026's README / CLAUDE.md / .gitignore / .gitattributes /
    .nojekyll with the year changed) for the user to publish from GitHub Desktop and turn Pages
    on; `_config.yml` `photo_hosts` gained `bird-2025`. Names
    `20251227-001_eastern-bluebird` / `-002`, `-003_red-tailed-hawk`, place slug
    `murphey-candler-park`. New species `red-tailed-hawk` (红尾鵟 / 紅尾鵟, *Buteo jamaicensis*,
    `rethaw`; sticker and facts fetched). **Red-tailed is final** (user, 2026-10-31): the user
    changed it to Red-shouldered Hawk, then back ("change back to red tailed hawk"); both
    renames happened before bird-2025 was ever committed. **Range map added 2026-11-01**
    (user's key; all four seasons, North America only). **Hawk cover = 002** (user, 2026-10-31: "use the other
    hawk image as the cover": the one on the ground with the squirrel, not the newest 003).
  - **Spruce Grouse, Alaska 2025** (user, 2026-11-01: "3 sprouse grouse photo", added to bird-2025):
    a male, 2025-09-20 15:31, Canon EOS RP + RF100-400mm, ISO 6400; exports named by the camera
    app (`2025-09-20_15-31-12_Canon-EOS-RP_…jpg`), kept as `export`. No GPS; the user said
    "North to Coldfoot, AK, but forget where the exact location is", so a new place
    `north-of-coldfoot` ("North of Coldfoot AK", 67.5, −150.1: a rough spot on the Dalton
    Highway, rounded like the rest). Files `20250920-001..003_spruce-grouse_2025_north-of-coldfoot`.
    001's large copy is 1.7 MB (noise at ISO 6400; q65 only saved 0.1 MB, so q70 kept).
    New species `spruce-grouse` (枞树镰翅鸡 / 樅樹鐮翅雞, *Canachites canadensis*, `sprgro`;
    sticker fetched; **`iucn: LC` by hand**, the library has none). Range map added (user's key,
    2026-11-01; year-round only). **Seen the same day, no photos** (user, 2026-11-01): **Willow
    Ptarmigan** (柳雷鸟 / 柳雷鳥, *Lagopus lagopus*, `wilpta`; range year-round, breeding and
    nonbreeding, reaching North America, Europe and Asia) and **Canada Jay** (灰噪鸦 / 灰噪鴉,
    *Perisoreus canadensis*, `gryjay`, the code from its Gray Jay days; year-round): photo-less
    rows: the jay at `north-of-coldfoot`, the ptarmigan at a new place `atigun-valley` ("Atigun
    River Valley AK", 阿蒂根河谷, 68.3, −149.4: the valley north of Atigun Pass; user, 2026-11-01,
    "Atigun Pass River Valley"); Chinese from the sticker library (IOC); stickers, facts (both
    LC) and ranges fetched. Count "5 places · 38 species · 22 photos" (after the bluebird and hawk
    it was "4 places · 35 species · 19 photos"). The species.yml key line must end in ":" with no
    comment after it: fetch_stickers.py reads it as plain text. The gallery's Year filter shows
    2026 and 2025 on its own.
  - **Canada Jay photo** (user, 2026-11-03: "I add a photo for canada jay, convert it"): export
    `2025-09-20_14-20-22_Canon-EOS-RP_…_ISO500.jpg`, taken before the grouse that day but given
    the next free number: `20250920-004_canada-jay_2025_north-of-coldfoot` (names never
    renumber; the page sorts by EXIF time). Its photo-less row was replaced by the photo row.
  - **2026-05-03 photos** (user, 2026-11-04: "5 new pictures to bird-2026, they belong to
    2026-05-03 birding trip", the Murphey Candler checklist): IM8A6907 American Redstart (male),
    IM8A6934 Eastern Wood-Pewee (orange lower mandible, no eye ring; Claude's ID), IM8A7065 /
    7071 / 7076 Cape May Warbler → `20260503-001..005_<bird>_2026_murphey-candler-park`. Two
    exports were under 3840 px (2343, 3790), so their large copies are full size, not
    enlarged. 003 was 2.1 MB at q70 (feather texture), over bird-2026's pre-commit limit
    (2 MB, `.git/hooks/pre-commit`; user, 2026-11-04: "causes git issue"), so it was re-encoded at
    **q62 (1.87 MB)** before it was ever committed. Keep every file under 2 MB: drop the
    quality for that one file until it fits.
  - **Kenai Peninsula, 2025-09-25** (user, 2026-11-04: "add steller's Jay photo", then "at Kenai
    Fjord National Park, add the white head bald eagle image"): two new places, `kenai-fjords`
    ("Kenai Fjords National Park AK", 59.9, −149.5, Resurrection Bay off Seward) and
    `cooper-landing` ("Cooper Landing AK", 60.5, −149.8), both `region: alaska`. Bald Eagle
    (two adults on the cliffs, 15:09) → `20250925-001_bald-eagle_2025_kenai-fjords`; Steller's
    Jay (two at a feeder, 20:45, portrait) → `20250925-002_stellers-jay_2025_cooper-landing`
    (made first as 001, renumbered before any commit so the day reads in time order). New
    species `bald-eagle` (白头海雕 / 白頭海鵰, `baleag`; sticker a photo cut-out by Paul Danese,
    CC BY-SA 4.0, credited by the page from bird_facts.yml) and `stellers-jay` (暗冠蓝鸦 /
    暗冠藍鴉, `stejay`). Ranges made (user's key, that run only) and checked with
    range_sheet.py: both match the expert maps, so no `range_approx`. Count "9 places · 83
    species · 30 photos". **American Crow at Kenai Fjords the same day, no photo** (user,
    2026-11-04): a photo-less row; the species was already on the site from Murphey Candler,
    so its card still says last seen there (2026-05-03), and hovering it also lights the Kenai
    dot. (Crows on the Kenai coast were Northwestern Crow until eBird lumped it in 2021.)
    **Leach's Storm Petrel there too, no photo** (user, 2026-11-04): new species
    `leachs-storm-petrel` (白腰叉尾海燕, the same in Traditional; *Hydrobates leucorhous*,
    `lcspet`; **VU** from the library, which matches the Red List since 2016); sticker, facts
    and range fetched. A seabird: ranges are drawn on land only, so its map shows just its
    nesting coasts; a `range_note` says so. Count "10 places · 86 species · 30 photos". The three
    checklist rows were replaced by the photo rows, **each eBird `count` moved onto the bird's
    first photo row** (make_trips.py sums counts per bird), so the trip still has 53 species;
    timed birds now lead that trip's list, as make_trips.py orders them.
    **Red-bellied Woodpecker seen there the same day, no photo** (user, 2026-10-31): a
    photo-less row (2025-12-27, `murphey-candler`); the species was already on the site from
    Fort Pulaski, so its card still says last seen 2026-04-19 there and hovering it lights both
    dots. The user also mentioned "3 more photos from bird-2025", but bird-2025 (local and on
    GitHub) held only the three already added; nothing new was found to add.
  - **Fort Pulaski NM checklist, 2026-04-19, no photos** (user, 2026-10-31): new place
    `fort-pulaski` ("Fort Pulaski NM GA", Chatham County, 32.0, −80.9; 普拉斯基堡国家纪念地). Birds,
    in the user's order: Black-bellied Plover (IOC English: Grey Plover), Semipalmated Plover,
    Hudsonian Whimbrel, Ruddy Turnstone, Laughing Gull, Western Cattle-Egret (the user's
    spelling), Brown Pelican (listed twice by the user, one row), Red-bellied Woodpecker, and
    Northern Cardinal (already on the site: its second place, so hovering its card lights both
    dots and pulses Atlanta, where it was seen last; checked). **Osprey** added to it later (user, 2026-11-04), so its card now says
    last seen at Fort Pulaski. Chinese: the sticker library's
    IOC Simplified, Traditional by character conversion, as for Savannah NWR. Count "3 places ·
    34 species · 16 photos".
    - **Codes after splits**: Hudsonian Whimbrel is eBird `whimbr` and Western Cattle-Egret
      `categr1` (the codes eBird Status & Trends 2023 has); the sticker library has whimbr3 and
      no code, so `fetch_stickers.py` now matches **by scientific name first** (genus and
      species), then by eBird code (the other 26 birds matched as before). S&T 2023 still maps
      the lumped Whimbrel worldwide, so `make_ranges.py` clips `whimbr` to 180°W–25°W
      (`LON_CLIP`): the Americas only.
    - **IUCN**: Laughing Gull and Hudsonian Whimbrel have none in the library; `iucn: LC` set by
      hand (the Red List still lumps the whimbrel in Numenius phaeopus, LC). **Black-bellied
      Plover shows VU and Ruddy Turnstone NT** from the library (Wikidata); not checked against
      the current Red List. Hudsonian Whimbrel and Western Cattle-Egret have **no
      measurements** (AVONET lumps them), so their cards have no morphology line.
    - **Bug fixed**: the screen-reader-only labels on the cards (camera link, IUCN) escaped the
      world row's sideways scroll and made the Avians page ~14,000 px wide (a trackpad could
      scroll it sideways); `.visit--bird` is now `position: relative`.
    - The Laughing Gull's sticker looked missing in the local preview: the running `jekyll
      serve` had copied it half-written (0 bytes into `_site/`). Fixed by touching the file;
      `fetch_stickers.py` now writes each sticker under a hidden `.part` name and renames it.
    - Page weight: ranges.yml is now 1.3 MB (inline in avians.html); loading ranges per card
      would fix it if it keeps growing.
  - **"Atlanta GA" split into two parks** (user, 2026-10-31): every sighting of 2026-10-17 is
    now `murphey-candler` ("Murphey Candler Park, Atlanta GA", 33.9, −84.3; 墨菲坎德勒公园), every
    one of 2026-10-25 `legacy-park` ("Legacy Park, Decatur GA", 33.8, −84.3; 迪凯特传承公园,
    Claude's translations). The user said "photos"; the two photo-less birds of those days (Grey
    Catbird 10-17, American Goldfinch 10-25) moved with them. The `atlanta` place was removed
    (nothing else used it). Notes above that say "Atlanta GA" for these birds predate this.
    **bird-2026 file names keep `atlanta-ga`** (published names never change; ask before
    renaming). The longer names put date · place on two lines on those cards. Count "4 places
    · 34 species · 16 photos".
  - **One dot for nearby places** (user, 2026-11-01: "merge the 2 dots for savannah, and merge
    the 2 dots for atlanta"): `dots:` in avians.yml groups places onto one map dot (`places`,
    `continent`, `lat`/`lon` about their middle): `atlanta-area` (Murphey Candler + Legacy Park,
    33.85, −84.3) and `savannah-area` (Savannah NWR + Fort Pulaski, 32.1, −81.0); later
    `kenai-area` (Kenai Fjords NP off Seward + Cooper Landing, 60.2, −149.65; user, 2026-11-04,
    "merge the seward dot and Kenai Fjord dot"). The places stay
    separate everywhere else (card date · place, gallery Place filter, search), and the count
    line still counts places (6). places-map.html draws one marker per dot (screen readers hear
    both names) and gives cards the dot's id (`_includes/places/dot-of.html`), so a card lights
    and pulses the shared dot. North of Coldfoot and Atigun River Valley keep their own dots.
  - **Murphey Candler Park checklist, 2026-05-03: 53 species, no photos** (user, 2026-11-04, from
    screenshots of the eBird checklist; the user wrote "Murphy"). 41 new birds, 12 already on
    the site (Gray Catbird = the site's `grey-catbird`). Rows in avians.yml in the checklist's
    order, each with **`count`** (how many were counted; new optional field, kept in trips.yml as
    `count:`, not shown on the page). Chinese: the sticker library's IOC Simplified, Traditional
    by character conversion (the library's zh-Hant uses Taiwan's own names, e.g. 簇山雀; not used).
    By hand: **Ruby-crowned Kinglet** `ebird: ruckin`, `iucn: LC` (the library has neither);
    Yellow-rumped Warbler keeps eBird's name (IOC: Myrtle Warbler). **Chimney Swift shows VU**
    (library / Wikidata). Stickers, facts and eBird ranges for all 41.
    **Blue Jay's sticker is a photo cutout** (Blake Ross, iNaturalist, CC BY), not PolyForm Shield:
    fetch_stickers.py now writes `sticker_by` / `sticker_license` / `sticker_url` to
    bird_facts.yml for any photo-cutout sticker, the Avians credit line names them ("Blue Jay
    sticker: photo by Blake Ross (CC BY)"), and stickers/LICENSE.md lists the exception.
    Count "7 places · 81 species · 23 photos"; 10 trips. **Page weight**: avians.html is now
    2.7 MB (660 KB gzipped), mostly the inline ranges (ranges.yml 2.1 MB): loading ranges per
    card on hover is the fix when wanted.
  - **Denali National Park checklist, 2025-09-22, no photo** (user, 2026-11-04): **Common Raven**
    (渡鸦 / 渡鴉, *Corvus corax*, `comrav`; sticker, facts (LC) and range fetched; year-round,
    reaching North America, Europe, Africa and Asia). New place `denali` ("Denali National Park
    AK", 美国阿拉斯加州德纳利国家公园, at the park entrance 63.7, −148.9 like Traces' Denali stop;
    `region: alaska`, so the Northern Hawk Owl shows under its dot too). Count "7 places · 40
    species"; 9 trips.
  - **Constitution Lakes checklist, 2026-06-14 08:00, no photos** (user, 2026-11-04, from an
    eBird screenshot): new place `constitution-lakes` ("Constitution Lakes, Atlanta GA", DeKalb
    County, 33.7, −84.3; 宪法湖公园, Claude's translation), **added to the `atlanta-area` dot**
    (Claude's call, like the other Atlanta parks; the dot moved to 33.8). Birds in the
    checklist's order with counts: Yellow-crowned Night Heron 2, Great Blue Heron 9, Belted
    Kingfisher 1, Northern Cardinal 1, Indigo Bunting 1. New species: Yellow-crowned Night Heron
    (黄冠夜鹭 / 黃冠夜鷺, `ycnher`; **`range_approx`**: patchy inland breeding, thin South
    American coasts) and Belted Kingfisher (白腹鱼狗 / 白腹魚狗, `belkin1`; matches the expert
    maps); both LC, stickers, facts and ranges fetched. Count "10 places · 85 species · 30
    photos"; 13 trips.
  - **Sensitive species: recorded only by state** (user, 2026-11-03): **Northern Hawk Owl**, seen
    2025-09-19 on the Alaska trip, no photo (**北方鹰鸮 / 北方鷹鴞**, the user's name, not IOC's
    猛鸮; *Surnia ulula*, `nohowl`; sticker, facts and range fetched). eBird lists it as sensitive (records shown only at ~400 km² grid level;
    observers asked to keep the spot private), so its sighting is at a new place **`alaska`** with
    `area: true`: no dot, no lat/lon, not counted in "N places". Places with **`region: alaska`**
    (North of Coldfoot, Atigun River Valley; add it to any new Alaska place) count as the owl's,
    so clicking any Alaska dot shows its card, and hovering the card lights them. Card and trip
    read "2025-09-19 · AK" (美国阿拉斯加州; user, 2026-11-04: "AK", was "Alaska"). `sensitive: true` in species.yml puts an
    accent-outlined **"Sensitive"** pill (敏感物种 / 敏感物種, a lock) **in the card's bottom-right
    corner** (user, 2026-11-03; it sat after the name, then after "date · Alaska"), over the
    sticker's foot on the page colour, its note opening above and to the left; and after the
    place in the checklist trip's heading (a trip at an `area` place). Hovering or
    focusing it shows "eBird sensitive species: the location is shown only by state, and the dots
    on the map are not where it was seen." (user, 2026-11-04: say the dots aren't its actual
    location; 观测地点只显示到州，地图上的点并非它的实际观测位置 / 繁 the same, with 牠). (`_includes/avians/sensitive.html`, `_sass/components/_sensitive.scss`).
    Never give a sensitive bird's exact place anywhere (data, comments, file names).
    **Its range is drawn year-round, with a note** (user, 2026-11-03: "the distribution … seems
    not correct"; chose this of three options): eBird S&T 2023 models only its *nonbreeding*
    range (Alaska, Canada to the Great Lakes, Fennoscandia to ~41°E) and nothing in Siberia.
    The owl is resident there, so `SEASON_AS` in make_ranges.py reads that season as resident
    (the southern fringe is really winter-only). `range_note` in species.yml ("eBird's data
    covers only part of its range: Siberia isn't shown.") shows over the map's lower left while
    the range does (`.range-note`, places-map.js `showRange()`); any species can have one. A full
    range would need BirdLife's maps (the user's data request is waiting on a waiver question).
    **Every range unlike the expert maps is marked** (user, 2026-11-04: "for the current and
    future birds that do not match, mark that the data is based on observation and may not be
    accurate"): `range_approx: true` in species.yml makes the same note over the map say "This
    range is based on eBird observations and may not be accurate." (此分布图基于 eBird
    观测记录，可能不准确。 / 此分布圖基於 eBird 觀測紀錄，可能不準確。); a `range_note` follows
    it (the owl keeps its Siberia line). Marked from Claude's comparison of all 81 maps
    (2026-11-04): Willow Ptarmigan, Northern Hawk Owl (Siberia missing); Ruddy Turnstone,
    Black-bellied and Semipalmated Plover, Hudsonian Whimbrel (Arctic breeding patchy, inland
    migration blobs); Tricolored Heron (inland patches); Osprey, Great Egret, Glossy Ibis,
    Western Cattle-Egret (patchy outside the Americas); Canada Goose, Mallard (introduced birds
    drawn as native). Not marked: thin coastal ranges (Boat-tailed Grackle, Brown Pelican,
    Laughing Gull, Forster's Tern), right when zoomed in. **For every new species**: after
    make_ranges.py, run `scripts/range_sheet.py <ids>` (pages in ../range-sheets/), compare
    with its Birds of the World map, and set `range_approx: true` if they differ; say so to the
    user. Count "6
    places · 39 species".
  - **Click a dot: its birds** (user, 2026-11-03: "when click on the place dot, show the birds
    that is observed at this location. If one bird is observed at multiple place, still show it
    here"; and "a button next to the search bar say return to all"). Clicking a dot (a grouped
    dot counts as one) keeps only the cards of birds seen there (`.is-place-off` on the rest;
    birds also seen elsewhere stay); the dot stays solid and 1.6× (`.is-chosen`). **Return to
    all** (返回全部), an accent-outlined pill beside the search box, shows while a dot is chosen;
    it, a second click on the same dot, or a continent change shows every bird again. Combines
    with the search and sort. places-map.js fires `placechoose` (dot id), bird-cards.js filters
    and answers `placechange`; a screen-reader status says "Birds seen at …". The click goes to
    the dot **nearest the pointer** (`nearestMarker()`): the markers' 1.75rem hit areas overlap
    for North of Coldfoot / Atigun River Valley, and the top one used to win. The gallery is not
    filtered (it has its own Place filter). Checked at 1440 (world, North America) and 390 px.
  - **Trip log** (user, 2026-11-03: "a documents on the backend stating each birding trip
    details, what birds do I see each time"): `_data/trips.yml`, **generated** by
    `scripts/make_trips.py` from avians.yml (avians.yml stays the one place sightings are
    entered), shown on the page as the Checklist (below). A trip is one day at one place, newest first; each lists its
    birds in the order seen (birds with no time of day after the timed ones), with Chinese and
    scientific names and how many photos are on the site. `add_sighting.py` reruns it; after
    editing avians.yml by hand, run it yourself. YAML, not Markdown: `.gitignore` ignores new
    `*.md` files, so a Markdown log would never reach GitHub. 7 trips so far.
  - **Checklist under the gallery** (user, 2026-11-03: "below the gallery, add a section named
    Checklist… ordered the data in trips.yml into a table"): `_includes/avians/checklist.html`,
    `_sass/components/_checklist.scss`. Heading "Checklists / 观鸟清单 / 觀鳥清單" (user, 2026-11-04:
    plural, was "Checklist"; Chinese Claude's choice, unchanged); one table, a group of rows per trip, newest first: a heading row (date · place, "6
    species · 9 photos" / 6 种鸟 · 9 张照片, "no photos" / 无照片) and then a row per bird in the
    order seen: number, name, scientific name (Garamond italic), photos on the site ("–" for
    none). trips.yml now carries `place_id` and each bird's `id`, so names come from species.yml
    and the places list in all three languages. The continent bar filters it like the gallery
    (places-map.js; the section hides when a continent has no trips). Phones: the scientific
    name goes under the bird's name. Not filtered by a clicked dot or the card search. Checked
    at 1440 (EN light, 简 dark, Europe empty) and 390 px (繁 dark).
    **Folded, in a box of a set height** (user, 2026-11-03: "make the checklist a certain height,
    and make each checklist a toggle list, only when click the '>', it shows the full bird
    list"): every trip starts closed (heading row only); its ">" button (with the date · place)
    opens or closes its birds, the ">" turning down. The table scrolls inside a box of at most
    `min(38rem, 70vh)` (the card list's height), the foot fading while more is below. **No
    header row over the list** (user, 2026-11-04: not needed while every trip is closed): each
    trip has its own column labels (Bird · Scientific name · Photos) under its heading, shown only
    while it is open. `assets/js/checklist.js` (folds on load, so without it every trip
    stays open). Checked at 1440 (EN light) and 390 px (简 dark).
  - **Camera by the name** (user, 2026-10-31): a bird with photos gets a small camera icon
    after its name on the card; clicking it goes to its cover photo's tile in the gallery (the
    same `data-gallery-jump` link as the sticker: scrolls the tile to the middle, outlines it,
    focuses it). Soft grey, the accent on hover/focus; screen readers: "Show its photos in the
    gallery". Photo-less birds get no camera. `.visit__head` / `.visit__camera` in `_places.scss`.
  - **Phones: one and a half cards, the whole one shows its range** (user, 2026-11-01: on a
    phone every card was listed down the page, the gallery took long to reach and the range was
    hard to see; "at most 1.5 bird cards, whenever 1 bird card can be seen completely, the map
    should [show] that bird's distribution", phones only). Under 760 px the card list scrolls
    inside its own box: every card is made as tall as the tallest in view (`--phone-card-h`) and
    the box 1.5 of them (`--phone-list-h`), so exactly one and a half show; cards snap to the
    top; the bottom edge fades while more are below. The first card wholly inside the box is
    picked (range on the map, firm edge, the rest dimmed; while none is whole mid-scroll, the
    last stays). Re-measured on resize, language, continent, fonts loading and card search /
    sort (bird-cards.js fires `cardschange`). places-map.js `phoneCards()`; this replaced the
    phones' "card at the reading line" pick on Avians (Traces' rows keep it). Wider screens
    unchanged. Checked at 390 × 844, world and North America.
  - **Card search and sort** (user, 2026-10-31: "a sort button (by time, by name) and a search
    textbox"): a bar above the cards: a search box (bird names in all three languages,
    scientific name, place names; case and accents ignored, every word must match) and a
    **Recent / A–Z** switch (最近 / 名称). Recent is the page's order; A–Z sorts by the name in
    the page's language (Chinese by its collation: pinyin for 简, re-sorted on a language
    switch). **Both keep birds with photos first** (the user's earlier rule). Search hides with
    `.is-search-off`, the continent bar with `hidden`, so they combine; "No birds match." when
    the search empties the list. Beside a zoomed map the list is shortened by the bar's height
    (`--card-tools-h`), so it still ends with the map column. Files: `assets/js/bird-cards.js`,
    `_sass/components/_card-tools.scss`, markup in places-map.html.
    **Bug fixed on the way**: lang-switch.js fires `langchange` on `window`, but places-map.js
    (continent underline, card-row fades) and gallery-filter.js (search placeholder) listened on
    `document`, so they never updated on a language switch; all now listen on `window`.
  - **EXIF** (user, 2026-10-25: date, camera, lens, focal length, F/#, ISO, exposure read from
    the photo; place by hand): `scripts/add_sighting.py PHOTO --place ID --species ID` reads it
    with Pillow and appends the sighting to avians.yml (text append, keeps the comments; refuses
    a photo already there, remaking only its thumbnail; prints GPS if the photo has it). For a
    photo already in the image repo add `--web <file name>`: it checks large/ and thumb/ exist in
    `../bird-<year>/`, stores that name as `photo` and the export as `export`, no local thumbnail. Only the
    file name is stored; the photo will live in the image repo. The EXIF is kept in the data
    but no longer shown on the card (user's card layout below). A forerunner of the planned
    `scripts/import_photos.py`;
  - **Cards, one per species** (user, 2026-10-25, with a screenshot): the species' name as the
    title (in place of the place); under it a small spaced label **"Last seen"** (最近观测 /
    最近觀測; user asked for "Last Recorded", Claude chose the birders' phrase), then one quiet
    line, the latest **date · place** (user, 2026-10-25: same line, dot between; first two lines) ("list the data and location": read as date); no date on top; on the right a small
    preview of the species' **newest photo only** (user, 2026-10-26: "just do the most recent
    preview and the preview can be larger"; first 1–3 photos): 4:3 thumbnail, 10rem wide (8rem
    beside the zoomed map, 7rem on phones). **World view: the cards are one row right under the map, scrolling left and right** (user,
    2026-10-27: scrolling the list up and down hid the map, so the range couldn't be seen while
    hovering): tiles 13.5rem wide, photo on top (3:2), name, "Last seen", date · place; the
    map column's parts join the stage grid (`display: contents`) so they can be ordered: map, then
    the range legend and credit **right above the cards** (user, 2026-10-27), then the row
    (**cards stay below the map**: user, 2026-10-31, tried them above it and went back, "I still
    like the bird cards to be placed below the world map"); edges fade where more tiles hide (`.has-more-left/-right`); **scrolling up / down over
    the row scrolls the page** (user, 2026-10-27: the page wouldn't scroll with the cursor on the
    cards; the wheel-to-sideways handler and the column's `overscroll-behavior: contain` were
    removed for the row, which now has `contain auto`); sideways swipes, Shift + wheel or the
    scroll bar move the row; scroll-snap. Zoomed into a continent and on phones the
    list is as below. **Otherwise the card list has a set height**
    (under the world map `min(38rem, 70vh)`, about four cards; **beside a zoomed map, from the map's
    top edge to the bottom of its legend and credit** (user, 2026-10-28; first the map alone,
    2026-10-26), via `--mapcol-h`, the map column's height from a ResizeObserver (the column has
    `align-self: start`, or the list's height fed back into its own measure), and **three cards fill it** (user, 2026-10-27: "this could hold 3 bird cards"):
    each card a third of `--map-h` (`--card-h`), photo as tall as the card, name 1.2rem, line
    height 1.3 in every language; on the Chinese pages date · place wraps at the dot (date and
    place never break inside); checked in all three languages at 1126, 1440 and 1920 px and scrolls inside it with a thin bar and a bottom fade while more cards are
    below (`.has-more`) as the birds add up (user, 2026-10-26); phones keep page scrolling. A card lists every place and
    continent the species was seen in (`data-places`, `data-continents`); hovering it highlights
    those dots. **Avians dots rest small, half see-through and still** (no pulse; 0.3rem across, smaller than
    Traces' 0.42rem: user, 2026-10-31, "make the dots for avians smaller"; the hit area is unchanged); **only hovering a bird's
    card wakes its dots**: all of that bird's places turn full colour, and **only the place where
    it was last seen moves** (user, 2026-10-25): 1.5×, then the dot itself beats between 1.5× and
    2× every 0.8 s (`data-last-place` on the card, `.is-latest` on the marker); **no outer ring on Avians**: user, 2026-10-25, "do not have the outer ring, the
    pop larger of the inner ring will be good"; `.is-card-picked` on the map; not on dot hover;
    Traces keeps its pulsing ring).
    **No place label pops up over the dots on Avians** (user, 2026-10-25; Traces
    keeps it); it is there for screen readers only. Thumbnails: `{photo_hosts[year]}/thumb/{photo}` once the image repo exists;
    until then `photo_local` (`/local-photos`, gitignored), which `add_sighting.py` fills with an
    800 px thumbnail (EXIF stripped), so previews show in a local preview only. A missing image
    hides itself;
  - **Gallery under the cards** (user, 2026-10-26: "below the bird cards, do a gallery of all
    photos"): `_includes/avians/gallery.html` + `_sass/components/_photo-gallery.scss`. Heading
    "Gallery / 相册 / 相簿"; every photo (each sighting row), newest first, as 3:2 thumbnail tiles
    in an auto-fill grid (min 15rem); hovering or focusing a tile lifts a caption (bird's name,
    date · place) over a soft shade, always shown on touch screens. The continent bar filters
    the tiles (`data-continent`) and hides the gallery when a continent has no photos. Card
    previews and tiles share `_includes/avians/photo.html` (image-repo URL, local fallback,
    hide on error); its size parameter is `variant` (`thumb` / `large`), never `size`: Liquid's
    `include.size` is the number of parameters and produced `…/bird-2026/3/…` URLs.
  - **Stacks in the gallery** (user, 2026-10-26: "similar items merged together, but can view
    individually in the full gallery"): photos of the **same bird, same day, same place** (one
    outing; Claude's reading of "similar") merge into one tile showing the newest photo, with two
    card edges peeking above it (fan up on hover) and a count badge; its cover is the photo with **`cover: true`** in
    avians.yml, else the newest, and the viewer opens on the cover. **The same cover is the
    bird card's preview.** Bluebird cover: **003** (facing out on the wire, head turned, warm
    background; user, 2026-10-26: disliked the flying 005 on the card and the dark-ground 004,
    Claude's first pick, in the gallery). **Three tiles per row** (user, 2026-10-26:
    larger photos; two under 900 px, one under 560 px); caption adds "N photos /
    N 张 / N 張". Single photos stay plain tiles. Each tile holds its photos as hidden
    `.photo-item`s (data + names in three languages); the viewer collects every item of the
    tiles in view and opens at the clicked tile's first photo, then steps through them one by
    one (now: wren ×2, bluebird ×5).
  - **Gallery sidebar: search, filter, sort** (user, 2026-10-27): `_includes/avians/
    gallery-sidebar.html`, `assets/js/gallery-filter.js`, `_sass/components/_gallery-side.scss`.
    Left of the photos, sticky under the top bar: search (matches bird and place names in all
    three languages; placeholder follows the language), Sort (Newest / Oldest / Name A–Z / Most
    photos; reorders the tiles, so the viewer follows), filters by Species and Place (photo
    counts beside each) and Year (only once there is more than one), "N photos" and Clear. A
    group with nothing ticked doesn't limit. Options are built from the photos, so new birds
    and places appear by themselves. Non-matching tiles get `.is-filtered-out` (the continent
    bar keeps using `hidden`; places-map.js fires `continentchange` so the count follows; the
    viewer skips both). "No photos match." when empty. **The gallery is as wide as the top bar**
    (user, 2026-10-27: "make the gallery similar width as the top bar"; earlier that day it was
    the world map's land width, via a `--land-span` that places-map.js set, now removed): the
    content column less its gutters, like the bird cards; checked: gallery, cards and top bar
    edges equal at 1100, 1440, 1920 and 2560 px. (The map's `data-land` attribute was removed, 2026-10-29.) Sidebar 14rem + three tiles. Under 900 px the sidebar sits above the photos,
    folded behind a "Filter & sort" button.
  - **Full-screen viewer** (user, 2026-10-26: click a gallery photo → full screen with ‹ ›,
    "like Apple Finder's gallery mode", a side bar with the EXIF data and a bottom preview bar):
    `_includes/avians/viewer.html`, `assets/js/photo-viewer.js` (loaded on avians.html only),
    `_sass/components/_photo-viewer.scss`. Top bar (bird's name, "2 / 4", info toggle, close);
    the photo's **large** copy as big as fits (absolutely placed in the stage with max-width /
    max-height, so portrait photos fit too: user, 2026-10-26, a tall bluebird showed only its
    top half when the image was a grid item), round ‹ › on its sides; **Information** sidebar
    (20rem: species, place, taken date + time, camera, lens, focal length, f-number, exposure,
    ISO; empty rows hidden; toggled by the ⓘ button or the I key, closed by default on phones,
    where it opens as a panel over the bottom); a strip of thumbnails at the bottom, the current
    one outlined, click to jump. ← → step (wrapping round), Esc closes, swipe on phones; focus
    stays inside and returns to the tile; the page behind doesn't scroll; neighbours' large
    copies are fetched ahead. It steps through the tiles in view (continent filter). **Follows
    the site theme, see-through** (user, 2026-10-26: "light mode should be light, dark mode
    should be dark", background "semi transparent", not black / white; it was always dark
    first): page colour at 78% with a 24px blur, so the page shows softly behind; sidebar,
    strip and ‹ › buttons a little firmer (`--v-*` in `_photo-viewer.scss`, built from the
    theme tokens). **The site's top bar stays on top of the viewer** (user, 2026-10-26: keep the
    original header, its fonts, and switch light/dark and language while viewing): the viewer
    starts below `--header-h`, `.site-header` gets z-index 101 while `.has-viewer`, Tab cycles
    through the top bar and the viewer, and the dialog is not `aria-modal`; the "Information"
    heading is EB Garamond like the site's other headings. Names / places / dates are copied
    from the tile's caption (all three languages). Tiles are buttons carrying `data-large`,
    `data-thumb`, `data-local` and the EXIF; URLs come from `_includes/avians/photo-src.html`
    (the one place that builds photo URLs; `photo.html` uses it). A photo with no large copy in
    the image repo (the Carolina Wren, not imported yet) shows its local thumbnail instead.
    Bottom strip thumbnails all in full colour (user, 2026-10-27: the non-current ones were
    faded to 55 % and looked washed out); only an outline marks the current one.
    **Narrow windows (≤ 760 px)**: Information is its own row between the photo and the strip
    (user, 2026-10-27: it floated see-through over the photo and thumbnails); rows two to a line
    (one under 480 px), no "Information" heading, max 40vh. Closed by default there, and
    resizing across 760 px resets it to that size's default (a wide window made small kept it
    open). Checked at 710 × 908 and 390 × 844.
    **Information starts closed everywhere** (user, 2026-10-27: "add a small < button, so if
    someone wanna look, they can click"): on wide windows a small tab on the photo's right
    edge (near the top, away from the › button), labelled down the edge in the page's language
    (user: "instead of <", 摄影参数 / 攝影參數 / Photo Details), slides the sidebar in (the
    column animates 0 → 20rem) and is filled while it's open; the ⓘ button in the viewer's bar shows only on
    narrow windows (≤ 760 px), where the tab is hidden. The I key toggles it at any size.
  - **Range maps** (user, 2026-10-25: the "color map provided by Birds of the World"): Birds of
    the World's maps are Cornell's paid content and can't be copied; the user chose **eBird
    Status & Trends** instead (same lab, free for non-commercial use with credit, needs a free
    access key the user requests at https://ebird.org/st/request). `scripts/make_ranges.py
    --key KEY` downloads each species' smoothed range (GeoPackage, read with sqlite3, no GIS
    library; cache outside the repo, `../ebirdst-cache/`) and writes `_data/ranges.yml` (per
    eBird code, path data in map units, one season per spot like the landscape blocks:
    year-round = resident or breeding+nonbreeding, breeding, nonbreeding, migration). The page
    draws it in Birds of the World's colours (`--range-*` tokens), see-through, clipped to land,
    masked with the continents, **only while the cursor is on that species' card** (user,
    2026-10-25; on phones, while the card is at the reading line; not on dot hover, not by
    default); legend Year-round / Breeding / Nonbreeding / Migration and an eBird credit appear only
    when a range exists. **Carolina Wren done** (2026-10-25, user's key; data version 2023,
    smoothed 27 km range, one "resident" season → year-round; matches the Birds of the World
    map the user showed). The key is the user's: never write it into a repo file; pass it per
    run (`EBIRDST_KEY=… python scripts/make_ranges.py`, or `--key`). After adding a species to
    species.yml, rerun the script;
  - **Ranges beyond the continent** (user, 2026-10-31: "some birds are distributed not only in
    one continent, and in the continent view, indicate that"). Zoomed into a continent, hovering
    a bird's card turns the other continents its range reaches the accent colour in the continent
    bar (click one to go there), and a line under the range legend names them: "Its range also
    reaches South America · Europe …" (分布还延伸至 / 分布還延伸至). Nothing in the world view, where
    the whole range shows. Data: `_data/range_continents.yml`, **generated** by
    `scripts/range_continents.py` (make_ranges.py runs it at the end): each range laid on the
    continents' mask shapes from world-map-plain.svg, **land only** (as the page clips ranges),
    at least 1 map unit² (~4,500 km²) to count. Cards carry it as `data-range`; places-map.js
    `showBeyond()`. The line keeps its height when empty, so the card list beside the map
    doesn't jump. Worldwide so far: Osprey, Great Egret, Glossy Ibis, Black-bellied Plover, Ruddy
    Turnstone (all six); Western Cattle-Egret (Americas, Europe, Africa, Asia); Semipalmated
    Plover (Americas, Asia: it breeds on Chukotka).
    - **Map bug fixed on the way**: the continent shapes counted Russia's land east of 180°
      (Chukotka, Wrangel Island, drawn at the map's left edge) and its sea as **Europe**, since
      the Urals split went by longitude < 60° and those longitudes are negative. Fixed in
      `make_world_map.py` (Europe only 0°–60°E); the source data for a rerun was gone, so that
      one piece was moved from the Europe shape to Asia's in world-map.svg and
      world-map-plain.svg by hand, as the fixed script would.
    - **Hudsonian Whimbrel clipped at 168°W** (was 180°W, `LON_CLIP` in make_ranges.py): the
      lumped S&T range included Chukotka's (Eurasian) whimbrels and showed the bird in Asia.
      Its range was remade from the cached download.
  - a **plain map**: `_includes/places/world-map-plain.svg` / `antarctica-map-plain.svg` (land,
    **lakes and rivers like Traces** (user, 2026-10-25), and borders; no landscape blocks; ~50 KB
    gzipped, made by the same script), no legend, credit "Map data: Natural Earth; rivers:
    HydroRIVERS"; land a touch whiter in light mode with a faint coastline (`.places--plain`),
    like Ariel Mu's map;
  - count line "1 place · 1 sighting" (English singular/plural for both pages; 次记录 / 次記錄).
    **Numbers in the accent colour, counting up on load** (user, 2026-11-04: "the numbers should
    be the highlighted color, and when refresh the page, it should fastly increase from 0"), then
    the same day: **the whole line in the page title's font** (EB Garamond, words 1.1rem; was
    Hanken 0.9rem), numbers weight 500 at 1.6× the words; **Avians no longer counts photos**
    ("do not report how many photos I take": "10 places · 86 species" / 10 个地方 · 86 种鸟).
    Each number is `_includes/places/count-num.html` (equal-width digits in a box as wide as the
    final number, so the words don't move); `assets/js/count-up.js`, loaded right after the line
    (not deferred, so the final numbers never flash first), counts them from 0 over **4 s with a
    quartic ease-out** (0.9 s, then 2.2 s cubic, were "too fast"; the user wanted it slower near
    the end: the last steps 82 → 86 take ~0.8 s and 86 lands at ~3.1 s; a steeper curve reaches
    the last whole number long before the end and seems to stop), once the fonts are ready.
    Reduced motion: no counting. Both pages (the line is shared). Checked at 1440: EN light,
    简 dark, Traces.
  The land in every map file is the real path (`id="…-land-shape"`) and the clip refers to it
  with <use>, so vector-effect works on the coastline.

### Photos on the site right now

- **Birds only, on Avians** (`_data/avians.yml`, photos in the `bird-2026` / `bird-2025` image
  repos). The homepage shows no photos; `_data/photos.yml` was deleted (2026-10-31) with the
  homepage sections that read it.

### Features
<!-- e.g. lightbox, EXIF display, species list, map, filters, slideshow... -->

### Keep from the old site
<!-- Anything from archive/ that must carry over. -->

### Out of scope
<!-- Things not to build or not to change. -->
- **The Alaska photos are treated as gone** (user, 2026-10-21). Don't use, show or mention
  the photos in `../G001A_Alaska/` or the photo data in `archive/_data/photos.yml`, and
  don't bring them up in discussion. Leave that repo untouched.
- **No watermarking for now.** The photo script must not add watermarks, even though
  watermark files exist in `../00_PRELIMINARIES/01_Watermarks/`.

## Facts about the existing content

- **Other folders next to this repo** (in `/Users/zhangronghao/Documents/github_gallary/`):
  - `00_PRELIMINARIES/`: the older photo scripts and watermark files (`01_Watermarks/`).
  - `A001_Birding/`: 8 exported JPEGs, mostly still named by the camera (`IM8A7076.jpg`), not on the site yet.
  - `2026-05-03_Birding/RAW_RAW/`: 367 CR3 raws (19 GB). Originals; not a git repo.
- **Contact form** posted to Formspree (`https://formspree.io/f/xpqokrlr`).
  Contact email: ronghao.zhang.home@gmail.com. Based in Atlanta, GA.
- `archive/scripts/add_photo_ratios.py` (now only in git history, see Status) reads each
  image's width/height from the first bytes of its JPEG. It can be reused to avoid layout shift.

## Conventions

- Keep the build dependency-light: Jekyll 4.4 + `jekyll-sass-converter`, plain JS, no bundler/npm.
- Photo scripts are Python 3 using Pillow, like the older scripts.
- Photo metadata lives in data/front matter, never hard-coded in layouts.
- Use `large/` images only in full-screen views and the slideshow; use `thumb/` everywhere else.
  Never load a full-size original on the site.
