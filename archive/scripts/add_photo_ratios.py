#!/usr/bin/env python3
"""Fill in `ratio:` (width / height) for every photo in _data/photos.yml.

The justified gallery grid uses this ratio to lay out rows before any image
loads, so the page doesn't reflow while scrolling. Only the first ~128 KB of
each low-res JPEG is downloaded (enough to read its header). Entries that
already have a `ratio:` are left untouched, so it's safe to re-run after
adding new photos.

Usage:  python3 scripts/add_photo_ratios.py
"""
import re
import struct
import sys
import urllib.request
from pathlib import Path

PHOTOS = Path(__file__).resolve().parent.parent / "_data" / "photos.yml"


def exif_orientation(app1):
    """Return the EXIF orientation tag (1-8) from an APP1 segment payload, or 1."""
    if not app1.startswith(b"Exif\x00\x00"):
        return 1
    tiff = app1[6:]
    endian = "<" if tiff[:2] == b"II" else ">"
    ifd = struct.unpack(endian + "I", tiff[4:8])[0]
    count = struct.unpack(endian + "H", tiff[ifd:ifd + 2])[0]
    for i in range(count):
        entry = tiff[ifd + 2 + i * 12: ifd + 14 + i * 12]
        tag, = struct.unpack(endian + "H", entry[:2])
        if tag == 0x0112:
            return struct.unpack(endian + "H", entry[8:10])[0]
    return 1


def jpeg_size(data):
    """Return displayed (width, height) of a JPEG, honouring EXIF rotation."""
    if data[:2] != b"\xff\xd8":
        raise ValueError("not a JPEG")
    pos, orientation = 2, 1
    while pos + 4 <= len(data):
        if data[pos] != 0xFF:
            pos += 1
            continue
        marker = data[pos + 1]
        length = struct.unpack(">H", data[pos + 2:pos + 4])[0]
        if marker == 0xE1:
            orientation = exif_orientation(data[pos + 4:pos + 2 + length])
        # SOF markers (baseline, progressive, …) — excludes DHT/JPG/DAC
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack(">HH", data[pos + 5:pos + 9])
            return (h, w) if orientation in (5, 6, 7, 8) else (w, h)
        pos += 2 + length
    raise ValueError("no SOF marker in the downloaded bytes")


def fetch_head(url, nbytes=131072):
    req = urllib.request.Request(url, headers={"Range": f"bytes=0-{nbytes - 1}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def main():
    lines = PHOTOS.read_text().splitlines(keepends=True)
    # Split into blocks: each photo entry starts with "- "
    starts = [i for i, l in enumerate(lines) if l.startswith("- ")] + [len(lines)]
    out, updated, failed = lines[:starts[0]], 0, 0

    for a, b in zip(starts, starts[1:]):
        block = lines[a:b]
        text = "".join(block)
        url = re.search(r"^\s*image-low-res:\s*(\S+)", text, re.M)
        if url and not re.search(r"^\s*ratio:", text, re.M):
            try:
                w, h = jpeg_size(fetch_head(url.group(1)))
                idx = next(i for i, l in enumerate(block) if re.match(r"\s*image-raw:", l))
                block.insert(idx + 1, f"  ratio: {w / h:.4f}\n")
                updated += 1
                print(f"  {w}x{h}  {text.splitlines()[0][2:]}")
            except Exception as e:  # keep going; the browser falls back to measuring
                failed += 1
                print(f"  FAILED ({e}): {text.splitlines()[0][2:]}", file=sys.stderr)
        out.extend(block)

    PHOTOS.write_text("".join(out))
    print(f"\nAdded ratio to {updated} photo(s); {failed} failed.")


if __name__ == "__main__":
    main()
