"""Larger edits for examples 2 and 3 of the Example section (prompt 071b).

FLUX.1 Kontext regenerates the whole photo, slightly rescaled (about 1%) and
with small changes everywhere. So its output (edits/, with the prompts and
seeds in edits/edits.json) is not used as it is. For each edit:

1. registration: the output is scaled to the original's height, then an
   affine map to the original is fitted to block matches (48 px patches,
   normalised cross-correlation above 0.8) by least squares, dropping
   matches more than 1.5 px off until none are;
2. change mask: the mean absolute RGB difference between the registered edit
   and the original, blurred (4 px) and above 20, inside a search box set by
   hand around the requested change, closed, filled, cleared of patches
   under 2,000 px and dilated by 6 px (images listed in one group would
   share the union of their masks; since prompt 075 every group has one);
3. composite: the registered edit inside the mask, softened by 3 px, and the
   original's own pixels everywhere else.

Writes .cache/sources/<id>.png for `node scripts/prepare-photos.mjs
tools/comparisons/.cache/sources public/examples`, and check overlays in
.cache/.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
EXAMPLES = HERE.parents[1] / "public" / "examples"
EDITS = HERE / "edits"
CACHE = HERE / ".cache"
SOURCES = CACHE / "sources"
SIZE = (1280, 960)

BLUR = 4
THRESHOLD = 20
MIN_PATCH = 2000
DILATE = 6
FEATHER = 3.0

# Output id: original, edit file and search box (x0, y0, x1, y1) in pixels of the 1280 × 960 original.
# Images listed in one group share one mask.
GROUPS = [
    {"zurich-33-low-hedge": ("zurich-33", "zurich-33-low-hedge.webp", (0, 560, 1280, 960))},
    {"zurich-53-glass-frontage": ("zurich-53", "zurich-53-glass-frontage.webp", (180, 330, 1280, 760))},
]


def rgb(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert("RGB"), dtype=np.float64)


def matches(a: np.ndarray, b: np.ndarray, half: int = 24, search: int = 24) -> np.ndarray:
    """Block matches (x, y in a; x, y in b) where the normalised cross-correlation exceeds 0.8."""
    out = []
    margin = half + search + 1
    for cy in range(margin, a.shape[0] - margin, 60):
        for cx in range(margin, min(a.shape[1], b.shape[1]) - margin, 60):
            t = a[cy - half : cy + half, cx - half : cx + half]
            if t.std() < 4:
                continue
            t = (t - t.mean()) / t.std()
            best = (-1.0, 0, 0)
            for dy in range(-search, search + 1, 2):
                for dx in range(-search, search + 1, 2):
                    p = b[cy - half + dy : cy + half + dy, cx - half + dx : cx + half + dx]
                    c = float((t * (p - p.mean())).mean() / (p.std() + 1e-6))
                    if c > best[0]:
                        best = (c, dx, dy)
            c, dx, dy = best
            # Refine to 1 px around the coarse match.
            for ddy in (-1, 0, 1):
                for ddx in (-1, 0, 1):
                    p = b[cy - half + dy + ddy : cy + half + dy + ddy, cx - half + dx + ddx : cx + half + dx + ddx]
                    cc = float((t * (p - p.mean())).mean() / (p.std() + 1e-6))
                    if cc > c:
                        c, best = cc, (cc, dx + ddx, dy + ddy)
            if c > 0.8:
                out.append((cx, cy, cx + best[1], cy + best[2]))
    return np.array(out, dtype=np.float64)


def fit_affine(points: np.ndarray) -> np.ndarray:
    """Least-squares affine from original (x, y) to edit (x', y'), dropping outliers over 1.5 px."""
    keep = np.ones(len(points), bool)
    for _ in range(20):
        design = np.c_[points[keep, 0], points[keep, 1], np.ones(keep.sum())]
        coef_x = np.linalg.lstsq(design, points[keep, 2], rcond=None)[0]
        coef_y = np.linalg.lstsq(design, points[keep, 3], rcond=None)[0]
        full = np.c_[points[:, 0], points[:, 1], np.ones(len(points))]
        error = np.hypot(full @ coef_x - points[:, 2], full @ coef_y - points[:, 3])
        new = error <= 1.5
        if (new == keep).all():
            break
        keep = new
    return np.r_[coef_x, coef_y], keep.sum(), float(error[keep].max())


def register(original: Image.Image, edit: Image.Image) -> tuple[np.ndarray, str]:
    scaled = edit.convert("RGB").resize((round(edit.width * SIZE[1] / edit.height), SIZE[1]), Image.LANCZOS)
    points = matches(rgb(original).mean(axis=2), rgb(scaled).mean(axis=2))
    coef, used, worst = fit_affine(points)
    warped = scaled.transform(SIZE, Image.AFFINE, tuple(coef), resample=Image.BICUBIC, fillcolor=None)
    # The edit stops about 17 px short of the original's right edge; mirror its last columns into that strip.
    covered = (np.arange(SIZE[0])[None, :] * coef[0] + np.arange(SIZE[1])[:, None] * coef[1] + coef[2]) < scaled.width - 1
    out = rgb(warped)
    last = covered.sum(axis=1) - 1
    for y in range(SIZE[1]):
        n = SIZE[0] - 1 - last[y]
        if n > 0:
            out[y, last[y] + 1 :] = out[y, last[y] - n + 1 : last[y] + 1][::-1]
    note = f"affine x' = {coef[0]:.4f}x {coef[1]:+.4f}y {coef[2]:+.2f}, y' = {coef[3]:.4f}x {coef[4]:+.4f}y {coef[5]:+.2f}; {used} of {len(points)} matches, worst {worst:.2f} px"
    return out, note


def change_mask(original: np.ndarray, edit: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    diff = ndimage.gaussian_filter(np.abs(original - edit).mean(axis=2), BLUR) > THRESHOLD
    x0, y0, x1, y1 = box
    inside = np.zeros_like(diff)
    inside[y0:y1, x0:x1] = diff[y0:y1, x0:x1]
    inside = ndimage.binary_fill_holes(ndimage.binary_closing(inside, iterations=3))
    labels, n = ndimage.label(inside)
    sizes = ndimage.sum(inside, labels, range(1, n + 1))
    mask = np.isin(labels, [k + 1 for k, s in enumerate(sizes) if s >= MIN_PATCH])
    return ndimage.binary_dilation(mask, iterations=DILATE)


def main() -> int:
    SOURCES.mkdir(parents=True, exist_ok=True)
    for group in GROUPS:
        registered, masks = {}, []
        for out_id, (orig_id, file, box) in group.items():
            original = Image.open(EXAMPLES / f"{orig_id}.jpg").convert("RGB")
            edit, note = register(original, Image.open(EDITS / file))
            registered[out_id] = (rgb(original), edit)
            masks.append(change_mask(rgb(original), edit, box))
            print(f"{out_id}: {note}")
        mask = np.logical_or.reduce(masks)
        weight = np.clip(ndimage.gaussian_filter(mask.astype(np.float64), FEATHER), 0, 1)[..., None]
        for out_id, (original, edit) in registered.items():
            out = original * (1 - weight) + edit * weight
            Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)).save(SOURCES / f"{out_id}.png")
            check = out.copy()
            check[mask & ~ndimage.binary_erosion(mask, iterations=2)] = (255, 0, 255)
            Image.fromarray(check.astype(np.uint8)).resize((640, 480)).save(CACHE / f"{out_id}-check.png")
            print(f"{out_id}: edited area {mask.mean() * 100:.1f}% of the image")
    return 0


if __name__ == "__main__":
    sys.exit(main())
