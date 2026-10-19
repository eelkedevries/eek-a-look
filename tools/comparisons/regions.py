"""Regions for the three design comparisons of the Example section (prompt 058).

Each region is where the edit changed the image, found from the pixel
difference between the two conditions inside a search box set by hand around
the described change. The same region is used for both conditions, so the
comparison is over identical pixels:

- entrance: the door and its new surround (prompt 067): the bounding
  rectangle of the recoloured frame, found from the change in blueness
  between A and B, extended down to the step, where the plants hide the
  frame's legs;
- greenery: the changed pixels themselves along the building base (the added
  planting), closed, filled and slightly dilated;
- glazing: the bounding rectangles of the three largest changed patches (the
  three window bays).

Writes public/precomputed/comparisons/<example>.json (masks as row-major run
lengths at 640 × 480, as in the area files) and check overlays in .cache/.
When the maps exist, prints each layer's share of attention in each region.
"""

import base64
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
EXAMPLES = REPO / "public" / "examples"
PRECOMPUTED = REPO / "public" / "precomputed"
OUT = PRECOMPUTED / "comparisons"
CACHE = HERE / ".cache"
MASK_SIZE = (640, 480)

# Mean absolute RGB difference (0–255) after a Gaussian blur of BLUR px that counts as changed.
BLUR = 4
THRESHOLD = 20
# Change in blueness (blue minus red, 0–255) after a Gaussian blur of RECOLOUR_BLUR px that counts as recoloured.
RECOLOUR_BLUR = 2
RECOLOUR_THRESHOLD = 15

# Search boxes (x0, y0, x1, y1) in pixels of the 1280 × 960 images.
REGIONS = {
    "entrance": [{"id": "entrance", "label": "Door and surround", "box": (360, 620, 560, 850), "shape": "frame", "bottom": 797}],
    "greenery": [{"id": "planting", "label": "Added planting", "box": (0, 740, 1280, 960), "shape": "mask"}],
    "glazing": [{"id": "windows", "label": "Three window bays", "box": (640, 340, 1280, 600), "shape": "rectangles", "count": 3}],
}
LAYERS = ["measured", "classic-salience", "unisal", "deepgaze-iie", "deepgaze-msdb"]


def encode_rle(mask: np.ndarray) -> list[int]:
    """Row-major run lengths, starting with a run outside the area (possibly 0); as tools/areas/common.py."""
    flat = mask.ravel().astype(np.int8)
    edges = np.flatnonzero(np.diff(flat)) + 1
    runs = np.diff(np.concatenate(([0], edges, [flat.size]))).tolist()
    return runs if flat[0] == 0 else [0, *runs]


def load_image(pid: str) -> np.ndarray:
    return np.asarray(Image.open(EXAMPLES / f"{pid}.jpg").convert("RGB"), dtype=np.float32)


def changed(a: str, b: str) -> np.ndarray:
    diff = np.abs(load_image(a) - load_image(b)).mean(axis=2)
    return ndimage.gaussian_filter(diff, BLUR) > THRESHOLD


def recoloured(a: str, b: str) -> np.ndarray:
    """Where B became bluer than A; unlike the plain difference, this keeps the frame in shadow and drops shading changes."""
    blueness = lambda image: image[..., 2] - image[..., 0]
    return ndimage.gaussian_filter(blueness(load_image(b)) - blueness(load_image(a)), RECOLOUR_BLUR) > RECOLOUR_THRESHOLD


def region_mask(diff: np.ndarray, spec: dict) -> np.ndarray:
    x0, y0, x1, y1 = spec["box"]
    inside = np.zeros_like(diff)
    inside[y0:y1, x0:x1] = diff[y0:y1, x0:x1]
    inside = ndimage.binary_closing(inside, iterations=3)
    labels, n = ndimage.label(inside)
    sizes = ndimage.sum(inside, labels, range(1, n + 1))
    mask = np.zeros_like(diff)
    if spec["shape"] == "mask":
        keep = [k + 1 for k, s in enumerate(sizes) if s >= 400]
        mask = ndimage.binary_fill_holes(np.isin(labels, keep))
        return ndimage.binary_dilation(mask, iterations=4)
    count = spec.get("count", 1)
    for k in np.argsort(sizes)[::-1][:count]:
        ys, xs = np.nonzero(labels == k + 1)
        mask[ys.min() : max(ys.max() + 1, spec.get("bottom", 0)), xs.min() : xs.max() + 1] = True
    return mask


