"""Write the measured fixations of each Zürich photo per participant, in their order.

Reads the same Baseline rows as build.py (Wilming et al., 2017; Onat, Açık,
Schumann & König, 2014): category 8, the photo's file number, every fixation
after the first (which starts on the central fixation cross), 1-based pixels
made 0-based, points outside the image dropped. Per participant (the
database's anonymous SUBJECTINDEX) it keeps, for each fixation in its order,
the database's fixation number, x, y and pupil size, and writes
public/precomputed/measured/<id>.scanpaths.json.

Pooling the participants' fixations must reproduce <id>.points.json exactly,
in the same order; the script stops with an error if it does not. No other
file is written. Run fetch.py first.
"""

import json
import sys

import h5py
import numpy as np

from build import CACHE, CATEGORY, HEIGHT, OUT, REPO, TITLES, WIDTH, photo_id

FIELDS = ["fix", "x", "y", "pupil"]


def pupil(value: np.float32) -> float:
    """The shortest decimal that reads back as the stored float32, so nothing is lost or invented."""
    return float(np.format_float_positional(value, unique=True))


def scanpaths(baseline: dict[str, np.ndarray], n: int) -> list[dict]:
    rows = (baseline["category"] == CATEGORY) & (baseline["filenumber"] == n) & (baseline["fix"] > 1)
    x = np.round(baseline["x"][rows] - 1).astype(int)
    y = np.round(baseline["y"][rows] - 1).astype(int)
    inside = (x >= 0) & (x < WIDTH) & (y >= 0) & (y < HEIGHT)
    subject = baseline["SUBJECTINDEX"][rows][inside].astype(int)
    fix = baseline["fix"][rows][inside].astype(int)
    size = baseline["pupil"][rows][inside]
    x, y = x[inside], y[inside]
    participants = []
    # The rows of a photo are grouped by participant in ascending order, fixations ascending within each, so this
    # keeps the row order of points.json.
    for s in dict.fromkeys(subject.tolist()):
        own = subject == s
        if np.any(np.diff(fix[own]) <= 0):
            raise ValueError(f"{photo_id(n)}: participant {s} has fixation numbers out of order")
        participants.append({
            "index": s,
            "fixations": [[int(f), int(px), int(py), pupil(p)] for f, px, py, p in zip(fix[own], x[own], y[own], size[own])],
        })
    return participants


def main() -> int:
    hdf5 = CACHE / "etdb_v1.0.hdf5"
    if not hdf5.exists():
        print("Run fetch.py first.", file=sys.stderr)
        return 1
    with h5py.File(hdf5, "r") as f:
        baseline = {k: f["Baseline"][k][:].ravel() for k in ("category", "filenumber", "fix", "x", "y", "SUBJECTINDEX", "pupil")}

    print(f"{'id':10} {'people':>6} {'fixations':>9} {'per person':>12} {'gaps':>4}  pooled = points.json")
    failed = False
    for n in TITLES:
        pid = photo_id(n)
        participants = scanpaths(baseline, n)
        pooled = [[px, py] for p in participants for _, px, py, _ in p["fixations"]]
        points = json.loads((OUT / f"{pid}.points.json").read_text())
        same = pooled == points["points"] and len(participants) == points["observers"]
        failed |= not same
        counts = [len(p["fixations"]) for p in participants]
        # Fixation numbers the database does not hold between a participant's first and last kept fixation.
        gaps = sum(p["fixations"][-1][0] - p["fixations"][0][0] + 1 - len(p["fixations"]) for p in participants)
        print(f"{pid:10} {len(participants):6d} {len(pooled):9d} {min(counts):4d}–{int(np.median(counts))}–{max(counts):<4d} {gaps:4d}  {'yes' if same else 'NO'}")
        if not same:
            continue
        data = {"photo": pid, "width": WIDTH, "height": HEIGHT, "observers": len(participants), "fields": FIELDS, "participants": participants}
        (OUT / f"{pid}.scanpaths.json").write_text(json.dumps(data, separators=(",", ":")))

    if failed:
        print("\nPooling did not reproduce points.json for every photo; those files were not written.", file=sys.stderr)
        return 1
    print(f"\nWrote {len(TITLES)} scanpath files to {OUT.relative_to(REPO)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
