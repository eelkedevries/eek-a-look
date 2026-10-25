"""Write the 3-second window of the measured gaze paths of the A images (prompt 076).

DeepGaze3.5-VL predicts 3 s of free viewing; the measured paths of Wilming et al. (2017) cover 6 s. On the owner's
decision of 2026-10-25, a comparison with the measured paths uses only their first 3 s. For each participant of
each A image of comparisons.json, this writes the last fixation number (the database's `fix`) whose start lies
within the first 3,000 ms after image onset, from the Baseline rows also read by tools/measured-gaze/. No timing is
published: the page keeps a participant's fixations 2 to that number from the per-participant files of prompt 077.

Writes public/precomputed/measured/<id>.window3s.json. Needs tools/measured-gaze/.cache/etdb_v1.0.hdf5 (run
tools/measured-gaze/fetch.py first).
"""

import json
import sys

import h5py
import numpy as np

from common import EXAMPLES, MEASURED, REPO, write_json

SOURCE = REPO / "tools" / "measured-gaze" / ".cache" / "etdb_v1.0.hdf5"
CATEGORY = 8
WINDOW_MS = 3000


def main() -> int:
    if not SOURCE.exists():
        print("Run tools/measured-gaze/fetch.py first.", file=sys.stderr)
        return 1
    with h5py.File(SOURCE, "r") as f:
        baseline = {k: f["Baseline"][k][:].ravel() for k in ("category", "filenumber", "fix", "start", "SUBJECTINDEX")}

    manifest = json.loads((EXAMPLES / "comparisons.json").read_text())
    for pid in sorted({e["a"] for e in manifest["examples"]}):
        n = int(pid.split("-")[1])
        rows = (baseline["category"] == CATEGORY) & (baseline["filenumber"] == n) & (baseline["fix"] > 1)
        last: dict[int, int] = {}
        for s in map(int, np.unique(baseline["SUBJECTINDEX"][rows])):
            own = rows & (baseline["SUBJECTINDEX"] == s)
            if np.any(np.diff(baseline["start"][own][np.argsort(baseline["fix"][own])]) <= 0):
                raise ValueError(f"{pid}: participant {s} has start times out of order")
            inside = baseline["fix"][own][baseline["start"][own] < WINDOW_MS]
            last[s] = int(inside.max()) if inside.size else 1
        # The participants must be those of the per-participant file the page reads.
        paths = json.loads((MEASURED / f"{pid}.scanpaths.json").read_text())
        if sorted(p["index"] for p in paths["participants"]) != sorted(last):
            raise ValueError(f"{pid}: participants differ from {pid}.scanpaths.json")
        write_json(
            MEASURED / f"{pid}.window3s.json",
            {
                "photo": pid,
                "windowMs": WINDOW_MS,
                "settings": {
                    "tool": "tools/scanpaths/window.py (prompt 076)",
                    "source": f"etdb_v1.0.hdf5, Baseline study, category {CATEGORY}, file {n} (Wilming et al. 2017)",
                    "rule": f"per participant, the last fixation number after the first (on the central cross) that starts within {WINDOW_MS} ms of image onset; 1 if none",
                },
                "lastFix": [[s, last[s]] for s in sorted(last)],
            },
        )
        counts = [last[s] - 1 for s in last]
        print(f"{pid}: {len(last)} participants; fixation numbers 2 to {min(last.values())}–{int(np.median(list(last.values())))}–{max(last.values())} (min–median–max); up to {max(counts)} fixations each")
    return 0


if __name__ == "__main__":
    sys.exit(main())
