"""Panels for the presi-slides examples, v4: tags burned in, predicted scanpath panels, and the stats."""
import importlib.util, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO, MOCK, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
spec = importlib.util.spec_from_file_location("rp", MOCK / "tools/render_panels.py"); rp = importlib.util.module_from_spec(spec); spec.loader.exec_module(rp)
SIZE = (1200, 900); OUTSIZE = (618, 464)
BLUE, ORANGE, DARK = (47, 127, 208), (221, 122, 22), (10, 10, 15)
FONT = ImageFont.truetype("/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf", 30)
NUMFONT = ImageFont.truetype("/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf", 34)
EX = {"greenery": ("zurich-33", "zurich-33-low-hedge"), "glazing": ("zurich-53", "zurich-53-glass-frontage"), "entrance": ("zurich-42", "zurich-42-entrance-block")}

def tag(img, text, colour, size=None):
    img = img.convert("RGB").resize(OUTSIZE, Image.LANCZOS)
    d = ImageDraw.Draw(img, "RGBA"); f = FONT if size is None else ImageFont.truetype("/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf", size)
    x0, y0 = 12, 12; l, t, r, b = d.textbbox((0, 0), text, font=f)
    w, h = r - l + 30, 44
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=8, fill=colour + ((235,) if colour == DARK else (255,)))
    d.text((x0 + 15, y0 + h / 2), text, font=f, fill=(255, 255, 255), anchor="lm")
    return img

def path_panel(photo, ex, scan):
    base = rp.greyed(REPO / "public/examples" / f"{photo}.jpg", SIZE)
    rf = REPO / "public/precomputed/comparisons" / f"{ex}.json"
    rid = json.loads(rf.read_text())["regions"][0]["id"]
    img = Image.fromarray(rp.over(base, rp.outline_layer(rp.load_mask(rf, rid), SIZE)).astype(np.uint8) if rp.over(base, rp.outline_layer(rp.load_mask(rf, rid), SIZE)).dtype != np.uint8 else rp.over(base, rp.outline_layer(rp.load_mask(rf, rid), SIZE)))
    sp = json.loads((REPO / "public/precomputed/deepgaze35-vl" / f"{photo}.json").read_text())
    # As the site: drop the starting fixation, number the rest 1–7, grid → pixels as x × width / grid.
    pts = [(i + 1, gx * SIZE[0] / sp["grid"], gy * SIZE[1] / sp["grid"]) for i, (gx, gy) in enumerate(sp["scanpaths"][0][1:])]
    d = ImageDraw.Draw(img); R = 30
    for (_, x0, y0), (_, x1, y1) in zip(pts, pts[1:]):
        d.line([(x0, y0), (x1, y1)], fill=(0, 0, 0), width=14); d.line([(x0, y0), (x1, y1)], fill=(255, 255, 255), width=7)
    for n, x, y in reversed(pts):
        d.ellipse((x - R, y - R, x + R, y + R), fill=(255, 255, 255), outline=(0, 0, 0), width=5)
        d.text((x, y), str(n), font=NUMFONT, fill=(10, 10, 15), anchor="mm")
    return img, len(sp["scanpaths"])

for ex, (a, b) in EX.items():
    R = MOCK / "render"
    measured = Image.open(MOCK / f"v3-{ex}-measured.png")
    panels = {
        "b1-measured": tag(measured, "GEMETEN · ORIGINEEL", BLUE),
        "b1-predicted": tag(Image.open(R / f"{ex}-msdb-a.png"), "VOORSPELD · ORIGINEEL", ORANGE),
        "b1-contrast": tag(Image.open(R / f"{ex}-msdb-minus-measured.png"), "CONTRAST", DARK),
        "b2-original": tag(Image.open(R / f"{ex}-msdb-a.png"), "VOORSPELD · ORIGINEEL", BLUE),
        "b2-manipulated": tag(Image.open(R / f"{ex}-msdb-b.png"), "VOORSPELD · GEMANIPULEERD", ORANGE),
        "b2-contrast": tag(Image.open(R / f"{ex}-msdb-diff.png"), "CONTRAST", DARK),
    }
    pa, na = path_panel(a, ex, None); pb, nb = path_panel(b, ex, None)
    panels["b3-original"] = tag(pa, "VOORSPELD KIJKPAD · ORIGINEEL", BLUE)
    panels["b3-manipulated"] = tag(pb, "VOORSPELD KIJKPAD · GEMANIPULEERD", ORANGE, size=27)
    for k, im in panels.items():
        im.save(OUT / f"{ex}-{k}.png", optimize=True)
    print(ex, "paths:", na, nb)
