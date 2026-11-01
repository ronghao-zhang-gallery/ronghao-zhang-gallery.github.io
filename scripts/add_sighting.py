"""Add a bird sighting to the Avians page from a photo's EXIF data.

Reads the photo's EXIF (date taken, camera, lens, focal length, f-number, exposure time, ISO, and
GPS if present) and appends one sighting to _data/avians.yml (user, 2026-10-25: "read the EXIF
data of that image to automatically extract the date, the camera, lens, focal length, F/#, ISO,
exposure; the place may need to be entered manually").

The place is given by hand (--place, an id from the `places:` list in avians.yml; add the place
there first if it's new). When the photo has GPS, its rounded position is printed so the place
can be checked or added. The species is an id from _data/species.yml.

Only the photo's file name is stored, not the photo: photos will live in the image repo (see
CLAUDE.md, Photo workflow), never in this one. Until that repo exists, the script also makes the
card preview's thumbnail (800 px long edge, metadata stripped) in local-photos/<year>/thumb/,
a gitignored folder the site uses for local previews (photo_local in _config.yml). Run it again
on a photo already listed to remake just its thumbnail.

  python scripts/add_sighting.py IM8A1985-2.jpg --place legacy-park --species carolina-wren

Photos already in the image repo (bird-<year>, next to this repo; its README has the naming):
give the web file's name with --web. The sighting then stores that name (and the export's name
as `export`), the site loads the photo from the image repo, and no local thumbnail is made:
  python scripts/add_sighting.py ../bird-2026/IM8A1015.jpg --place legacy-park \
      --species eastern-bluebird --web 20261025-001_eastern-bluebird_2026_atlanta-ga.webp
"""

import argparse
import sys
from pathlib import Path

import yaml
from PIL import ExifTags, Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
AVIANS = ROOT / '_data' / 'avians.yml'
SPECIES = ROOT / '_data' / 'species.yml'
LOCAL_PHOTOS = ROOT / 'local-photos'
THUMB_EDGE = 800      # long edge in px, like the image repo's thumb/ copies (CLAUDE.md)


# ---- EXIF ----

def read_exif(path):
    """The fields the page shows, from the photo's EXIF."""
    exif = Image.open(path).getexif()
    main = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
    sub = {ExifTags.TAGS.get(k, k): v for k, v in exif.get_ifd(ExifTags.IFD.Exif).items()}
    gps = {ExifTags.GPSTAGS.get(k, k): v for k, v in exif.get_ifd(ExifTags.IFD.GPSInfo).items()}

    taken = str(sub.get('DateTimeOriginal') or main.get('DateTime') or '')
    if not taken:
        sys.exit(f'{path}: no date taken in the EXIF')
    day, _, clock = taken.partition(' ')
    return {
        'date': day.replace(':', '-'),
        # Date and time to the hundredth of a second (EXIF SubsecTimeOriginal): the page sorts
        # sightings by it, and bursts put several photos in one second.
        'taken': f"{day.replace(':', '-')}T{clock[:8]}" + (f".{str(sub.get('SubsecTimeOriginal'))[:2]}" if sub.get('SubsecTimeOriginal') else ''),
        'camera': ' '.join(str(main.get('Model') or main.get('Make') or '').split()),
        'lens': ' '.join(str(sub.get('LensModel') or '').split()),
        'focal': number(sub.get('FocalLength')),
        'aperture': number(sub.get('FNumber')),
        'exposure': exposure(sub.get('ExposureTime')),
        'iso': number(sub.get('ISOSpeedRatings') or sub.get('PhotographicSensitivity')),
        'gps': position(gps),
    }


def number(v):
    """A tidy number: 700.0 → 700, 5.6 → 5.6; None stays None."""
    if v is None:
        return None
    v = float(v)
    return int(v) if v.is_integer() else round(v, 1)


def exposure(v):
    """Exposure time as photographers write it: 0.002 → "1/500", 2.0 → "2"."""
    if v is None:
        return None
    v = float(v)
    return f'{number(v)}' if v >= 1 else f'1/{round(1 / v)}'


def position(gps):
    """(lat, lon) from EXIF GPS, or None."""
    try:
        def deg(dms, ref):
            d = float(dms[0]) + float(dms[1]) / 60 + float(dms[2]) / 3600
            return -d if ref in ('S', 'W') else d
        return deg(gps['GPSLatitude'], gps['GPSLatitudeRef']), deg(gps['GPSLongitude'], gps['GPSLongitudeRef'])
    except (KeyError, TypeError, IndexError):
        return None


# ---- Thumbnail ----

def make_thumb(photo, year):
    """The card preview's thumbnail in local-photos/<year>/thumb/ (no EXIF: no GPS leaks)."""
    out = LOCAL_PHOTOS / year / 'thumb' / Path(photo).name
    out.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(photo)
    im = ImageOps.exif_transpose(im).convert('RGB')
    im.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
    im.save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    print(f'thumbnail: {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)')


# ---- Writing the sighting ----

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('photo', help='the photo (JPEG exported from the raw)')
    ap.add_argument('--place', required=True, help='a place id from avians.yml')
    ap.add_argument('--species', required=True, help='a species id from species.yml')
    ap.add_argument('--web', help="the photo's file name in the image repo (bird-<year>/large|thumb/)")
    args = ap.parse_args()

    data = yaml.safe_load(AVIANS.read_text(encoding='utf-8')) or {}
    species = yaml.safe_load(SPECIES.read_text(encoding='utf-8')) or {}
    if args.place not in {p['id'] for p in data.get('places') or []}:
        sys.exit(f'No place "{args.place}" in {AVIANS.name}: add it under places: first.')
    if args.species not in species:
        sys.exit(f'No species "{args.species}" in {SPECIES.name}: add it first.')
    e = read_exif(args.photo)
    year = e['date'][:4]
    if args.web:
        # Already published in the image repo: check both copies are there, store their name.
        repo = ROOT.parent / f'bird-{year}'
        missing = [d for d in ('large', 'thumb') if not (repo / d / args.web).exists()]
        if missing:
            sys.exit(f'{args.web} is not in {repo.name}/{" or ".join(missing)}/: add it there first.')
        photo = args.web
    else:
        photo = Path(args.photo).name
        make_thumb(args.photo, year)
    if any(v.get('photo') == photo for v in data.get('visits') or []):
        print(f'{photo} is already in {AVIANS.name}.' + ('' if args.web else ' Only its thumbnail was remade.'))
        return

    if e['gps']:
        print(f'GPS in the photo: {e["gps"][0]:.1f}, {e["gps"][1]:.1f} (rounded); check it matches "{args.place}".')

    # Appended as text, so the hand-written comments in avians.yml stay as they are.
    fields = [('place', args.place), ('species', args.species), ('photo', photo),
              ('export', Path(args.photo).name if args.web else None),
              ('date', f'"{e["date"]}"'), ('taken', f'"{e["taken"]}"'), ('camera', e['camera']),
              ('lens', e['lens']), ('focal', e['focal']), ('aperture', e['aperture']),
              ('exposure', f'"{e["exposure"]}"' if e['exposure'] else None), ('iso', e['iso'])]
    lines = []
    for k, v in fields:
        if v not in (None, ''):
            lines.append(f'{"  - " if not lines else "    "}{k}: {v}')
    text = AVIANS.read_text(encoding='utf-8').rstrip('\n') + '\n' + '\n'.join(lines) + '\n'
    AVIANS.write_text(text, encoding='utf-8')
    print(f'Added to {AVIANS.name}:\n' + '\n'.join(lines))


if __name__ == '__main__':
    main()
