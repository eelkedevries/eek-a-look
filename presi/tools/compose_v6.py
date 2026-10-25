"""presi-slides v6: the panels of slides 9-12 redrawn with eek-a-look's colour scales of prompt 079.

Usage: python compose_v6.py <eek-a-look repo> <render dir> <out dir>
The render dir holds render_panels.py's output for the three examples at 1200x900 (--displayed 600).
Labels, sizes and scanpath drawing as compose_v4.py (bands 1 and 2) and compose_v5.py (scanpath slide).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO, RENDER, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
SIZE = (1200, 900)
BLUE, ORANGE, DARK = (47, 127, 208), (221, 122, 22), (10, 10, 15)
BOLD = "/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf"
NUMFONT = ImageFont.truetype(BOLD, 34)
EX = {"greenery": ("zurich-33", "zurich-33-low-hedge"), "glazing": ("zurich-53", "zurich-53-glass-frontage"), "entrance": ("zurich-42", "zurich-42-entrance-block")}


def tag(img, text, colour, out=(618, 464), size=30, height=44):
    img = img.convert("RGB").resize(out, Image.LANCZOS)
    d = ImageDraw.Draw(img, "RGBA")
    font = ImageFont.truetype(BOLD, size)
    l, _, r, _ = d.textbbox((0, 0), text, font=font)
    d.rounded_rectangle((12, 12, 12 + r - l + 30, 12 + height), radius=8, fill=colour + ((235,) if colour == DARK else (255,)))
    d.text((27, 12 + height / 2), text, font=font, fill=(255, 255, 255), anchor="lm")
    return img


def path_on(heat_png, photo):
    """DeepGaze3.5-VL scanpath 1 as on the site: the starting fixation dropped, the rest numbered 1-7."""
    img = Image.open(heat_png).convert("RGB")
    sp = json.loads((REPO / "public/precomputed/deepgaze35-vl" / f"{photo}.json").read_text())
    pts = [(i + 1, gx * SIZE[0] / sp["grid"], gy * SIZE[1] / sp["grid"]) for i, (gx, gy) in enumerate(sp["scanpaths"][0][1:])]
    d = ImageDraw.Draw(img)
    R = 30
    for (_, x0, y0), (_, x1, y1) in zip(pts, pts[1:]):
        d.line([(x0, y0), (x1, y1)], fill=(0, 0, 0), width=14)
        d.line([(x0, y0), (x1, y1)], fill=(255, 255, 255), width=7)
    for n, x, y in reversed(pts):
        d.ellipse((x - R, y - R, x + R, y + R), fill=(255, 255, 255), outline=(0, 0, 0), width=5)
        d.text((x, y), str(n), font=NUMFONT, fill=(10, 10, 15), anchor="mm")
    return img


OUT.mkdir(parents=True, exist_ok=True)
for ex, (a, b) in EX.items():
    panel = lambda name: Image.open(RENDER / f"{ex}-{name}.png")
    panels = {
        "b1-measured": tag(panel("measured"), "GEMETEN · ORIGINEEL", BLUE),
        "b1-predicted": tag(panel("msdb-a"), "VOORSPELD · ORIGINEEL", ORANGE),
        "b1-contrast": tag(panel("msdb-minus-measured"), "CONTRAST", DARK),
        "b2-original": tag(panel("msdb-a"), "VOORSPELD · ORIGINEEL", BLUE),
        "b2-manipulated": tag(panel("msdb-b"), "VOORSPELD · GEMANIPULEERD", ORANGE),
        "b2-contrast": tag(panel("msdb-diff"), "CONTRAST", DARK),
        "paths-original": tag(path_on(RENDER / f"{ex}-msdb-a.png", a), "VOORSPELD · ORIGINEEL", BLUE, out=(800, 600), height=44),
        "paths-manipulated": tag(path_on(RENDER / f"{ex}-msdb-b.png", b), "VOORSPELD · GEMANIPULEERD", ORANGE, out=(800, 600), height=44),
    }
    for name, im in panels.items():
        im.save(OUT / f"{ex}-{name}.png", optimize=True)
    print(ex, "ok")
