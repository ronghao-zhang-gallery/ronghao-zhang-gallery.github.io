# Ronghao Zhang — Photography Site

Personal photography website built with Jekyll and deployed to GitHub Pages
(https://ronghao-zhang-gallery.github.io).

## Status

Rebuilding from scratch (started 2026-10-20) with a **new design** and a **new
content structure**. The previous site lives in `archive/` for reference only:
it is excluded from the build (`_config.yml`), and new code must not depend on it
or modify it.

## Commands

- `bundle exec jekyll serve` — local preview at http://localhost:4000
- `bundle exec jekyll build` — build into `_site/`
- Deploy: push to `master` → `.github/workflows/jekyll.yml` builds and publishes to Pages.
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
  disk or backup (e.g. `../2026-05-03_Birding/RAW_RAW/`).
- Why: the Alaska trip alone is 1.7 GB of full-size JPEGs (avg 16.7 MB each).
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

### Still to decide

- The name of the image repo.
- Whether to convert the existing `G001A_Alaska` photos into the new repo
  (`2025/`, new names and sizes). `G001A_Alaska` itself can then be archived;
  its git history holds 1.7 GB of full-size files that can't be shrunk in place.
- The format of the site's photo data, which depends on the content structure
  chosen under Requirements.

## Requirements

<!-- Fill these in. Anything written here overrides the defaults below. -->

### Design
<!-- Mood, colours, light/dark, typography, reference sites you like. -->

### Content structure
<!-- How photos are organised: by trip, by subject, by place, by date... -->
<!-- How you want to add new photos (one YAML list, one file per photo, per trip...). -->

### Pages
<!-- Which pages exist and what each one shows. -->

### Features
<!-- e.g. lightbox, EXIF display, species list, map, filters, slideshow... -->

### Keep from the old site
<!-- Anything from archive/ that must carry over. -->

### Out of scope
<!-- Things not to build or not to change. -->
- **No watermarking for now.** The photo script must not add watermarks, even though
  watermark files exist in `../00_PRELIMINARIES/01_Watermarks/`.

## Facts about the existing content

- **Existing images** are full-size JPEGs in the `G001A_Alaska` repo (flat, no
  subfolders), each with a 720 px `<file>_low-res.jpg` sibling, linked via
  `https://raw.githubusercontent.com/ronghao-zhang-gallery/G001A_Alaska/main/<file>.jpg`.
- **Other folders next to this repo** (in `/Users/zhangronghao/Documents/github_gallary/`):
  - `00_PRELIMINARIES/`: the older photo scripts and watermark files (`01_Watermarks/`).
  - `A001_Birding/`: 8 exported JPEGs, mostly still named by the camera (`IM8A7076.jpg`), not on the site yet.
  - `2026-05-03_Birding/RAW_RAW/`: 367 CR3 raws (19 GB). Originals; not a git repo.
- **Existing filenames use the old, long convention** that encodes EXIF:
  `YYYY-MM-DD_HH-MM-SS_<Camera>_<Lens>_<focal>MM_F<aperture>_<shutter>SEC_ISO<iso>.jpg`
  (`1div1000SEC` = 1/1000 s). New photos use the [naming](#naming) scheme instead;
  whether to migrate the existing files is not decided yet.
- **Photo data** is in `archive/_data/photos.yml`: 102 entries, with title, location,
  EXIF fields, low-res/raw URLs and a `featured` flag.
  - 29 entries are unfinished drafts (titled "… - Not Implemented", no category).
  - Species photos use the title as the species name, e.g. `Canada Jay (Perisoreus canadensis)`.
  - Known data errors: subproject slug `alska` (typo for `Alaska`); location `Gridwood`
    (typo for `Girdwood`); "First Snow in 2025 I" filed under `north_america` instead of Alaska.
- **All current photos come from one Alaska trip, 2025-09-19 → 2025-09-27**:
  Dalton Highway / Brooks Range / Atigun Pass → Wiseman → Fairbanks → Denali →
  Girdwood → Seward / Kenai Fjords → Cooper Landing.
- **Contact form** posted to Formspree (`https://formspree.io/f/xpqokrlr`).
  Contact email: ronghao.zhang.home@gmail.com. Based in Atlanta, GA.
- `archive/scripts/add_photo_ratios.py` reads each image's width/height from the
  first bytes of its JPEG. It can be reused to avoid layout shift.

## Conventions

- Keep the build dependency-light: Jekyll 4.4 + `jekyll-sass-converter`, plain JS, no bundler/npm.
- Photo scripts are Python 3 using Pillow, like the older scripts.
- Photo metadata lives in data/front matter, never hard-coded in layouts.
- Use `large/` images only in full-screen views and the slideshow; use `thumb/` everywhere else.
  Never load a full-size original on the site.
