<!-- PRODUCT.md: who the site is for, what it must do, and the facts design work must respect.
     Written by the impeccable `init` flow from the user's answers (2026-10-20).
     Visual direction does not belong here; it goes in DESIGN.md. Workflow rules live in CLAUDE.md. -->

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: Ronghao Zhang, the photographer.** The site is first a personal archive
  and portfolio of their field photography. They care most that every record is
  accurate and detailed.
- **Also visited by:** birders and nature fans, friends and family, and potential
  clients. These visitors matter, but when needs conflict, the photographer's
  accurate archive wins.

## Product Purpose

A personal photography site where each published photo is a field record.

- **Main job:** let a visitor learn species and places: what was seen, where, when,
  and how it was photographed.
- **Also:** enjoy the photos, follow each trip as a story, and get in touch.
- **Success:** every published photo has a correct, complete record (species name,
  place, date, camera settings), and a visitor can find what a species or place
  looks like and when and where it was seen.

## Positioning

Four things together, which a generic nature portfolio doesn't combine:

- **Birds with exact IDs:** every bird named with its common and scientific name.
- **Field detail:** gear, settings, date and place recorded for every shot.
- **Remote road trips:** places few people reach.
- **Photo + illustration:** photos paired with illustrated postcard art
  (made by Codex, see Brand Commitments).

## Operating Context

- Shot on a Canon EOS RP with RF 100-400mm F5.6-8, RF 24-105mm F4-7.1 and RF 50mm F1.8 lenses.
- Raw files (CR3) stay on local disk. The photographer exports JPEGs into `inbox/`,
  and an import script names them, resizes them, and adds their EXIF to the site data.
  The photographer then fills in titles and locations (see CLAUDE.md, Photo workflow).
- Photos are taken on trips, so a photo belongs to a trip and can also carry subjects
  such as a species.

## Capabilities and Constraints

- Jekyll 4.4 static site on GitHub Pages. No server: interactive effects run in the
  browser; no logins, uploads or database.
- Photos live in a separate image repo, grouped by year, as `large/` (2560 px) and
  `thumb/` (800 px) copies. Originals never go online. File names are
  `YYYY-MM-DD_NNN.jpg` and never change once given.
- No watermarks for now.
- Contact goes through a Formspree form.
- **Undecided** (the user will give instructions; other repositories will be created):
  how content is organised (trip, subject, place, timeline), which pages exist,
  first-version features, the image repo's name, and the photo data format.

## Brand Commitments

- Name: **Ronghao Zhang**. Based in Atlanta, GA. Contact: ronghao.zhang.home@gmail.com.
- Species titles use `Common Name (Scientific name)`, e.g. `Canada Jay (Perisoreus canadensis)`.
- Illustrated postcard art (vintage screen-print style on ivory paper, made from a photo)
  is part of the site. **Codex makes it; Claude does not.** Codex's instructions:
  `.codex/skills/photo-postcard/SKILL.md`.

## Evidence on Hand

- **No photos are on the site yet.**
- **Not yet on the site:** 8 exported birding JPEGs in `../A001_Birding/`, and 367 raws
  from 2026-05-03 in `../2026-05-03_Birding/RAW_RAW/`.
- **Bird illustrations:** hawk, owl, phoebe and warbler in `assets/images/homepage/dots/`.
- **Absent, never invent:** no prints, licensing or photography services are offered yet;
  no clients, testimonials, awards or press.

## Product Principles

1. **Accuracy first.** A wrong species, place or date is a bug. When an ID or place is
   unknown, leave it blank and visible as unknown; never guess.
2. **Every photo is a field record.** Species, place, date and settings stay attached to
   the photo wherever it appears in full.
3. **Built for the photographer's archive.** Records are complete, URLs stay stable, and
   adding new photos stays easy.
4. **The photos still carry the site.** Records support the images; they don't bury them.
5. **Claim only what exists.** No offers, prices or client proof until they are real.
