"""Build the Zürich example photos and their measured fixation maps.

For each listed photo of category 8 ("Urban") in the Osnabrück–Hamburg
eye-tracking database (Wilming et al., 2017), from the Baseline study (Onat,
Açık, Schumann & König, 2014; free viewing for 6 s):

- prepares the photo for the site with scripts/prepare-photos.mjs;
- builds the measured map: every fixation after the first (which starts on
  the central fixation cross) adds one count at its pixel, the counts are
  blurred with a Gaussian of 1 degree (45.6 px), summed into 10 × 10 px cells
  (the shared 128 × 96 grid) and normalised to sum 1;
- writes public/precomputed/measured/<id>.json in the PrecomputedMap format;
- writes public/precomputed/measured/<id>.points.json with the fixations the
  map was built from, for the optional points over the measured layer;
- adds the photos to public/examples/examples.json, after the Dutch ones;
- writes a check overlay per photo to .cache/check/.

Run fetch.py first.
"""

import base64
import io
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import h5py
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CACHE = HERE / ".cache"
EXAMPLES = REPO / "public" / "examples"
OUT = REPO / "public" / "precomputed" / "measured"

WIDTH, HEIGHT = 1280, 960
PIXELS_PER_DEGREE = 45.6
CELL = 10  # px; 1280 × 960 → the shared 128 × 96 grid
VIEWING_SECONDS = 6
CATEGORY = 8

# File number → caption, written after looking at each photo. Places are
# named only where the photo shows them beyond doubt.
TITLES = {
    18: "Shopping lane with people walking",
    19: "Junction with bicycles and a tram stop",
    22: "Street with a crane and an ornate corner building",
    23: "Paradeplatz with a tram and its shelter",
    24: "Tram street with old apartment blocks",
    27: "Side street with parked cars",
    30: "Main station entrance with a tram",
    33: "Residential tower blocks",
    42: "Street corner with parked bicycles",
    46: "Office building behind a playground",
    51: "Zebra crossing at a junction",
    53: "Empty walkway along an office building",
}

CREDIT = {
    "author": "Wilming et al. (2017), Osnabrück–Hamburg eye-tracking database",
    "licence": "CC0 1.0",
    "licenceUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "sourceUrl": "https://doi.org/10.5061/dryad.9pf75",
    "changes": "Converted from PNG to JPEG",
}
CITATION = (
    "Wilming et al. (2017), Scientific Data 4, 160126; "
    "Baseline study: Onat, Açık, Schumann & König (2014), PLoS ONE"
)


def photo_id(n: int) -> str:
    return f"zurich-{n:02d}"


def encode(probability: np.ndarray) -> str:
    """Little-endian uint16 scaled to the maximum, in base64 (as the DeepGaze maps)."""
    scaled = np.round(probability / probability.max() * 65535).astype("<u2")
    return base64.b64encode(scaled.tobytes()).decode("ascii")


def decode(data: str, gw: int, gh: int) -> np.ndarray:
    values = np.frombuffer(base64.b64decode(data), dtype="<u2").astype(np.float64).reshape(gh, gw)
    return values / values.sum()


def fixations(baseline: dict[str, np.ndarray], n: int) -> tuple[np.ndarray, np.ndarray, int]:
    """0-based pixel coordinates of the fixations after the first, and the number of observers."""
    rows = (baseline["category"] == CATEGORY) & (baseline["filenumber"] == n) & (baseline["fix"] > 1)
    x = np.round(baseline["x"][rows] - 1).astype(int)
    y = np.round(baseline["y"][rows] - 1).astype(int)
    inside = (x >= 0) & (x < WIDTH) & (y >= 0) & (y < HEIGHT)
    observers = len(np.unique(baseline["SUBJECTINDEX"][rows][inside]))
    return x[inside], y[inside], observers


