"""Slide 12 panels: DeepGaze MSDB heat map with DeepGaze3.5-VL scanpath 1 on top, label burned in."""
import importlib.util, json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

REPO, MOCK, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
spec = importlib.util.spec_from_file_location("c4", MOCK / "tools/compose_v4.py")
BLUE, ORANGE = (47, 127, 208), (221, 122, 22)
SIZE = (1200, 900)
NUMFONT = ImageFont.truetype("/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf", 34)
TAGFONT = ImageFont.truetype("/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf", 30)
EX = {"greenery": ("zurich-33", "zurich-33-low-hedge"), "glazing": ("zurich-53", "zurich-53-glass-frontage"), "entrance": ("zurich-42", "zurich-42-entrance-block")}

def tag(img, text, colour, out=(800, 600)):
    img = img.convert("RGB").resize(out, Image.LANCZOS)
    d = ImageDraw.Draw(img); l, t, r, b = d.textbbox((0, 0), text, font=TAGFONT)
    d.rounded_rectangle((12, 12, 12 + r - l + 30, 56), radius=8, fill=colour)
    d.text((27, 34), text, font=TAGFONT, fill=(255, 255, 255), anchor="lm")
    return img

def path_on(heat_png, photo):
    img = Image.open(heat_png).convert("RGB")
    sp = json.loads((REPO / "public/precomputed/deepgaze35-vl" / f"{photo}.json").read_text())
    pts = [(i + 1, gx * SIZE[0] / sp["grid"], gy * SIZE[1] / sp["grid"]) for i, (gx, gy) in enumerate(sp["scanpaths"][0][1:])]
    d = ImageDraw.Draw(img); R = 30
    for (_, x0, y0), (_, x1, y1) in zip(pts, pts[1:]):
        d.line([(x0, y0), (x1, y1)], fill=(0, 0, 0), width=14); d.line([(x0, y0), (x1, y1)], fill=(255, 255, 255), width=7)
    for n, x, y in reversed(pts):
        d.ellipse((x - R, y - R, x + R, y + R), fill=(255, 255, 255), outline=(0, 0, 0), width=5)
        d.text((x, y), str(n), font=NUMFONT, fill=(10, 10, 15), anchor="mm")
    return img

for ex, (a, b) in EX.items():
    tag(path_on(MOCK / "render" / f"{ex}-msdb-a.png", a), "VOORSPELD · ORIGINEEL", BLUE).save(OUT / f"{ex}-paths-original.png", optimize=True)
    tag(path_on(MOCK / "render" / f"{ex}-msdb-b.png", b), "VOORSPELD · GEMANIPULEERD", ORANGE).save(OUT / f"{ex}-paths-manipulated.png", optimize=True)
    print(ex, "ok")
