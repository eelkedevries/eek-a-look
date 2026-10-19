"""Tactile materials (prompt 042): which materials are visible near eye level, on
the street façade and in the street space, from the DMS46 material model.

Operational definition (this project's, not the 2020 panel's): surfaces near
eye level whose material shows visible texture or detail (brickwork, natural
stone, wood, tiles and setts, wicker, planting), as opposed to smooth, uniform
surfaces (glass, mirror, metal, polished stone, plaster or paint, plastic,
ceramic). This is visible texture in a photo, not touch.
"""

import json

import numpy as np
import torch
from PIL import Image

from shared import CACHE, EXAMPLES, AreaData, evidence

MODEL = CACHE / "dms" / "DMS46_v1.pt"
TAXONOMY = CACHE / "dms" / "taxonomy.json"
# From inference.py of apple/ml-dms-dataset@a379a63e9435e32134a465eb31ecb0aefebed985:
# the taxonomy indices of the 46 classes the model predicts, in output order,
# the input size (long side 512, LANCZOS) and the normalisation.
DMS46 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 23, 24, 26, 27, 29, 30, 32, 33, 34, 35, 36,
         37, 38, 39, 41, 43, 44, 46, 47, 48, 49, 50, 51, 52, 53, 56]
INPUT_LONG_SIDE = 512
MEAN = np.array([0.485, 0.456, 0.406]) * 255
STD = np.array([0.229, 0.224, 0.225]) * 255

TEXTURED = ["Brickwork", "Stone, natural", "Wood", "Wood, tree", "Tile", "Wicker", "Foliage"]
SMOOTH = ["Glass", "Mirror", "Metal", "Stone, polished", "Paint/plaster/enamel", "Plastic, clear", "Plastic, non-clear", "Ceramic"]
PLANTING = "Foliage"


def names() -> list[str]:
    taxonomy = json.loads(TAXONOMY.read_text())
    return [taxonomy["names"][i] for i in DMS46]


class Dms46:
    def __init__(self, dev: torch.device):
        self.dev = dev
        self.model = torch.jit.load(str(MODEL), map_location=dev).eval()
        self.names = names()
        for group in (TEXTURED, SMOOTH):
            missing = [n for n in group if n not in self.names]
            assert not missing, f"not in the DMS46 taxonomy: {missing}"

    @torch.no_grad()
    def labels(self, image: Image.Image, size: tuple[int, int]) -> np.ndarray:
        """DMS46 class index per pixel, resized (nearest) to size (width, height)."""
        w, h = image.size
        scale = min(INPUT_LONG_SIDE / h, INPUT_LONG_SIDE / w)
        resized = np.asarray(image.convert("RGB").resize((int(np.ceil(scale * w)), int(np.ceil(scale * h))), Image.LANCZOS), dtype=np.float32)
        x = torch.from_numpy(((resized - MEAN) / STD).transpose(2, 0, 1).astype(np.float32)).unsqueeze(0).to(self.dev)
        prediction = self.model(x)[0].data.cpu()[0, 0].numpy().astype(np.uint8)
        return np.asarray(Image.fromarray(prediction).resize(size, Image.NEAREST))


def eye_level_zone(data: AreaData) -> tuple[np.ndarray, np.ndarray]:
    """(façade part, street-space part): the ground floor, and every pixel below the
    horizon that is not sky, people or vehicles and not ground floor."""
    floor = data.mask("ground-floor")
    rows = np.arange(data.height)[:, None] > data.horizon["row"]
    excluded = data.category("sky") | data.category("people") | data.category("vehicles")
    street = rows & ~excluded & ~floor
    return floor, street


def measure(photo: dict, data: AreaData, dms: Dms46) -> tuple[dict, dict]:
    image = Image.open(EXAMPLES / photo["file"]).convert("RGB")
    labels = dms.labels(image, (data.width, data.height))
    index = {n: k for k, n in enumerate(dms.names)}
    is_in = lambda group: np.isin(labels, [index[n] for n in group])
    textured, smooth, planting = is_in(TEXTURED), is_in(SMOOTH), labels == index[PLANTING]
    facade_part, street_part = eye_level_zone(data)
    zone = facade_part | street_part

    def shares(part: np.ndarray) -> tuple[float | None, float | None, float | None]:
        n = part.sum()
        if not n:
            return None, None, None
        t, s = (textured & part).sum() / n, (smooth & part).sum() / n
        return float(t), float(s), float(1 - t - s)

    t, s, neutral = shares(zone)
    ft, fs, fn = shares(facade_part)
    st, ss, sn = shares(street_part)
    furniture = data.category("street-furniture")
    indicators = {
        "zoneShare": float(zone.mean()),
        "texturedShare": t, "smoothShare": s, "neutralShare": neutral,
        "plantingShare": float((planting & zone).sum() / zone.sum()) if zone.any() else None,
        "facadeTexturedShare": ft, "facadeSmoothShare": fs, "facadeNeutralShare": fn,
        "streetTexturedShare": st, "streetSmoothShare": ss, "streetNeutralShare": sn,
        "texturedFurniture": float((textured & furniture).sum() / furniture.sum()) if furniture.any() else None,
    }
    if zone.any():
        counts = np.bincount(labels[zone], minlength=len(dms.names))
        for k in np.argsort(-counts)[:3]:
            if counts[k]:
                indicators[f"material: {dms.names[k]}"] = float(counts[k] / zone.sum())
    outcome, reasons = rule(indicators, data.horizon["method"])

    layers = [
        evidence("textured", "Textured surfaces", "supports", zone & textured & ~planting),
        evidence("planting", "Planting", "supports", zone & planting),
        evidence("smooth", "Smooth surfaces", "against", zone & smooth),
        evidence("eye-level-zone", "Eye-level zone", "context", zone),
    ]
    detail = {"labels": labels, "zone": zone, "names": dms.names}
    return {"outcome": outcome, "reasons": reasons, "indicators": indicators, "evidence": layers}, detail


def rule(ind: dict, horizon_method: str) -> tuple[str, list[str]]:
    """The rule of the specification (Architectural qualities, tactile materials)."""
    if horizon_method == "assumed-level":
        return "unclear", ["The horizon could not be found, so the eye-level zone is uncertain."]
    if ind["zoneShare"] < 0.10:
        return "unclear", ["Too little is visible near eye level."]
    t, s = ind["texturedShare"], ind["smoothShare"]
    where = [name for name, key in (("the ground floor", "facadeTexturedShare"), ("the street space", "streetTexturedShare"))
             if ind[key] is not None and ind[key] >= 0.25]
    place = f" Textured surfaces reach a quarter or more of {' and '.join(where)}." if where else ""
    if t >= 0.25:
        return "likely-present", [f"Visibly textured materials cover {t:.0%} of what is seen near eye level.{place}"]
    if t < 0.10 and s >= 2 * t:
        return "likely-absent", [f"Visibly textured materials cover {t:.0%} near eye level; smooth surfaces {s:.0%}.{place}"]
    return "unclear", [f"Some textured surfaces: {t:.0%} near eye level.{place}"]
