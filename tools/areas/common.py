"""Shared pieces of the area tool: paths, the street categories, OneFormer and
the run-length format of the area files (see AreaFile in the specification)."""

import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CACHE = HERE / ".cache"
EXAMPLES = REPO / "public" / "examples"
OUT = REPO / "public" / "precomputed" / "areas"
MASK_LONG_SIDE = 640

ONEFORMER = "shi-labs/oneformer_ade20k_swin_large"
ONEFORMER_REVISION = "4a5bac8e64f82681a12db2e151a4c2f4ce6092b2"

# ADE20K class index → street category; every other index is "other".
CATEGORIES: dict[str, tuple[str, list[int]]] = {
    "facade": ("Façade", [0, 1, 25, 48, 84, 8, 14, 58, 42, 86, 79]),
    "sky": ("Sky", [2]),
    "greenery": ("Greenery", [4, 9, 17, 72, 66, 29]),
    "street-surface": ("Street surface", [3, 6, 11, 52, 13, 94, 91, 46, 53, 59, 121]),
    "people": ("People", [12]),
    "vehicles": ("Vehicles", [20, 80, 83, 102, 116, 127, 76, 103, 90]),
    "signage": ("Signage", [43, 100, 123, 144, 149]),
    "street-furniture": ("Street furniture", [93, 87, 136, 69, 138, 32, 38, 95, 88, 106, 104, 132, 19, 15, 114]),
    "other": ("Other", []),
}
CATEGORY_IDS = list(CATEGORIES)


def category_lut() -> np.ndarray:
    """ADE20K index (0–149) → position in CATEGORY_IDS."""
    lut = np.full(150, CATEGORY_IDS.index("other"), dtype=np.uint8)
    for k, (_, indices) in enumerate(CATEGORIES.values()):
        lut[indices] = k
    return lut


def mask_size(width: int, height: int) -> tuple[int, int]:
    scale = MASK_LONG_SIDE / max(width, height)
    return round(width * scale), round(height * scale)


def device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


class OneFormer:
    """Semantic segmentation into the nine street categories."""

    def __init__(self, dev: torch.device):
        from transformers import OneFormerForUniversalSegmentation, OneFormerProcessor

        self.dev = dev
        self.processor = OneFormerProcessor.from_pretrained(ONEFORMER, revision=ONEFORMER_REVISION)
        self.model = OneFormerForUniversalSegmentation.from_pretrained(ONEFORMER, revision=ONEFORMER_REVISION).to(dev).eval()
        names = self.model.config.id2label
        # Guard the index table above against a different label order.
        for index, start in ((1, "building"), (2, "sky"), (12, "person"), (20, "car"), (43, "signboard")):
            assert names[index].strip().startswith(start), (index, names[index])
        self.lut = category_lut()

    @torch.no_grad()
    def categories(self, image: Image.Image, size: tuple[int, int]) -> np.ndarray:
        """Category index per pixel at size (width, height)."""
        inputs = self.processor(images=image, task_inputs=["semantic"], return_tensors="pt").to(self.dev)
        outputs = self.model(**inputs)
        ade = self.processor.post_process_semantic_segmentation(outputs, target_sizes=[size[::-1]])[0].cpu().numpy()
        return self.lut[ade]


def encode_rle(mask: np.ndarray) -> list[int]:
    """Row-major run lengths, starting with a run outside the area (possibly 0)."""
    flat = mask.ravel().astype(np.int8)
    edges = np.flatnonzero(np.diff(flat)) + 1
    bounds = np.concatenate(([0], edges, [flat.size]))
    runs = np.diff(bounds).tolist()
    return runs if flat[0] == 0 else [0, *runs]


def decode_rle(rle: list[int], width: int, height: int) -> np.ndarray:
    values = np.zeros(len(rle), dtype=bool)
    values[1::2] = True
    return np.repeat(values, rle).reshape(height, width)


def area_entry(area_id: str, label: str, group: str, mask: np.ndarray, **extra) -> dict:
    return {"id": area_id, "label": label, "group": group, "share": float(mask.mean()), "rle": encode_rle(mask), **extra}


def write_area_file(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))


def photos() -> list[dict]:
    return json.loads((EXAMPLES / "examples.json").read_text())