def downsample(mask: np.ndarray) -> np.ndarray:
    w, h = MASK_SIZE
    return mask.reshape(h, mask.shape[0] // h, w, mask.shape[1] // w).mean(axis=(1, 3)) >= 0.5


def overlay(pid: str, masks: list[np.ndarray], path: Path) -> None:
    image = Image.open(EXAMPLES / f"{pid}.jpg").convert("RGB").resize(MASK_SIZE)
    base = np.asarray(image, dtype=np.float32) * 0.6
    for mask in masks:
        edge = mask & ~ndimage.binary_erosion(mask, iterations=2)
        base[mask] = base[mask] * 0.6 + np.array([255, 0, 255]) * 0.4
        base[edge] = (255, 0, 255)
    Image.fromarray(base.astype(np.uint8)).save(path)


def load_map(layer: str, pid: str) -> np.ndarray | None:
    folder = PRECOMPUTED / ("comparisons/" + layer if layer in ("classic-salience", "unisal") else layer)
    path = folder / f"{pid}.json"
    if not path.exists():
        return None
    d = json.loads(path.read_text())
    gw, gh = d["grid"]["width"], d["grid"]["height"]
    values = np.frombuffer(base64.b64decode(d["data"]), dtype="<u2").astype(np.float64).reshape(gh, gw)
    return values / values.sum()


def resample(p: np.ndarray, w: int, h: int) -> np.ndarray:
    """Bilinear with cell centres aligned, renormalised: resample() in src/maps/saliency-map.ts."""
    sh, sw = p.shape
    fy = np.clip((np.arange(h) + 0.5) * sh / h - 0.5, 0, sh - 1)
    fx = np.clip((np.arange(w) + 0.5) * sw / w - 0.5, 0, sw - 1)
    y0 = np.floor(fy).astype(int); y1 = np.minimum(y0 + 1, sh - 1); wy = (fy - y0)[:, None]
    x0 = np.floor(fx).astype(int); x1 = np.minimum(x0 + 1, sw - 1); wx = (fx - x0)[None, :]
    out = (p[np.ix_(y0, x0)] * (1 - wx) + p[np.ix_(y0, x1)] * wx) * (1 - wy) + (p[np.ix_(y1, x0)] * (1 - wx) + p[np.ix_(y1, x1)] * wx) * wy
    return out / out.sum()


def summary(example: dict, regions: list[tuple[dict, np.ndarray]]) -> None:
    ids = [example["a"], example["b"]] + ([example["reference"]] if "reference" in example else [])
    print(f"\n{example['id']}: share of attention in each region, %  ({' | '.join(ids)})")
    for spec, mask in regions:
        for layer in LAYERS:
            cells = []
            for pid in ids:
                p = load_map(layer, pid)
                cells.append("–" if p is None else f"{resample(p, *MASK_SIZE)[mask].sum() * 100:5.2f}")
            print(f"  {spec['id']:10} {layer:17} " + "  ".join(f"{c:>6}" for c in cells))


def main() -> int:
    manifest = json.loads((EXAMPLES / "comparisons.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    for example in manifest["examples"]:
        regions = []
        for spec in REGIONS[example["id"]]:
            source = recoloured if spec["shape"] == "frame" else changed
            mask = downsample(region_mask(source(example["a"], example["b"]), spec))
            regions.append((spec, mask))
        data = {
            "example": example["id"],
            "width": MASK_SIZE[0],
            "height": MASK_SIZE[1],
            "method": (
                f"change in blueness between {example['a']} and {example['b']} (blur {RECOLOUR_BLUR} px, threshold {RECOLOUR_THRESHOLD}) inside a search box, down to the step"
                if any(s["shape"] == "frame" for s in REGIONS[example["id"]])
                else f"pixel difference between {example['a']} and {example['b']} (blur {BLUR} px, threshold {THRESHOLD}) inside a search box"
            )
            + "; tools/comparisons/regions.py",
            "regions": [
                {"id": s["id"], "label": s["label"], "box": list(s["box"]), "share": round(float(m.mean()), 5), "rle": encode_rle(m)}
                for s, m in regions
            ],
        }
        (OUT / f"{example['id']}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
        overlay(example["b"], [m for _, m in regions], CACHE / f"{example['id']}.png")
        for s, m in regions:
            ys, xs = np.nonzero(m)
            print(f"{example['id']:9} {s['id']:9} {m.mean() * 100:5.2f}% of the image, x {xs.min() * 2}–{xs.max() * 2 + 1}, y {ys.min() * 2}–{ys.max() * 2 + 1}")
        summary(example, regions)
    return 0


if __name__ == "__main__":
    sys.exit(main())
