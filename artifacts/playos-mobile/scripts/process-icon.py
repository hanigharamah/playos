#!/usr/bin/env python3
"""
Turns the designer-provided PlayOS wordmark screenshot into a real app icon.

The source file is a screenshot of a rounded-square icon preview: the four
corners outside the rounded shape are pure black, baked into the pixels, with
the curve-to-black transition ending by ~85px diagonally from each corner.
Apple's App Store spec requires a perfectly square, fully opaque image with
NO pre-rounded corners (iOS applies its own corner mask at render time).

Rather than trying to color-threshold away an anti-aliased edge (which risks
leaving a faint ring, or eating dark parts of the wordmark), this crops
inward past the curve entirely — INSET is well past the measured ~85px
transition point — leaving a perfectly clean rectangle with zero corner
artifacts, then pads/resizes that up to a square.
"""
from PIL import Image
import glob
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.join(HERE, "..", "..", "..")
matches = glob.glob(os.path.join(REPO_ROOT, "Screenshot*3.53.15*"))
if not matches:
    raise SystemExit(f"Source screenshot not found under {REPO_ROOT}")
SRC = matches[0]
OUT = os.path.join(HERE, "..", "assets")

img = Image.open(SRC).convert("RGB")
w, h = img.size

INSET = 100  # measured corner curve ends by ~85px diagonally; this clears it with margin
clean = img.crop((INSET, INSET, w - INSET, h - INSET))
cw, ch = clean.size

# Pad the shorter axis with the card's own cream tone (sampled well inside
# the clean region) so the final resize to square doesn't stretch the design.
cream = clean.getpixel((cw // 2, 4))
size = max(cw, ch)
square = Image.new("RGB", (size, size), cream)
square.paste(clean, ((size - cw) // 2, (size - ch) // 2))

icon_1024 = square.resize((1024, 1024), Image.LANCZOS)

# A small gray resize/expand icon glyph (grayscale ~59-190, not the dark
# navy of the wordmark) survives in the extreme bottom-right corner even
# after the inset crop — a fixed screen-position UI overlay from whatever
# tool captured the source screenshot, not part of the design. Nothing
# legitimate lives this close to the true corner, so replace any pixel that
# isn't close to the sampled cream tone within a small, wordmark-safe box.
import numpy as np
corner = 32
arr = np.array(icon_1024)
patch = arr[-corner:, -corner:].astype(int)
dist = np.abs(patch - np.array(cream)).sum(axis=-1)
not_cream = dist > 40
if not_cream.any():
    print(f"Patching {not_cream.sum()} non-cream pixels in bottom-right {corner}x{corner} corner")
    patch[not_cream] = cream
    arr[-corner:, -corner:] = patch.astype(np.uint8)
    icon_1024 = Image.fromarray(arr, mode="RGB")

icon_1024.save(os.path.join(OUT, "icon.png"))
icon_1024.save(os.path.join(OUT, "adaptive-icon.png"))
icon_1024.save(os.path.join(OUT, "splash.png"))

print(f"Cropped to {cw}x{ch} (inset {INSET}px), padded to {size}x{size}, saved at 1024x1024")
