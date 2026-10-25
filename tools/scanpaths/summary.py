"""Recompute the Example section's scanpath measure from the stored files (prompt 076).

The measure: the share of scanpaths with at least one fixation in the manipulated area among their first K
fixations after the starting one (the model's fixations 2 to 1 + K), for A and B and as B − A, with the binomial
standard error of each share and of the difference. For the A images also the measured share over the
participants of Wilming et al. (2017), from the per-participant files of prompt 077: database fixation numbers
2 to 1 + K, number 1 being the fixation on the central cross. Prints the numbers the page shows, so the two can
be compared.
"""

import json
import math
import sys

import numpy as np

from common import EXAMPLES, K, MEASURED, PRECOMPUTED, SCANPATHS_OUT


def mask_for(example: str) -> tuple[np.ndarray, int, int]:
    data = json.loads((PRECOMPUTED / "comparisons" / f"{example}.json").read_text())
    assert len(data["regions"]) == 1, "one manipulated area per example"
    mask = np.zeros(data["width"] * data["height"], dtype=bool)
    at = 0
    for i, run in enumerate(data["regions"][0]["rle"]):
        if i % 2:
            mask[at : at + run] = True
        at += run
    return mask.reshape(data["height"], data["width"]), data["width"], data["height"]


def inside(mask: np.ndarray, x: float, y: float, width: int, height: int) -> bool:
    """A point in image pixels, looked up in the mask; as reachesArea() in src/views/example.ts."""
    mh, mw = mask.shape
    mx, my = math.floor(x * mw / width), math.floor(y * mh / height)
    return 0 <= mx < mw and 0 <= my < mh and bool(mask[my, mx])


def predicted(photo: str, mask: np.ndarray) -> tuple[int, int] | None:
    path = SCANPATHS_OUT / f"{photo}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    w, h, grid = data["width"], data["height"], data["grid"]
    hits = sum(any(inside(mask, gx * w / grid, gy * h / grid, w, h) for gx, gy in p[1 : 1 + K]) for p in data["scanpaths"])
    return hits, len(data["scanpaths"])


def measured(photo: str, mask: np.ndarray) -> tuple[int, int] | None:
    path = MEASURED / f"{photo}.scanpaths.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    w, h = data["width"], data["height"]
    hits = sum(any(2 <= fix <= 1 + K and inside(mask, x, y, w, h) for fix, x, y, _ in p["fixations"]) for p in data["participants"])
    return hits, len(data["participants"])


def se(hits: int, n: int) -> float:
    p = hits / n
    return math.sqrt(p * (1 - p) / n)


def fmt(result: tuple[int, int] | None) -> str:
    if not result:
        return f"{'–':>22}"
    hits, n = result
    return f"{hits:3d}/{n:<3d} {100 * hits / n:5.1f}% ±{100 * se(hits, n):4.1f}"


def main() -> int:
    manifest = json.loads((EXAMPLES / "comparisons.json").read_text())
    print(f"Paths with a fixation in the manipulated area among the first {K} after the start (share ± binomial SE)\n")
    print(f"{'example':10} {'A, predicted':>22} {'B, predicted':>22} {'B − A (points)':>16} {'A, measured':>22}")
    for e in manifest["examples"]:
        mask, _, _ = mask_for(e["id"])
        a, b = predicted(e["a"], mask), predicted(e["b"], mask)
        diff = f"{100 * (b[0] / b[1] - a[0] / a[1]):+6.1f} ±{100 * math.hypot(se(*a), se(*b)):4.1f}" if a and b else "–"
        print(f"{e['id']:10} {fmt(a)} {fmt(b)} {diff:>16} {fmt(measured(e['a'], mask))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
