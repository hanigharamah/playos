#!/usr/bin/env python3
"""
Generates placeholder app icons/splash so `expo start` and `expo prebuild`
have real files at every path app.json references. Simple flat-color marks
in the PlayOS palette (see ../lib/theme.ts) — swap for real design assets
before shipping to the stores; these exist only so the build pipeline works.
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT, exist_ok=True)

CREAM = (255, 248, 240, 255)   # colors.creamDeep
ORANGE = (255, 159, 10, 255)   # colors.orange
NAVY = (29, 53, 87, 255)       # colors.inkNavy
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def mark(size, bg, fg, ring=True):
    """Circle mark with a 'P' letter — the placeholder brand glyph."""
    img = Image.new("RGBA", (size, size), bg)
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.12)
    draw.ellipse([pad, pad, size - pad, size - pad], fill=fg)
    font = ImageFont.truetype(FONT_PATH, int(size * 0.42))
    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]), text, font=font, fill=WHITE)
    return img


def solid_dot(size, color):
    """Flat white silhouette for the Android notification icon."""
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.15)
    draw.ellipse([pad, pad, size - pad, size - pad], fill=color)
    return img


# 1. App icon (iOS + Android generic) — opaque background required by iOS.
mark(1024, CREAM, ORANGE).save(os.path.join(OUT, "icon.png"))

# 2. Android adaptive icon foreground — transparent bg, OS supplies the
#    backgroundColor from app.json separately.
mark(1024, TRANSPARENT, ORANGE).save(os.path.join(OUT, "adaptive-icon.png"))

# 3. Splash image — transparent, scaled by expo-splash-screen's imageWidth:200.
mark(1024, TRANSPARENT, ORANGE).save(os.path.join(OUT, "splash.png"))

# 4. Android notification icon — must be a flat white silhouette; the OS
#    tints it, so any color info here is discarded at runtime.
solid_dot(192, WHITE).save(os.path.join(OUT, "notification-icon.png"))

print("Generated: icon.png, adaptive-icon.png, splash.png, notification-icon.png")
