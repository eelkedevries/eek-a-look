"""Shared pieces of the qualities tool: paths, the area files it reads and the
quality files it writes (QualityFile in the specification).

The run-length helpers and the street categories come from tools/areas by
import, so both tools read and write masks the same way. This module is not
called common.py, so that tools/areas/common.py keeps that name on the path.
"""

import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
AREAS_TOOL = REPO / "tools" / "areas"
sys.path.insert(0, str(AREAS_TOOL))

from common import CATEGORY_IDS, EXAMPLES, decode_rle, encode_rle, photos  # noqa: E402  (tools/areas)

CACHE = HERE / ".cache"
AREAS = REPO / "public" / "precomputed" / "areas"
OUT = REPO / "public" / "precomputed" / "qualities"
PRINCIPLES = ("groundFloor", "rhythm", "materials")


class AreaData:
    """One photo's area file, decoded: category index per pixel and element masks."""

    def __init__(self, photo_id: str):
        self.raw = json.loads((AREAS / f"{photo_id}.json").read_text())
        self.photo = photo_id
        self.width, self.height = self.raw["width"], self.raw["height"]
        self.horizon = self.raw["horizon"]
        self.categories = np.full((self.height, self.width), CATEGORY_IDS.index("other"), np.uint8)
        for k, cid in enumerate(CATEGORY_IDS):
            self.categories[self.mask(cid)] = k

    def mask(self, area_id: str) -> np.ndarray:
        area = next((a for a in self.raw["areas"] if a["id"] == area_id), None)
        if area is None:
            return np.zeros((self.height, self.width), bool)
        return decode_rle(area["rle"], self.width, self.height)

    def category(self, cid: str) -> np.ndarray:
        return self.categories == CATEGORY_IDS.index(cid)


def evidence(eid: str, label: str, role: str, mask: np.ndarray) -> dict:
    return {"id": eid, "label": label, "role": role, "share": float(mask.mean()), "rle": encode_rle(mask)}


def load_quality(data: AreaData) -> dict:
    path = OUT / f"{data.photo}.json"
    if path.exists():
        return json.loads(path.read_text())
    return {"photo": data.photo, "width": data.width, "height": data.height, "models": {}, "principles": {}}


def write_quality(quality: dict) -> Path:
    """Write a quality file, keeping the principles in a fixed order."""
    quality["principles"] = {p: quality["principles"][p] for p in PRINCIPLES if p in quality["principles"]}
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{quality['photo']}.json"
    path.write_text(json.dumps(quality, ensure_ascii=False, separators=(",", ":")))
    return path


def check_quality(path: Path) -> list[str]:
    """Run lengths add up and shares match the masks, for every evidence layer."""
    data = json.loads(path.read_text())
    size = data["width"] * data["height"]
    problems = []
    for name, result in data["principles"].items():
        for ev in result["evidence"]:
            if sum(ev["rle"]) != size:
                problems.append(f"{name}/{ev['id']}: runs sum to {sum(ev['rle'])}, not {size}")
            elif abs(sum(ev["rle"][1::2]) / size - ev["share"]) > 1e-9:
                problems.append(f"{name}/{ev['id']}: share does not match its mask")
    return problems