def measured_map(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    counts = np.zeros((HEIGHT, WIDTH))
    np.add.at(counts, (y, x), 1)
    density = gaussian_filter(counts, sigma=PIXELS_PER_DEGREE, mode="constant")
    cells = density.reshape(HEIGHT // CELL, CELL, WIDTH // CELL, CELL).sum(axis=(1, 3))
    return cells / cells.sum()


def check_overlay(photo: Image.Image, probability: np.ndarray, x: np.ndarray, y: np.ndarray, path: Path) -> None:
    """Greyed photo, the map as a hot overlay and each fixation as a dot."""
    grey = photo.convert("L").point(lambda v: int(v * 0.6)).convert("RGB")
    heat = np.asarray(Image.fromarray((probability / probability.max() * 255).astype(np.uint8)).resize((WIDTH, HEIGHT), Image.BILINEAR)) / 255
    rgb = np.stack([np.clip(3 * heat, 0, 1), np.clip(3 * heat - 1, 0, 1), np.clip(3 * heat - 2, 0, 1)], axis=-1)
    alpha = (0.85 * heat**0.7)[..., None]
    blended = np.asarray(grey) / 255 * (1 - alpha) + rgb * alpha
    out = Image.fromarray((blended * 255).astype(np.uint8))
    draw = ImageDraw.Draw(out)
    for px, py in zip(x, y):
        draw.ellipse((px - 2, py - 2, px + 2, py + 2), fill=(0, 220, 255))
    out.save(path)


def main() -> int:
    hdf5, stimuli = CACHE / "etdb_v1.0.hdf5", CACHE / "Stimuli_8.zip"
    if not (hdf5.exists() and stimuli.exists()):
        print("Run fetch.py first.", file=sys.stderr)
        return 1

    photos_dir, check_dir = CACHE / "photos", CACHE / "check"
    shutil.rmtree(photos_dir, ignore_errors=True)
    photos_dir.mkdir(parents=True)
    check_dir.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(stimuli) as z:
        for n in TITLES:
            (photos_dir / f"{photo_id(n)}.png").write_bytes(z.read(f"8/{n}.png"))
    prepared = subprocess.run(
        ["node", "scripts/prepare-photos.mjs", str(photos_dir.relative_to(REPO)), "public/examples"],
        cwd=REPO, check=True, capture_output=True, text=True,
    )
    sizes = {p["id"]: (p["width"], p["height"]) for p in map(json.loads, prepared.stdout.splitlines())}

    with h5py.File(hdf5, "r") as f:
        baseline = {k: f["Baseline"][k][:].ravel() for k in ("category", "filenumber", "fix", "x", "y", "SUBJECTINDEX")}

    entries = []
    print(f"{'id':10} {'observers':>9} {'fixations':>9} {'map sum':>10}")
    for n, title in TITLES.items():
        pid = photo_id(n)
        if sizes[pid] != (WIDTH, HEIGHT):
            print(f"{pid}: expected {WIDTH} × {HEIGHT}, got {sizes[pid]}", file=sys.stderr)
            return 1
        x, y, observers = fixations(baseline, n)
        probability = measured_map(x, y)
        gh, gw = probability.shape
        data = {
            "model": "measured",
            "photo": pid,
            "grid": {"width": gw, "height": gh},
            "encoding": "uint16-base64",
            "data": encode(probability),
        }
        (OUT / f"{pid}.json").write_text(json.dumps(data))
        points = {"photo": pid, "width": WIDTH, "height": HEIGHT, "observers": observers, "points": np.stack([x, y], axis=1).tolist()}
        (OUT / f"{pid}.points.json").write_text(json.dumps(points, separators=(",", ":")))
        check_overlay(Image.open(photos_dir / f"{pid}.png").convert("RGB"), probability, x, y, check_dir / f"{pid}.png")
        decoded = decode(data["data"], gw, gh)
        print(f"{pid:10} {observers:9d} {len(x):9d} {decoded.sum():10.6f}")
        entries.append({
            "id": pid,
            "area": "Zürich",
            "city": "Zürich",
            "title": title,
            "file": f"{pid}.jpg",
            "width": WIDTH,
            "height": HEIGHT,
            **CREDIT,
            "measured": {
                "observers": observers,
                "fixations": int(len(x)),
                "viewingSeconds": VIEWING_SECONDS,
                "citation": CITATION,
            },
        })

    manifest = EXAMPLES / "examples.json"
    photos = [p for p in json.loads(manifest.read_text()) if p["area"] != "Zürich"]
    manifest.write_text(json.dumps(photos + entries, indent=2, ensure_ascii=False) + "\n")
    print(f"\nWrote {len(entries)} maps to {OUT.relative_to(REPO)} and {len(photos) + len(entries)} photos to {manifest.relative_to(REPO)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
