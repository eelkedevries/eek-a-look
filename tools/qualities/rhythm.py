"""Horizontal–vertical rhythm and variety (prompt 041).

Operational definition (this project's, not the 2020 panel's): façades
articulated by horizontal layers and vertical units that repeat, with visible
variation between façade zones. Rhythm is a relation between elements, so the
measure looks at the spacing of window and balcony instances in local
windows, not at single elements. Line segments are shown as evidence but do
not enter the periodicity: on the calibration images they pulled agreement
with the human labels towards chance (prompt 041, final report).

The threshold τ on the periodicity is calibrated per family on CMP Facade
(even image numbers) against a reference computed from the human labels.
"""

import json
import time

import cv2
import numpy as np
import torch
from PIL import Image
from scipy import ndimage
from scipy.cluster.hierarchy import fcluster, linkage

from shared import AREAS, CACHE, CATEGORY_IDS, EXAMPLES, HERE, AreaData, evidence, evidence_lines

import elements  # tools/areas: SAM 3 pin and the façade zone
import validate  # tools/areas: dataset mappings

CELL, WINDOW = 32, 160  # window: about 2–3 periods of CMP windows on the mask grid (median gaps 54 and 80 px)
MIN_FACADE = 0.60
LINE_MIN = 0.02            # of the image width
VERTICAL_DEG, LAYER_DEG = 8, 60
SIGMA = 1.5
LAGS = (5, 100)
MIN_ITEMS = 3
TAU_GRID = np.round(np.arange(0.10, 0.901, 0.05), 2)
MERGE_PX, MAX_CV = 3, 0.35
ZONE_CUT, ZONE_MIN = 12.0, 0.10
CALIBRATION = HERE / "rhythm_calibration.json"
PHRASES = ("window", "balcony")
SCORE_FLOOR = 0.05                                      # instances are cached down to this score
INSTANCE_GRID = (0.20, 0.30, 0.40, 0.50, 0.65)          # prompt 041b: calibrated with τ
# CMP classes: 3 window, 4 door, 5 cornice, 6 sill, 7 balcony, 10 molding, 11 pillar, 12 shop
CMP_VERTICAL = (3, 4, 7, 11, 12)
CMP_LAYER = (3, 7, 6, 5, 10)
RHYTHMIC, LAYERS, BAYS, PLAIN, IRREGULAR, NONE = 4, 3, 2, 1, 0, -1


# --- items -----------------------------------------------------------------------

class Sam3Instances:
    """SAM 3 instances for one phrase, at a score threshold, on the mask grid."""

    def __init__(self, dev: torch.device):
        from transformers import Sam3Model, Sam3Processor

        repo, rev = elements.CANDIDATES["D"]["repos"][0]
        self.dev, self.pin = dev, f"{repo}@{rev}"
        self.processor = Sam3Processor.from_pretrained(repo, revision=rev)
        self.model = Sam3Model.from_pretrained(repo, revision=rev).to(dev).eval()

    @torch.no_grad()
    def __call__(self, image: Image.Image, phrase: str, size: tuple[int, int], threshold: float, zone: np.ndarray) -> list[dict]:
        inputs = self.processor(images=image, text=phrase, return_tensors="pt").to(self.dev)
        out = self.model(**inputs)
        res = self.processor.post_process_instance_segmentation(
            out, threshold=threshold, mask_threshold=0.5, target_sizes=[size[::-1]])[0]
        found = []
        for mask, score in zip(res["masks"].cpu().numpy(), res["scores"].float().cpu().numpy()):
            mask = (mask > 0) & zone
            if mask.sum() < 4:
                continue
            ys, xs = np.nonzero(mask)
            found.append({"cx": float(xs.mean()), "cy": float(ys.mean()), "pixels": int(mask.sum()),
                          "box": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], "score": round(float(score), 3)})
        return found


