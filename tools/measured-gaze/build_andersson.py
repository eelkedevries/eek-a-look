"""Build the Andersson et al. (2017) photos and their measured fixation maps.

Andersson, Larsson, Holmqvist, Stridh & Nyström (2017), Behavior Research
Methods 49, 616–637: students at Lund University viewed photos freely on a
1024 × 768 screen (0.38 × 0.30 m, 0.67 m away), recorded with an SMI Hi-Speed
1250 (right eye). Two experts labelled every sample by hand. For each of the
four photos with recordings:

- prepares the photo for the site with scripts/prepare-photos.mjs (it stays
  1024 × 768, the screen size, so screen pixels are photo pixels);
- takes coder MN's labels of the recordings used in the article, with Zemblys
  et al.'s (2018) correction of one file: a fixation is a run of samples
  labelled 1, placed at the mean position of its samples that have gaze; the
  first fixation of each recording is dropped (every viewing starts at the
  centre of the screen), and fixations outside the photo are dropped;
- builds the measured map: one count per fixation, not weighted by duration,
  a Gaussian blur of 1 degree (31.5 px across, 29.9 px down, from the
  recorded screen geometry), summed into 8 × 8 px cells (the shared
  128 × 96 grid) and normalised to sum 1;
- writes public/precomputed/measured/<id>.json and <id>.points.json in the
  formats of the Zürich photos;
- adds the photos to public/examples/examples.json, after the Zürich ones,
  and writes the licence notice public/examples/andersson-2017-NOTICE.txt;
- writes a check overlay per photo to .cache/andersson/check/ and compares
  each map with one built from coder RA's labels of the same recordings.

Run fetch_andersson.py first.
"""

import base64
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.io import loadmat
from scipy.ndimage import gaussian_filter

from fetch_andersson import CACHE, COMMIT, REPOSITORY

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
EXAMPLES = REPO / "public" / "examples"
OUT = REPO / "public" / "precomputed" / "measured"
ARTICLE = CACHE / "annotated_data" / "data used in the article" / "img"
CORRECTED = CACHE / "annotated_data" / "fix_by_Zemblys2018"
NOTICE = "andersson-2017-NOTICE.txt"

WIDTH, HEIGHT = 1024, 768
CELL = 8  # px; 1024 × 768 → the shared 128 × 96 grid
FIXATION = 1  # sample label in the sixth column
AREA = "Andersson et al. (2017)"
CONVERTED = "19 October 2026"

# Stimulus name → id, caption written after looking at the photo, and the city where the photo shows it beyond doubt.
PHOTOS = {
    "Rome": ("andersson-rome", "The Colosseum with visitors", "Rome"),
    "Europe": ("andersson-europe", "Stone building behind a planted steel façade", None),
    "vy": ("andersson-vy", "Cycle path beside a horse pasture", None),
    "konijntjes": ("andersson-konijntjes", "Two rabbits in a wicker basket", None),
}
# The photo recordings used in the article, by participant code; each is one person and one photo.
RECORDINGS = {
    "Rome": ["UH21", "UL43"],
    "Europe": ["TH34", "UH29", "UH47", "UL23"],
    "vy": ["TH34", "UH27", "UH33"],
    "konijntjes": ["TL20", "TL28", "UL31", "UL39", "UL47"],
}

CREDIT = {
    "author": "Andersson et al. (2017), Lund University Humanities Lab",
    "licence": "GNU GPL 3.0",
    "licenceUrl": "https://www.gnu.org/licenses/gpl-3.0.html",
}
CITATION = "Andersson, Larsson, Holmqvist, Stridh & Nyström (2017), Behavior Research Methods 49, 616–637; hand labels of coder MN"


def label_file(code: str, name: str, coder: str) -> Path:
    corrected = CORRECTED / f"{code}_img_{name}_labelled_FIX_{coder}.mat"
    return corrected if corrected.exists() else ARTICLE / f"{code}_img_{name}_labelled_{coder}.mat"


def recording(path: Path) -> tuple[np.ndarray, dict]:
    """Fixation centres (screen pixels) in order, and the recording's set-up."""
    et = loadmat(path, squeeze_me=True, struct_as_record=False)["ETdata"]
    pos = np.asarray(et.pos, dtype=float)
    # Rows without gaze (both coordinates 0, or padding with timestamp 0) are left out of every position.
    has_gaze = (pos[:, 0] > 0) & ~((pos[:, 3] == 0) & (pos[:, 4] == 0))
    edges = np.diff(np.r_[0, (pos[:, 5] == FIXATION).astype(int), 0])
    runs = zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1))
    centres = np.array([pos[s:e][has_gaze[s:e], 3:5].mean(axis=0) for s, e in runs if has_gaze[s:e].any()])
    t = pos[has_gaze, 0]
    setup = {
        "screenRes": tuple(int(v) for v in et.screenRes),
        "screenDim": tuple(float(v) for v in et.screenDim),
        "viewDist": float(et.viewDist),
        "seconds": (t[-1] - t[0]) / 1e6 + float(np.median(np.diff(t))) / 1e6,
    }
    return centres, setup


