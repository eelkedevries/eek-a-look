"""Check the authors' 1k sample before training (prompt 045): exact duplicate
images under different file names, and how many fall on both sides of the
script's own 80/20 split (seed 42). Writes .cache/datacheck.json, which
evaluate.py and retrieval.json report."""

import json
import sys
from collections import defaultdict

from split import CSV, HERE, image_hash, split

OUT = HERE / ".cache" / "datacheck.json"


def main() -> int:
    train, test = split()
    rows = {"train": train, "test": test}
    groups = defaultdict(list)  # image hash → [(part, filename)]
    for part, df in rows.items():
        for name in df["filename"]:
            groups[image_hash(name)].append((part, name))
    duplicates = {h: g for h, g in groups.items() if len(g) > 1}
    crossing = {h: g for h, g in duplicates.items() if {p for p, _ in g} == {"train", "test"}}
    test_leaked = sum(1 for g in crossing.values() for p, _ in g if p == "test")
    same_caption = 0
    for g in duplicates.values():
        names = [n for _, n in g]
        texts = {t for n, t in zip(train["filename"].tolist() + test["filename"].tolist(),
                                   train["text"].tolist() + test["text"].tolist()) if n in names}
        same_caption += len(texts) == 1
    result = {
        "pairs": len(train) + len(test), "train": len(train), "test": len(test),
        "distinctImages": len(groups),
        "duplicateGroups": len(duplicates),
        "imagesInDuplicateGroups": sum(len(g) for g in duplicates.values()),
        "groupsAcrossSplit": len(crossing),
        "testPairsWhoseImageIsAlsoInTrain": test_leaked,
        "duplicateGroupsWithIdenticalCaptions": same_caption,
        "csv": str(CSV.relative_to(HERE)),
    }
    OUT.write_text(json.dumps(result, indent=1))
    for k, v in result.items():
        print(f"{k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