def instances_cached(name: str, compute) -> dict[str, list[dict]]:
    """SAM 3 instances down to SCORE_FLOOR, with their scores; filtered by the calibrated threshold when used."""
    path = CACHE / "instances-scored" / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text())
    found = compute()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(found))
    return found


def segments(image: Image.Image, facade: np.ndarray) -> dict[str, np.ndarray]:
    """LSD segments on façade pixels, on the mask grid, split into the two families.

    Each family is an array of rows (mid x, mid y, length, angle in degrees from
    horizontal in (-90, 90], x1, y1, x2, y2).
    """
    h, w = facade.shape
    gray = np.asarray(image.convert("L").resize((w * 2, h * 2), Image.LANCZOS))
    lines = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD).detect(gray)[0]
    empty = {"vertical": np.zeros((0, 8)), "layer": np.zeros((0, 8))}
    if lines is None:
        return empty
    seg = lines.reshape(-1, 4).astype(np.float64) / 2
    dx, dy = seg[:, 2] - seg[:, 0], seg[:, 3] - seg[:, 1]
    length = np.hypot(dx, dy)
    angle = np.degrees(np.arctan2(dy, dx))
    angle = np.where(angle > 90, angle - 180, np.where(angle <= -90, angle + 180, angle))
    mx, my = (seg[:, 0] + seg[:, 2]) / 2, (seg[:, 1] + seg[:, 3]) / 2
    on = facade[np.clip(my.astype(int), 0, h - 1), np.clip(mx.astype(int), 0, w - 1)]
    rows = np.c_[mx, my, length, angle, seg]
    keep = on & (length >= LINE_MIN * w)
    tilt = np.abs(angle)
    return {"vertical": rows[keep & (tilt >= 90 - VERTICAL_DEG)], "layer": rows[keep & (tilt <= LAYER_DEG)]}


# --- periodicity -----------------------------------------------------------------

def periodicity(positions: np.ndarray, weights: np.ndarray) -> float:
    """Highest local peak of the normalised autocorrelation at lags 5–40 px; 0 with fewer than 3 items."""
    if len(positions) < MIN_ITEMS:
        return 0.0
    start = positions.min()
    hist = np.zeros(int(np.ceil(positions.max() - start)) + 1)
    np.add.at(hist, np.round(positions - start).astype(int), weights)
    s = ndimage.gaussian_filter1d(hist, SIGMA, mode="constant")
    x = s - s.mean()
    ac = np.correlate(x, x, "full")[len(x) - 1:]
    if ac[0] <= 0:
        return 0.0
    ac = ac / ac[0]
    best = 0.0
    for k in range(LAGS[0], min(LAGS[1], len(ac) - 2) + 1):
        if ac[k] > ac[k - 1] and ac[k] >= ac[k + 1]:
            best = max(best, float(ac[k]))
    return best


def window_items(family: str, segs: np.ndarray, centres: np.ndarray, box: tuple[int, int, int, int]) -> tuple[np.ndarray, np.ndarray]:
    """Positions along the family's normal and their weights, for the items in one window."""
    x0, y0, x1, y1 = box
    s = segs[(segs[:, 0] >= x0) & (segs[:, 0] < x1) & (segs[:, 1] >= y0) & (segs[:, 1] < y1)]
    c = centres[(centres[:, 0] >= x0) & (centres[:, 0] < x1) & (centres[:, 1] >= y0) & (centres[:, 1] < y1)] if len(centres) else centres
    if family == "vertical":
        normal = np.array([1.0, 0.0])
    else:
        if len(s):
            phi = np.radians(s[:, 3])
            theta = 0.5 * np.arctan2((s[:, 2] * np.sin(2 * phi)).sum(), (s[:, 2] * np.cos(2 * phi)).sum())
        else:
            theta = 0.0
        normal = np.array([-np.sin(theta), np.cos(theta)])
    w_inst = float(np.median(s[:, 2])) if len(s) else 1.0
    pos = np.r_[s[:, :2] @ normal, c[:, :2] @ normal if len(c) else []]
    weights = np.r_[s[:, 2], np.full(len(c), w_inst)]
    return pos, weights


