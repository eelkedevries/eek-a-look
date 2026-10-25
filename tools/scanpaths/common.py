"""Shared paths and helpers for the predicted fixations and scanpaths of the Example section (prompt 076)."""

import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CACHE = HERE / ".cache"
EXAMPLES = REPO / "public" / "examples"
PRECOMPUTED = REPO / "public" / "precomputed"

MSDB_MAPS = PRECOMPUTED / "deepgaze-msdb"
FIXATIONS_OUT = PRECOMPUTED / "deepgaze-msdb-fixations"
SCANPATHS_OUT = PRECOMPUTED / "deepgaze35-vl"
MEASURED = PRECOMPUTED / "measured"

# The owner's answers to prompt 076: 100 scanpaths of 8 fixations per image, and 100 × 8 sampled MSDB fixations.
SCANPATHS_PER_IMAGE = 100
FIXATIONS_PER_PATH = 8
MSDB_FIXATIONS_PER_IMAGE = SCANPATHS_PER_IMAGE * FIXATIONS_PER_PATH
# The summary measure counts fixations 2 to 1 + K: fixation 1 is the starting fixation at the centre.
K = 7
BASE_SEED = 76


def photos() -> list[dict]:
    """The six images of the Example section, A and B of each comparison, in the order of comparisons.json."""
    manifest = json.loads((EXAMPLES / "comparisons.json").read_text())
    library = {p["id"]: p for p in json.loads((EXAMPLES / "examples.json").read_text())}
    edited = {p["id"]: p for p in manifest["images"]}
    return [library.get(i) or edited[i] for e in manifest["examples"] for i in (e["a"], e["b"])]


def seed_for(photo_id: str) -> int:
    """A seed per image that does not depend on the order of the images."""
    return int.from_bytes(hashlib.sha256(f"{BASE_SEED}:{photo_id}".encode()).digest()[:4], "little")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
