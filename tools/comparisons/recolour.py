"""A larger entrance manipulation for the Example section (prompt 071).

The first edit gave only the door frame a blue-teal colour (about 1% of the
image). This one recolours the whole rusticated stone block around the
entrance, from the balcony slab down to the pavement, in the same blue-teal.
It is made here, by rule, from the original photograph rather than with an
image-editing model, so nothing outside the block changes (apart from
JPEG re-encoding noise when the result is saved, mean 0.5 of 255 levels):

- the block is a rectangle set by hand; the door opening, the steps and the
  oval sign are cut out of it, and so are coloured pixels (the plants and
  their pots), which are not stone;
- inside it, each pixel keeps its lightness (CIELAB L*), so the stone's
  joints, texture, sunlight and shadow stay as they are, and takes the
  blue-teal hue of the first edit's frame at a clearly visible chroma
  (HUE; the frame's own mean chroma, about 7, reads as grey on this
  stone), reduced in the darkest and lightest pixels as paint would look;
- the mask's edge is softened by 1 px, so the change has no jagged border.

Writes .cache/sources/zurich-42-entrance-block.png and a check overlay in
.cache/; prepare it with `node scripts/prepare-photos.mjs
tools/comparisons/.cache/sources public/examples`.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
EXAMPLES = HERE.parents[1] / "public" / "examples"
CACHE = HERE / ".cache"
SOURCES = CACHE / "sources"

ORIGINAL = "zurich-42"
OUTPUT = "zurich-42-entrance-block"

# In pixels of the 1280 × 960 image: (x0, y0, x1, y1), end-exclusive.
BLOCK = (320, 640, 543, 817)
DOOR = (410, 655, 468, 797)
STEPS = (404, 795, 476, 817)
SIGN = {"centre": (502.0, 722.5), "radii": (16.0, 11.0)}
# Pixels more colourful than this (CIELAB chroma) are not stone: the plants and their pots.
STONE_CHROMA = 16.0
# CIELAB a*, b* of the new colour: the hue of the first edit's frame (prompt 058, 202° in a*b*, measured where
# that edit made the stone bluer) at chroma 24.
HUE = (-22.2, -9.0)

WHITE = np.array([0.95047, 1.0, 1.08883])
M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])


def to_lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb / 255.0
    linear = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = linear @ M.T / WHITE
    f = np.where(xyz > (6 / 29) ** 3, np.cbrt(xyz), xyz / (3 * (6 / 29) ** 2) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def to_rgb(lab: np.ndarray) -> np.ndarray:
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], axis=-1)
    xyz = np.where(f > 6 / 29, f**3, 3 * (6 / 29) ** 2 * (f - 4 / 29)) * WHITE
    linear = np.clip(xyz @ np.linalg.inv(M).T, 0, 1)
    c = np.where(linear <= 0.0031308, 12.92 * linear, 1.055 * linear ** (1 / 2.4) - 0.055)
    return np.clip(c * 255 + 0.5, 0, 255)


def load(pid: str) -> np.ndarray:
    return np.asarray(Image.open(EXAMPLES / f"{pid}.jpg").convert("RGB"), dtype=np.float64)


def block_mask(lab: np.ndarray) -> np.ndarray:
    h, w = lab.shape[:2]
    mask = np.zeros((h, w), bool)
    x0, y0, x1, y1 = BLOCK
    mask[y0:y1, x0:x1] = True
    for x0, y0, x1, y1 in (DOOR, STEPS):
        mask[y0:y1, x0:x1] = False
    yy, xx = np.mgrid[0:h, 0:w]
    (cx, cy), (rx, ry) = SIGN["centre"], SIGN["radii"]
    mask &= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 > 1
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    coloured = ndimage.binary_dilation(ndimage.binary_opening(chroma > STONE_CHROMA, iterations=1), iterations=2)
    return mask & ~coloured


def main() -> int:
    original = load(ORIGINAL)
    lab = to_lab(original)
    hue_a, hue_b = HUE
    mask = block_mask(lab)
    weight = ndimage.gaussian_filter(mask.astype(np.float64), 1.0) * mask.max()
    lightness = lab[..., 0]
    # Full chroma in the mid-tones, less in deep shadow and highlights.
    strength = np.clip(lightness / 35, 0, 1) * np.clip((100 - lightness) / 25, 0, 1)
    recoloured = lab.copy()
    recoloured[..., 1] = lab[..., 1] * (1 - weight) + hue_a * strength * weight
    recoloured[..., 2] = lab[..., 2] * (1 - weight) + hue_b * strength * weight
    out = to_rgb(recoloured)
    out[weight == 0] = original[weight == 0]

    SOURCES.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out.astype(np.uint8)).save(SOURCES / f"{OUTPUT}.png")
    check = out.copy()
    edge = mask & ~ndimage.binary_erosion(mask)
    check[edge] = (255, 0, 255)
    Image.fromarray(check.astype(np.uint8)).crop((260, 600, 620, 840)).save(CACHE / f"{OUTPUT}-check.png")
    print(f"target a* {hue_a:.1f}, b* {hue_b:.1f}; recoloured {mask.mean() * 100:.2f}% of the image ({mask.sum()} px)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