def cell_grid(facade: np.ndarray) -> list[tuple[int, int, tuple[int, int, int, int]]]:
    """(row, column, window box) for every cell with at least 60% façade pixels."""
    h, w = facade.shape
    cells = []
    for r in range(int(np.ceil(h / CELL))):
        for c in range(int(np.ceil(w / CELL))):
            y0, x0 = r * CELL, c * CELL
            if facade[y0:y0 + CELL, x0:x0 + CELL].mean() < MIN_FACADE:
                continue
            box = (max(0, x0 - (WINDOW - CELL) // 2), max(0, y0 - (WINDOW - CELL) // 2),
                   min(w, x0 + CELL + (WINDOW - CELL) // 2), min(h, y0 + CELL + (WINDOW - CELL) // 2))
            cells.append((r, c, box))
    return cells


def cell_periodicities(facade: np.ndarray, centres: np.ndarray) -> list[dict]:
    """Periodicity per cell and family from the element instances in its window."""
    no_segments = np.zeros((0, 8))
    out = []
    for r, c, box in cell_grid(facade):
        cell = {"row": r, "col": c, "box": box}
        for family in ("vertical", "layer"):
            pos, weights = window_items(family, no_segments, centres, box)
            cell[family] = periodicity(pos, weights)
            cell[family + "Items"] = len(pos)
        out.append(cell)
    return out


def classify(cell: dict, tau: dict[str, float]) -> int:
    if cell["verticalItems"] < MIN_ITEMS and cell["layerItems"] < MIN_ITEMS:
        return PLAIN
    v, l = cell["vertical"] >= tau["vertical"], cell["layer"] >= tau["layer"]
    return RHYTHMIC if v and l else LAYERS if l else BAYS if v else IRREGULAR


# --- reference from human labels (CMP) ---------------------------------------------

def regular(centres: list[float]) -> bool:
    """At least 3 distinct centres (within 3 px merged) with gaps of coefficient of variation ≤ 0.35."""
    if len(centres) < MIN_ITEMS:
        return False
    merged, group = [], [sorted(centres)[0]]
    for v in sorted(centres)[1:]:
        if v - group[-1] < MERGE_PX:
            group.append(v)
        else:
            merged.append(np.mean(group)); group = [v]
    merged.append(np.mean(group))
    if len(merged) < MIN_ITEMS:
        return False
    gaps = np.diff(merged)
    return float(gaps.std() / gaps.mean()) <= MAX_CV


def label_centres(label: np.ndarray) -> dict[int, np.ndarray]:
    """CMP class → centroids (x, y) of its connected components."""
    out = {}
    for cls in set(CMP_VERTICAL) | set(CMP_LAYER):
        comp, n = ndimage.label(label == cls)
        out[cls] = np.array(ndimage.center_of_mass(np.ones_like(comp), comp, range(1, n + 1)))[:, ::-1] if n else np.zeros((0, 2))
    return out


def reference(centres: dict[int, np.ndarray], box: tuple[int, int, int, int]) -> dict[str, bool]:
    """A family repeats if any one labelled class in it has regularly spaced centres in the window."""
    x0, y0, x1, y1 = box
    inside = lambda pts: pts[(pts[:, 0] >= x0) & (pts[:, 0] < x1) & (pts[:, 1] >= y0) & (pts[:, 1] < y1)] if len(pts) else pts
    return {"vertical": any(regular(list(inside(centres[c])[:, 0])) for c in CMP_VERTICAL if len(inside(centres[c]))),
            "layer": any(regular(list(inside(centres[c])[:, 1])) for c in CMP_LAYER if len(inside(centres[c])))}


def cmp_records(dev: torch.device) -> list[dict]:
    """CMP base images with the automatic façade, the label and SAM 3 instances; cached in .cache/cmp/."""
    from common import CATEGORY_IDS, OneFormer, mask_size

    mapping = validate.load_mapping(validate.MAPPINGS / "cmp.json")
    cache = CACHE / "cmp"
    cache.mkdir(parents=True, exist_ok=True)
    labels = sorted(mapping["labels"].glob("*.png"))
    model = None
    for label_path in labels:  # OneFormer first, alone on the GPU
        if (cache / f"{label_path.stem}.npz").exists():
            continue
        model = model or OneFormer(dev)
        image = Image.open(mapping["images"] / (label_path.stem + mapping["imageSuffix"])).convert("RGB")
        size = mask_size(image.width, image.height)
        cats = model.categories(image, size)
        label = np.asarray(Image.open(label_path).resize(size, Image.NEAREST))
        np.savez_compressed(cache / f"{label_path.stem}.npz", cats=cats, label=label)
    del model
    torch.cuda.empty_cache()

    sam = None
    records = []
    for label_path in labels:
        stored = np.load(cache / f"{label_path.stem}.npz")
        cats, label = stored["cats"], stored["label"]
        image_path = mapping["images"] / (label_path.stem + mapping["imageSuffix"])
        size = (cats.shape[1], cats.shape[0])

        def compute():
            nonlocal sam
            sam = sam or Sam3Instances(dev)
            zone = elements.facade_zone(cats)
            image = Image.open(image_path).convert("RGB")
            return {p: sam(image, p, size, SCORE_FLOOR, zone) for p in PHRASES}

        found = instances_cached(f"cmp-{label_path.stem}", compute)
        number = int("".join(ch for ch in label_path.stem if ch.isdigit()))
        records.append({"name": label_path.stem, "image": image_path, "cats": cats, "label": label, "instances": found,
                        "split": "test" if number % 2 else "calibration"})
    del sam
    torch.cuda.empty_cache()
    return records


def centres_above(found: dict[str, list[dict]], s: float) -> np.ndarray:
    return np.array([[i["cx"], i["cy"]] for p in PHRASES for i in found[p] if i["score"] >= s]).reshape(-1, 2)


def cmp_windows(record: dict, s: float) -> list[dict]:
    """Image periodicity (instances scoring at least s) and the human-label reference for every façade window of a CMP image."""
    from common import CATEGORY_IDS

    facade = record["cats"] == CATEGORY_IDS.index("facade")
    centres = centres_above(record["instances"], s)
    cells = cell_periodicities(facade, centres)
    ref_centres = label_centres(record["label"])
    for cell in cells:
        cell["reference"] = reference(ref_centres, cell["box"])
    return cells


def balanced_accuracy(pred: np.ndarray, truth: np.ndarray) -> float:
    tpr = (pred & truth).sum() / max(truth.sum(), 1)
    tnr = (~pred & ~truth).sum() / max((~truth).sum(), 1)
    return float((tpr + tnr) / 2)


def calibrate(dev: torch.device) -> dict:
    """τ per family and the instance threshold s, jointly, on the even CMP images (prompts 041, 041b)."""
    t0 = time.perf_counter()
    records = [r for r in cmp_records(dev) if r["split"] == "calibration"]
    by_s = {}
    for s in INSTANCE_GRID:
        cells = [c for r in records for c in cmp_windows(r, s)]
        fits = {}
        for family in ("vertical", "layer"):
            p = np.array([c[family] for c in cells])
            truth = np.array([c["reference"][family] for c in cells])
            scores = [balanced_accuracy(p >= t, truth) for t in TAU_GRID]
            k = int(np.argmax(scores))
            pred = p >= TAU_GRID[k]
            fits[family] = {
                "tau": float(TAU_GRID[k]), "balancedAccuracy": scores[k],
                "precision": float((pred & truth).sum() / max(pred.sum(), 1)),
                "recall": float((pred & truth).sum() / max(truth.sum(), 1)),
                "referenceRepeats": float(truth.mean()), "byTau": [round(v, 4) for v in scores]}
        by_s[s] = {"meanBalancedAccuracy": float(np.mean([f["balancedAccuracy"] for f in fits.values()])),
                   "families": fits, "windows": len(cells)}
    best = max(INSTANCE_GRID, key=lambda s: (round(by_s[s]["meanBalancedAccuracy"], 6), s))  # a tie goes to the higher s
    result = {"date": time.strftime("%Y-%m-%d"), "dataset": "CMP Facade base, even image numbers",
              "images": len(records), "windows": by_s[best]["windows"], "tauGrid": TAU_GRID.tolist(),
              "instanceThreshold": best, "instanceGrid": list(INSTANCE_GRID),
              "families": by_s[best]["families"],
              "byInstanceThreshold": {str(s): {"meanBalancedAccuracy": v["meanBalancedAccuracy"],
                                               **{f: {"tau": x["tau"], "balancedAccuracy": x["balancedAccuracy"]} for f, x in v["families"].items()}}
                                      for s, v in by_s.items()}}
    result["seconds"] = round(time.perf_counter() - t0, 1)
    CALIBRATION.write_text(json.dumps(result, indent=1))
    return result


# --- the example photos ----------------------------------------------------------------

def lab_cells(image: Image.Image, facade: np.ndarray, cells: list[dict]) -> np.ndarray:
    h, w = facade.shape
    rgb = np.asarray(image.convert("RGB").resize((w, h), Image.LANCZOS), dtype=np.float32) / 255
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2Lab)
    out = []
    for cell in cells:
        y0, x0 = cell["row"] * CELL, cell["col"] * CELL
        sel = facade[y0:y0 + CELL, x0:x0 + CELL]
        out.append(lab[y0:y0 + CELL, x0:x0 + CELL][sel].mean(0))
    return np.array(out).reshape(-1, 3)


def zones(lab: np.ndarray) -> np.ndarray:
    """Cluster id per façade cell; -1 for cells outside a zone of at least 10% of the cells."""
    if len(lab) < 2:
        return np.zeros(len(lab), int) if len(lab) else np.zeros(0, int)
    ids = fcluster(linkage(lab * np.array([0.5, 1, 1]), method="average"), ZONE_CUT, criterion="distance")
    counts = np.bincount(ids)
    big = [k for k in np.argsort(-counts) if counts[k] >= ZONE_MIN * len(lab) and k > 0]
    out = np.full(len(lab), -1)
    for z, k in enumerate(big):
        out[ids == k] = z
    return out


def measure_panorama(photo: dict, data: AreaData, dev: torch.device, sam_holder: dict, tau: dict[str, float], s: float) -> tuple[dict, dict]:
    """Prompt 061: a 360° panorama is measured in the four side faces of a cube map (tools/areas/panorama.py), where
    straight lines are straight: per face, instances, cells and periodicity as for a photo; the cells of all faces are
    pooled for the indicators and the variety, and the evidence is mapped back onto the panorama's grid."""
    import panorama

    image = Image.open(EXAMPLES / photo["file"]).convert("RGB")
    pixels = np.asarray(image.resize((data.width, data.height), Image.LANCZOS))
    facade_pano = data.category("facade")
    segs = segments(image, facade_pano)
    n = panorama.FACE
    faces, labs, found = [], [], {p: [] for p in PHRASES}
    for yaw in panorama.YAWS:
        face_image = Image.fromarray(panorama.to_face(pixels, yaw))
        cats = panorama.to_face(data.categories, yaw, nearest=True)
        facade = cats == CATEGORY_IDS.index("facade")

        def compute(face_image=face_image, cats=cats):
            sam_holder["sam"] = sam_holder.get("sam") or Sam3Instances(dev)
            zone = elements.facade_zone(cats)
            return {p: sam_holder["sam"](face_image, p, (n, n), SCORE_FLOOR, zone) for p in PHRASES}

        scored = instances_cached(f"{photo['id']}-face{yaw}", compute)
        for p in PHRASES:
            found[p] += [i for i in scored[p] if i["score"] >= s]
        cells = cell_periodicities(facade, centres_above(scored, s))
        faces.append({"yaw": yaw, "facade": facade, "cells": cells, "classes": np.array([classify(c, tau) for c in cells], int)})
        labs.append(lab_cells(face_image, facade, cells) if cells else np.zeros((0, 3)))
    classes = np.concatenate([f["classes"] for f in faces])
    lab = np.vstack(labs)
    zone_of = zones(lab) if len(lab) else np.zeros(0, int)

    n_cells = len(classes)
    share = lambda k: float((classes == k).sum() / n_cells) if n_cells else None
    indicators = {
        "facadeCells": n_cells,
        "rhythmicShare": share(RHYTHMIC), "layersOnlyShare": share(LAYERS), "baysOnlyShare": share(BAYS),
        "plainShare": share(PLAIN), "irregularShare": share(IRREGULAR),
        "distinctZones": int(zone_of.max() + 1) if n_cells and zone_of.max() >= 0 else 0,
        "windowInstances": len(found["window"]), "balconyInstances": len(found["balcony"]),
    }
    outcome, reasons = rule(indicators)

    def cells_mask(select) -> np.ndarray:
        out = np.zeros_like(facade_pano)
        k = 0
        for face in faces:
            m = np.zeros(face["facade"].shape, np.uint8)
            for cell in face["cells"]:
                if select[k]:
                    y0, x0 = cell["row"] * CELL, cell["col"] * CELL
                    m[y0:y0 + CELL, x0:x0 + CELL] = 1
                k += 1
            back, _ = panorama.from_face(m * face["facade"], face["yaw"], data.width, data.height)
            out |= back.astype(bool)
        return out & facade_pano

    def lines(family: str) -> np.ndarray:
        canvas = np.zeros(facade_pano.shape, np.uint8)
        for seg in segs[family]:
            cv2.line(canvas, (int(round(seg[4])), int(round(seg[5]))), (int(round(seg[6])), int(round(seg[7]))), 1, 1)
        return canvas.astype(bool)

    masks = {"rhythmic": cells_mask(classes == RHYTHMIC), "layers": cells_mask(classes == LAYERS),
             "bays": cells_mask(classes == BAYS), "plain": cells_mask((classes == PLAIN) | (classes == IRREGULAR))}
    layers = [
        evidence("rhythmic", "Repeating layers and bays", "supports", masks["rhythmic"]),
        evidence("layers-only", "Layers only", "context", masks["layers"]),
        evidence("bays-only", "Bays only", "context", masks["bays"]),
        evidence("plain-irregular", "Plain or irregular", "against", masks["plain"]),
        evidence_lines("floor-lines", "Floor lines and bands", "context", segs["layer"][:, 4:8], lines("layer")),
        evidence_lines("vertical-lines", "Vertical divisions", "context", segs["vertical"][:, 4:8], lines("vertical")),
    ]
    for z in range(indicators["distinctZones"]):
        layers.append(evidence(f"zone-{z + 1}", f"Façade zone {z + 1}", "context", cells_mask(zone_of == z)))
    detail = {"panorama": True, "masks": masks, "faces": [(f["yaw"], len(f["cells"])) for f in faces], "instances": found}
    return {"outcome": outcome, "reasons": reasons, "indicators": indicators, "evidence": layers}, detail


def measure(photo: dict, data: AreaData, dev: torch.device, sam_holder: dict, tau: dict[str, float], s: float) -> tuple[dict, dict]:
    if photo.get("imageKind") == "panorama":
        return measure_panorama(photo, data, dev, sam_holder, tau, s)
    facade = data.category("facade")
    image = Image.open(EXAMPLES / photo["file"]).convert("RGB")
    size = (data.width, data.height)

    def compute():
        sam_holder["sam"] = sam_holder.get("sam") or Sam3Instances(dev)
        zone = elements.facade_zone(data.categories)
        return {p: sam_holder["sam"](image, p, size, SCORE_FLOOR, zone) for p in PHRASES}

    scored = instances_cached(photo["id"], compute)
    found = {p: [i for i in scored[p] if i["score"] >= s] for p in PHRASES}
    centres = centres_above(scored, s)
    segs = segments(image, facade)
    cells = cell_periodicities(facade, centres)
    classes = np.array([classify(c, tau) for c in cells], int)
    zone_of = zones(lab_cells(image, facade, cells)) if cells else np.zeros(0, int)

    n = len(cells)
    share = lambda k: float((classes == k).sum() / n) if n else None
    indicators = {
        "facadeCells": n,
        "rhythmicShare": share(RHYTHMIC), "layersOnlyShare": share(LAYERS), "baysOnlyShare": share(BAYS),
        "plainShare": share(PLAIN), "irregularShare": share(IRREGULAR),
        "distinctZones": int(zone_of.max() + 1) if n and zone_of.max() >= 0 else 0,
        "windowInstances": len(found["window"]), "balconyInstances": len(found["balcony"]),
    }
    outcome, reasons = rule(indicators)

    def cells_mask(select) -> np.ndarray:
        m = np.zeros_like(facade)
        for cell, keep in zip(cells, select):
            if keep:
                y0, x0 = cell["row"] * CELL, cell["col"] * CELL
                m[y0:y0 + CELL, x0:x0 + CELL] = True
        return m & facade

    def lines(family: str) -> np.ndarray:
        canvas = np.zeros(facade.shape, np.uint8)
        for s in segs[family]:
            cv2.line(canvas, (int(round(s[4])), int(round(s[5]))), (int(round(s[6])), int(round(s[7]))), 1, 1)
        return canvas.astype(bool)

    layers = [
        evidence("rhythmic", "Repeating layers and bays", "supports", cells_mask(classes == RHYTHMIC)),
        evidence("layers-only", "Layers only", "context", cells_mask(classes == LAYERS)),
        evidence("bays-only", "Bays only", "context", cells_mask(classes == BAYS)),
        evidence("plain-irregular", "Plain or irregular", "against", cells_mask((classes == PLAIN) | (classes == IRREGULAR))),
        evidence_lines("floor-lines", "Floor lines and bands", "context", segs["layer"][:, 4:8], lines("layer")),
        evidence_lines("vertical-lines", "Vertical divisions", "context", segs["vertical"][:, 4:8], lines("vertical")),
    ]
    for z in range(indicators["distinctZones"]):
        layers.append(evidence(f"zone-{z + 1}", f"Façade zone {z + 1}", "context", cells_mask(zone_of == z)))
    detail = {"cells": cells, "classes": classes, "zones": zone_of, "segments": segs, "instances": found}
    return {"outcome": outcome, "reasons": reasons, "indicators": indicators, "evidence": layers}, detail


def rule(ind: dict) -> tuple[str, list[str]]:
    """The rule of the specification (Architectural qualities, rhythm and variety)."""
    if ind["facadeCells"] < 8:
        return "unclear", ["Too little façade is visible."]
    r, z = ind["rhythmicShare"], ind["distinctZones"]
    if r >= 0.25 and z >= 2:
        return "likely-present", [f"Layers and bays repeat in {r:.0%} of the façade, across {z} visibly different façade zones."]
    if r >= 0.25:
        return "unclear", [f"Repetition without visible variety: layers and bays repeat in {r:.0%} of the façade, in one colour zone."]
    if r < 0.10:
        return "likely-absent", [f"Few repeating layers or bays: {r:.0%} of the façade."]
    return "unclear", [f"Some repetition: layers and bays repeat in {r:.0%} of the façade."]
