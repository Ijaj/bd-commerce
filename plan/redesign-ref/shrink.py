#!/usr/bin/env python3
"""Shrink full-page screenshots for upload to Claude (fewer image tokens).

Claude bills images at about (width * height) / 750 tokens and downscales any
image whose long edge is over ~1568 px. A 10,000 px tall page would be squashed
to an unreadable strip, so tall pages are cut into slices instead.

  390 px shots: back to 1x (390 wide), slices up to 1500 px tall
  1280 px shots: 960 wide, slices up to 1200 px tall
Output: JPEG q80 in ./small/, plus a token estimate per file.
"""
from pathlib import Path
from PIL import Image

SRC = Path(__file__).parent / "current"
OUT = Path(__file__).parent / "small"
RULES = {"390": (390, 1500), "1280": (960, 1200)}  # width, max slice height
OUT.mkdir(exist_ok=True)
for old in OUT.glob("*.jpg"):  # drop stale slices from an earlier run
    old.unlink()

total = 0
for src in sorted(SRC.glob("*.png")):
    page, width = src.stem.rsplit("-", 1)
    target_w, slice_h = RULES[width]
    img = Image.open(src).convert("RGB")
    img = img.resize((target_w, round(img.height * target_w / img.width)), Image.LANCZOS)
    parts = max(1, -(-img.height // slice_h))
    for i in range(parts):
        part = img.crop((0, i * slice_h, target_w, min(img.height, (i + 1) * slice_h)))
        name = f"{page}-{width}" + (f"-{i + 1}" if parts > 1 else "") + ".jpg"
        part.save(OUT / name, quality=80, optimize=True)
        tokens = part.width * part.height // 750
        total += tokens
        print(f"{name:24} {part.width}x{part.height:<5} ~{tokens} tokens")
print(f"TOTAL ~{total} tokens")
