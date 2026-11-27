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

# One PDF with every slice (one slice per page, labelled), for tools that take a
# single upload. Order: key pages first, phone then desktop.
from PIL import ImageDraw, ImageFont

ORDER = ["home", "product", "category", "cart", "checkout", "search",
         "offers", "track", "login", "signup", "404"]
def sort_key(p: Path):
    page, width, *n = p.stem.split("-")
    return (ORDER.index(page), int(width), int(n[0]) if n else 0)

slices = sorted(OUT.glob("*.jpg"), key=sort_key)
try:
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", 18)
except OSError:
    font = ImageFont.load_default()
pages = []
for p in slices:
    img = Image.open(p).convert("RGB")
    page_img = Image.new("RGB", (img.width, img.height + 36), "white")
    page_img.paste(img, (0, 36))
    page, width, *n = p.stem.split("-")
    label = f"{page} - {'phone 390px' if width == '390' else 'desktop 1280px'}" + (f" - part {n[0]}" if n else "")
    ImageDraw.Draw(page_img).text((10, 8), label, fill="black", font=font)
    pages.append(page_img)
pdf = OUT.parent / "current-shop.pdf"
pages[0].save(pdf, save_all=True, append_images=pages[1:], resolution=96, quality=80)
print(f"PDF {pdf} ({len(pages)} pages, {pdf.stat().st_size // 1024} KB)")
