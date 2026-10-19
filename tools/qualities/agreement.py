"""Agreement of each method with expert labels (prompt 043).

  uv run agreement.py --labels FILE.csv [FILE.csv ...]
  uv run agreement.py --template     rewrite labels_template.csv

Each FILE.csv has the columns photo, principle, label, rater, note, where label
is present, absent or ambiguous (the scale of the 2020 panel) and principle is
rhythm, groundFloor or materials; the rating page (rate.html, prompt 059)
downloads this format. Rows with an empty label are skipped; an empty rater
is named after its file. With several raters, the script first reports how
far they agree with each other: Krippendorff's alpha per principle, nominal
and ordinal (absent < ambiguous < present). Their majority label then counts
per photo and principle (a tie is ambiguous).

For each method that has a file, the script reports per principle the
percentage agreement and Cohen's kappa with the labels, with n:
- image measure (likely present → present, unclear → ambiguous, likely
  absent → absent);
- simulated panel v1 (its consensus);
- graded panel (prompt 044): median ≥ 3 → present, ≤ 1 → absent, otherwise
  ambiguous;
- UP-CLIP reproduction and plain CLIP (prompt 046): principle score above the
  photo set's upper tercile → present, below the lower tercile → absent,
  otherwise ambiguous.
The last two mappings are this project's, fixed here before any labels exist.
"""

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np

from shared import HERE, OUT, PRINCIPLES, REPO, photos

TEMPLATE = HERE / "labels_template.csv"
LABELS = ("present", "absent", "ambiguous")
PRECOMPUTED = REPO / "public" / "precomputed"


def write_template() -> None:
    with TEMPLATE.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["photo", "principle", "label", "rater", "note"])
        for photo in photos():
            for principle in PRINCIPLES:
                w.writerow([photo["id"], principle, "", "", ""])


def read_votes(paths: list[Path]) -> dict[tuple[str, str], dict[str, str]]:
    """(photo, principle) → {rater: label}; a rater's later row for the same pair replaces the earlier one."""
    votes: dict[tuple[str, str], dict[str, str]] = {}
    for path in paths:
        with path.open(newline="") as f:
            for row in csv.DictReader(f):
                label = row["label"].strip().lower()
                if not label:
                    continue
                if label not in LABELS or row["principle"] not in PRINCIPLES:
                    raise SystemExit(f"Unknown label or principle in row: {row}")
                rater = (row.get("rater") or "").strip() or path.stem
                votes.setdefault((row["photo"], row["principle"]), {})[rater] = label
    return votes


ORDER = {"absent": 0, "ambiguous": 1, "present": 2}


def krippendorff(units: list[list[str]], ordinal: bool) -> float | None:
    """Krippendorff's alpha for units with two or more values; nominal, or ordinal on absent < ambiguous < present."""
    units = [u for u in units if len(u) >= 2]
    if not units:
        return None
    k = len(ORDER)
    o = np.zeros((k, k))
    for u in units:
        values = [ORDER[v] for v in u]
        m = len(values)
        for i, a in enumerate(values):
            for j, b in enumerate(values):
                if i != j:
                    o[a, b] += 1 / (m - 1)
    n_c = o.sum(1)
    n = n_c.sum()
    if ordinal:
        delta = np.zeros((k, k))
        for c in range(k):
            for d in range(k):
                lo, hi = min(c, d), max(c, d)
                delta[c, d] = (n_c[lo:hi + 1].sum() - (n_c[c] + n_c[d]) / 2) ** 2
    else:
        delta = 1 - np.eye(k)
    d_o = (o * delta).sum() / n
    d_e = (np.outer(n_c, n_c) * delta).sum() / (n * (n - 1))
    return float(1 - d_o / d_e) if d_e > 0 else None


def read_labels(paths: list[Path]) -> dict[tuple[str, str], str]:
    votes = {key: list(by_rater.values()) for key, by_rater in read_votes(paths).items()}
    out = {}
    for key, labels in votes.items():
        top = Counter(labels).most_common()
        out[key] = top[0][0] if len(top) == 1 or top[0][1] > top[1][1] else "ambiguous"
    return out


