"""Sample predicted fixations from the DeepGaze MSDB maps of the six images of the Example section.

Each point is an independent draw from the stored MSDB map (public/precomputed/deepgaze-msdb/<photo>.json, the
map the heatmap shows): a grid cell is drawn with its probability, then a position uniformly within the cell.
The points have no order: MSDB predicts where people look, not in which sequence. Runs on the CPU in a second.

Writes public/precomputed/deepgaze-msdb-fixations/<photo>.json.
"""

import base64
import json
import sys

import numpy as np

from common import FIXATIONS_OUT, MSDB_FIXATIONS_PER_IMAGE, MSDB_MAPS, REPO, photos, seed_for, sha256, write_json


def decode(data: str, gw: int, gh: int) -> np.ndarray:
    values = np.frombuffer(base64.b64decode(data), dtype="<u2").astype(np.float64).reshape(gh, gw)
    return values / values.sum()


def sample(probability: np.ndarray, width: int, height: int, count: int, seed: int) -> np.ndarray:
    gh, gw = probability.shape
    rng = np.random.default_rng(seed)
    cells = rng.choice(gw * gh, size=count, p=probability.ravel())
    offsets = rng.random((count, 2))
    x = (cells % gw + offsets[:, 0]) * width / gw
    y = (cells // gw + offsets[:, 1]) * height / gh
    return np.round(np.stack([x, y], axis=1), 1)


def main() -> int:
    for photo in photos():
        source = MSDB_MAPS / f"{photo['id']}.json"
        payload = json.loads(source.read_text())
        gw, gh = payload["grid"]["width"], payload["grid"]["height"]
        seed = seed_for(photo["id"])
        points = sample(decode(payload["data"], gw, gh), photo["width"], photo["height"], MSDB_FIXATIONS_PER_IMAGE, seed)
        write_json(
            FIXATIONS_OUT / f"{photo['id']}.json",
            {
                "model": "deepgaze-msdb",
                "photo": photo["id"],
                "width": photo["width"],
                "height": photo["height"],
                "settings": {
                    "tool": "tools/scanpaths/fixations.py (prompt 076)",
                    "source": f"{source.relative_to(REPO).as_posix()} (sha256 {sha256(source)})",
                    "method": "independent draws from the stored map: a grid cell with its probability, then a uniform position within the cell",
                    "grid": {"width": gw, "height": gh},
                    "count": MSDB_FIXATIONS_PER_IMAGE,
                    "seed": seed,
                    "rng": f"numpy.random.default_rng, numpy {np.__version__}",
                    "coordinates": "0-based pixels of the image, 0.1 px",
                },
                "points": points.tolist(),
            },
        )
        print(f"{photo['id']:28} {len(points)} points, seed {seed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