def to_pixels(centres: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """0-based photo pixels of the fixations after the first, inside the photo."""
    x, y = np.floor(centres[1:, 0]).astype(int), np.floor(centres[1:, 1]).astype(int)
    inside = (x >= 0) & (x < WIDTH) & (y >= 0) & (y < HEIGHT)
    return x[inside], y[inside]


def pixels_per_degree(setup: dict) -> tuple[float, float]:
    """Pixels spanning 1 degree at the screen centre, across and down (the inverse of the authors' pixels2degrees.m)."""
    span = 2 * setup["viewDist"] * math.tan(math.radians(0.5))
    return tuple(span / (dim / res) for dim, res in zip(setup["screenDim"], setup["screenRes"]))


def measured_map(x: np.ndarray, y: np.ndarray, sigma: tuple[float, float]) -> np.ndarray:
    counts = np.zeros((HEIGHT, WIDTH))
    np.add.at(counts, (y, x), 1)
    density = gaussian_filter(counts, sigma=sigma, mode="constant")
    cells = density.reshape(HEIGHT // CELL, CELL, WIDTH // CELL, CELL).sum(axis=(1, 3))
    return cells / cells.sum()


def encode(probability: np.ndarray) -> str:
    """Little-endian uint16 scaled to the maximum, in base64 (as the DeepGaze maps)."""
    scaled = np.round(probability / probability.max() * 65535).astype("<u2")
    return base64.b64encode(scaled.tobytes()).decode("ascii")


def decode(data: str, gw: int, gh: int) -> np.ndarray:
    values = np.frombuffer(base64.b64decode(data), dtype="<u2").astype(np.float64).reshape(gh, gw)
    return values / values.sum()


def check_overlay(photo: Image.Image, probability: np.ndarray, mn: tuple, ra: tuple, path: Path) -> None:
    """Greyed photo, the map as a hot overlay, MN's fixations as cyan dots and RA's as small magenta ones."""
    grey = photo.convert("L").point(lambda v: int(v * 0.6)).convert("RGB")
    heat = np.asarray(Image.fromarray((probability / probability.max() * 255).astype(np.uint8)).resize((WIDTH, HEIGHT), Image.BILINEAR)) / 255
    rgb = np.stack([np.clip(3 * heat, 0, 1), np.clip(3 * heat - 1, 0, 1), np.clip(3 * heat - 2, 0, 1)], axis=-1)
    alpha = (0.85 * heat**0.7)[..., None]
    blended = np.asarray(grey) / 255 * (1 - alpha) + rgb * alpha
    out = Image.fromarray((blended * 255).astype(np.uint8))
    draw = ImageDraw.Draw(out)
    for (xs, ys), colour, r in ((mn, (0, 220, 255), 4), (ra, (255, 0, 200), 2)):
        for px, py in zip(xs, ys):
            draw.ellipse((px - r, py - r, px + r, py + r), fill=colour)
    out.save(path)


def write_notice() -> None:
    text = f"""Photos and measured gaze from Andersson et al. (2017)

The files listed below are distributed under the GNU General Public License,
version 3, under which the authors released the data and stimuli. The full
text of the licence follows.

Source: Andersson, R., Larsson, L., Holmqvist, K., Stridh, M. & Nyström, M.
(2017). One algorithm to rule them all? An evaluation and discussion of ten
eye movement event-detection algorithms. Behavior Research Methods, 49(2),
616-637. https://doi.org/10.3758/s13428-016-0738-9

Data and stimuli: https://github.com/{REPOSITORY}
at commit {COMMIT}. The original PNG photos and .mat recordings there are the
source form of the files below.

Files on this site derived from them ({', '.join(pid for pid, _, _ in PHOTOS.values())}):
- examples/<id>.jpg and examples/<id>-thumb.jpg: the PNG photos converted to
  JPEG (quality 82, no metadata) with 320 px thumbnails, on {CONVERTED};
- precomputed/measured/<id>.json and <id>.points.json: the fixations from the
  hand labels of coder MN and the maps built from them;
- precomputed/deepgaze-iie/<id>.json, precomputed/deepgaze-msdb/<id>.json,
  precomputed/areas/<id>.json and precomputed/qualities/<id>.json: maps and
  areas computed from the photos.
The scripts that make them are in tools/measured-gaze/ of
https://github.com/eelkedevries/eek-a-look.

------------------------------------------------------------------------------

"""
    (EXAMPLES / NOTICE).write_text(text + (CACHE / "LICENSE").read_text(encoding="utf-8"), encoding="utf-8")


def main() -> int:
    missing = [p for p in [CACHE / "LICENSE", ARTICLE] if not p.exists()]
    if missing:
        print("Run fetch_andersson.py first.", file=sys.stderr)
        return 1

    photos_dir, check_dir = CACHE / "photos", CACHE / "check"
    shutil.rmtree(photos_dir, ignore_errors=True)
    photos_dir.mkdir(parents=True)
    check_dir.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    for name, (pid, _, _) in PHOTOS.items():
        shutil.copyfile(CACHE / "Stimuli" / "images" / f"{name}1024x768.png", photos_dir / f"{pid}.png")
    prepared = subprocess.run(
        ["node", "scripts/prepare-photos.mjs", str(photos_dir.relative_to(REPO)), "public/examples"],
        cwd=REPO, check=True, capture_output=True, text=True,
    )
    sizes = {p["id"]: (p["width"], p["height"]) for p in map(json.loads, prepared.stdout.splitlines())}

    entries, setups, starts = [], [], []
    print(f"{'id':22} {'observers':>9} {'fixations':>9} {'outside':>7} {'map sum':>9} {'RA fixations':>12} {'r MN–RA':>8}")
    for name, (pid, title, city) in PHOTOS.items():
        if sizes[pid] != (WIDTH, HEIGHT):
            print(f"{pid}: expected {WIDTH} × {HEIGHT}, got {sizes[pid]}", file=sys.stderr)
            return 1
        points, ra_points, outside = [], [], 0
        for code in RECORDINGS[name]:
            centres, setup = recording(label_file(code, name, "MN"))
            setups.append(setup)
            starts.append(centres[0])
            x, y = to_pixels(centres)
            outside += len(centres) - 1 - len(x)
            points.append(np.stack([x, y], axis=1))
            ra_points.append(np.stack(to_pixels(recording(label_file(code, name, "RA"))[0]), axis=1))
        if any(s != {**setups[0], "seconds": s["seconds"]} for s in setups):
            print("The recordings differ in screen or viewing distance.", file=sys.stderr)
            return 1
        ppd_x, ppd_y = pixels_per_degree(setups[0])
        xy, ra = np.concatenate(points), np.concatenate(ra_points)
        probability = measured_map(xy[:, 0], xy[:, 1], (ppd_y, ppd_x))
        ra_probability = measured_map(ra[:, 0], ra[:, 1], (ppd_y, ppd_x))
        gh, gw = probability.shape
        data = {"model": "measured", "photo": pid, "grid": {"width": gw, "height": gh}, "encoding": "uint16-base64", "data": encode(probability)}
        (OUT / f"{pid}.json").write_text(json.dumps(data))
        observers = len(RECORDINGS[name])
        points_file = {"photo": pid, "width": WIDTH, "height": HEIGHT, "observers": observers, "points": xy.tolist()}
        (OUT / f"{pid}.points.json").write_text(json.dumps(points_file, separators=(",", ":")))
        check_overlay(Image.open(photos_dir / f"{pid}.png").convert("RGB"), probability, (xy[:, 0], xy[:, 1]), (ra[:, 0], ra[:, 1]), check_dir / f"{pid}.png")
        r = np.corrcoef(probability.ravel(), ra_probability.ravel())[0, 1]
        print(f"{pid:22} {observers:9d} {len(xy):9d} {outside:7d} {decode(data['data'], gw, gh).sum():9.6f} {len(ra):12d} {r:8.3f}")
        entries.append({
            "id": pid,
            "area": AREA,
            **({"city": city} if city else {}),
            "title": title,
            "file": f"{pid}.jpg",
            "width": WIDTH,
            "height": HEIGHT,
            **CREDIT,
            "sourceUrl": f"https://github.com/{REPOSITORY}/blob/{COMMIT}/Stimuli/images/{name}1024x768.png",
            "changes": f"Converted from PNG to JPEG on {CONVERTED}",
            "measured": {
                "observers": observers,
                "fixations": len(xy),
                "viewingSeconds": round(float(np.median([s["seconds"] for s in setups[-observers:]]))),
                "citation": CITATION,
            },
        })

    start = np.array(starts)
    off_centre = np.hypot(start[:, 0] - WIDTH / 2, start[:, 1] - HEIGHT / 2)
    seconds = [s["seconds"] for s in setups]
    print(f"\n1 degree = {ppd_x:.1f} px across, {ppd_y:.1f} px down; recordings {min(seconds):.2f}–{max(seconds):.2f} s.")
    print(f"Dropped first fixations: median {np.median(off_centre):.0f} px from the screen centre "
          f"({np.sum(off_centre < ppd_x * 2)} of {len(off_centre)} within 2 degrees).")

    write_notice()
    manifest = EXAMPLES / "examples.json"
    photos = [p for p in json.loads(manifest.read_text()) if p["area"] != AREA]
    after = max((i for i, p in enumerate(photos) if p["area"] == "Zürich"), default=len(photos) - 1) + 1
    photos[after:after] = entries
    manifest.write_text(json.dumps(photos, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(entries)} maps to {OUT.relative_to(REPO)}, {NOTICE} and {len(photos)} photos to {manifest.relative_to(REPO)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