def methods() -> dict[str, dict[tuple[str, str], str]]:
    found: dict[str, dict[tuple[str, str], str]] = {}
    measure = {"likely-present": "present", "likely-absent": "absent", "unclear": "ambiguous"}
    found["image measure"] = {(p["id"], k): measure[r["outcome"]]
                              for p in photos() if (OUT / f"{p['id']}.json").exists()
                              for k, r in json.loads((OUT / f"{p['id']}.json").read_text())["principles"].items()}
    panel = PRECOMPUTED / "vlm-panel" / "panel.json"
    if panel.exists():
        found["simulated panel v1"] = {(pid, k): v["consensus"] for pid, e in json.loads(panel.read_text())["photos"].items() for k, v in e.items()}
    graded = PRECOMPUTED / "vlm-panel" / "panel-graded.json"
    if graded.exists():
        to = lambda m: "present" if m >= 3 else "absent" if m <= 1 else "ambiguous"
        found["graded panel"] = {(pid, k): to(v["median"]) for pid, e in json.loads(graded.read_text())["photos"].items()
                                 for k, v in e.items() if v["median"] is not None}
    scores = PRECOMPUTED / "up-clip" / "scores.json"
    if scores.exists():
        data = json.loads(scores.read_text())
        for model in data["models"]:
            per = data["principleScores"][model["id"]]
            mapped = {}
            for principle in PRINCIPLES:
                values = {pid: s[principle] for pid, s in per.items()}
                lo, hi = np.percentile(list(values.values()), [100 / 3, 200 / 3])
                for pid, v in values.items():
                    mapped[(pid, principle)] = "present" if v > hi else "absent" if v < lo else "ambiguous"
            found[model["name"]] = mapped
    return found


def cohen_kappa(a: list[str], b: list[str]) -> float | None:
    n = len(a)
    if n == 0:
        return None
    po = sum(x == y for x, y in zip(a, b)) / n
    pe = sum((a.count(k) / n) * (b.count(k) / n) for k in LABELS)
    return None if pe == 1 else (po - pe) / (1 - pe)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--labels", type=Path, nargs="+")
    parser.add_argument("--template", action="store_true")
    args = parser.parse_args()
    if args.template:
        write_template()
        print(f"wrote {TEMPLATE.relative_to(REPO)}")
    if not args.labels:
        return 0
    votes = read_votes(args.labels)
    raters = sorted({r for by_rater in votes.values() for r in by_rater})
    print(f"Raters: {', '.join(raters)} ({len(args.labels)} file(s))")
    if len(raters) >= 2:
        f = lambda v: "–" if v is None else f"{v:.2f}"
        print(f"\n{'principle':12} {'pairs':>5} {'alpha nominal':>14} {'alpha ordinal':>14}")
        for principle in PRINCIPLES:
            units = [list(v.values()) for k, v in votes.items() if k[1] == principle and len(v) >= 2]
            print(f"{principle:12} {len(units):>5} {f(krippendorff(units, False)):>14} {f(krippendorff(units, True)):>14}")
    labels = read_labels(args.labels)
    print(f"\n{len(labels)} labelled photo × principle pairs (majority label)\n")
    print(f"{'method':34} {'principle':12} {'n':>3} {'agree':>6} {'kappa':>6}")
    for name, values in methods().items():
        for principle in PRINCIPLES:
            keys = [k for k in labels if k[1] == principle and k in values]
            a, b = [labels[k] for k in keys], [values[k] for k in keys]
            agree = sum(x == y for x, y in zip(a, b)) / len(keys) if keys else None
            kappa = cohen_kappa(a, b)
            f = lambda v: "–" if v is None else f"{v:.2f}"
            print(f"{name:34} {principle:12} {len(keys):>3} {f(agree):>6} {f(kappa):>6}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
