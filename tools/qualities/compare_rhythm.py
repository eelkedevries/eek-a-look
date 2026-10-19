"""Rhythm on glass and ribbon-window façades: four ways of finding repeating elements,
compared on held-out human labels (prompt 053).

  uv run compare_rhythm.py

Candidates, on the same cells, windows and periodicity as the rhythm measure:
  A  the current measure: SAM 3 "window" and "balcony" instances scoring at least
     0.65, with the current τ (rhythm_calibration.json);
  B  A plus SAM 3 instances for "ribbon window" and "curtain wall panel" scoring at
     least s_B, calibrated with τ;
  C  A, plus LSD line segments as items in windows with fewer than 3 instances (a
     fallback) with their own threshold τ_line;
  D  A with the instance score s and τ calibrated jointly.
Calibration: CMP Facade even images plus the LabelMeFacade train split. Test: CMP
odd images and the LabelMeFacade test split, and its glazed or banded subset. The
choice: the highest mean balanced accuracy over the two test sets, among
candidates whose balanced accuracy on odd CMP is at most 0.01 below A's;
otherwise A. Writes the comparison into rhythm_calibration.json
("glassComparison"). Nothing from LabelMeFacade is published.
"""

import json
import sys
import time

import numpy as np
import torch
from PIL import Image
from scipy import ndimage

import rhythm
from fetch_labelmefacade import COLOURS, DIR as LMF
from shared import CACHE

EXTRA = ("ribbon window", "curtain wall panel")
S_GRID = (0.20, 0.30, 0.40, 0.50, 0.65)
GLAZED_SHARE, RIBBON_RATIO = 0.40, 3.0
TOLERANCE = 0.01


def lmf_split(name: str) -> list[str]:
    return [l.strip().split("/")[-1].rsplit(".", 1)[0] for l in (LMF / name).read_text().splitlines() if l.strip()]


def lmf_records(dev: torch.device) -> list[dict]:
    """LabelMeFacade images with the automatic façade, labels and SAM 3 instances (all phrases), cached."""
    from common import OneFormer, mask_size

    cache = CACHE / "lmf"
    cache.mkdir(parents=True, exist_ok=True)
    splits = {n: "calibration" for n in lmf_split("train.txt")} | {n: "test" for n in lmf_split("test.txt")}
    model = None
    for name in splits:
        if (cache / f"{name}.npz").exists():
            continue
        model = model or OneFormer(dev)
        image = Image.open(LMF / "images" / f"{name}.jpg").convert("RGB")
        size = mask_size(image.width, image.height)
        cats = model.categories(image, size)
        rgb = np.asarray(Image.open(LMF / "labels" / f"{name}.png").convert("RGB").resize(size, Image.NEAREST))
        label = np.zeros(rgb.shape[:2], np.uint8)
        for k, colour in enumerate(COLOURS.values()):
            label[(rgb == colour).all(-1)] = k
        np.savez_compressed(cache / f"{name}.npz", cats=cats, label=label)
    del model
    torch.cuda.empty_cache()
    sam, records = None, []
    for name, split in splits.items():
        stored = np.load(cache / f"{name}.npz")
        cats, label = stored["cats"], stored["label"]
        size = (cats.shape[1], cats.shape[0])
        path = LMF / "images" / f"{name}.jpg"

        def compute():
            nonlocal sam
            sam = sam or rhythm.Sam3Instances(dev)
            zone = rhythm.elements.facade_zone(cats)
            image = Image.open(path).convert("RGB")
            return {p: sam(image, p, size, rhythm.SCORE_FLOOR, zone) for p in rhythm.PHRASES + EXTRA}

        found = rhythm.instances_cached(f"lmf-{name}", compute)
        records.append({"name": name, "dataset": "lmf", "split": split, "image": path, "cats": cats, "label": label, "instances": found})
    del sam
    torch.cuda.empty_cache()
    return records


def cmp_with_extra(dev: torch.device) -> list[dict]:
    """CMP records (rhythm.cmp_records), plus SAM 3 instances for the extra phrases, cached separately."""
    records = rhythm.cmp_records(dev)
    sam = None
    for r in records:
        def compute():
            nonlocal sam
            sam = sam or rhythm.Sam3Instances(dev)
            zone = rhythm.elements.facade_zone(r["cats"])
            image = Image.open(r["image"]).convert("RGB")
            size = (r["cats"].shape[1], r["cats"].shape[0])
            return {p: sam(image, p, size, rhythm.SCORE_FLOOR, zone) for p in EXTRA}

        r["instances"] = r["instances"] | rhythm.instances_cached(f"cmp-{r['name']}-extra", compute)
        r["dataset"] = "cmp"
    del sam
    torch.cuda.empty_cache()
    return records


def lmf_centres(label: np.ndarray) -> dict[int, np.ndarray]:
    names = list(COLOURS)
    out = {}
    for cls in ("window", "door"):
        comp, n = ndimage.label(label == names.index(cls))
        out[cls] = np.array(ndimage.center_of_mass(np.ones_like(comp), comp, range(1, n + 1)))[:, ::-1] if n else np.zeros((0, 2))
    return out


def lmf_reference(centres: dict, box) -> dict[str, bool]:
    x0, y0, x1, y1 = box
    inside = lambda pts: pts[(pts[:, 0] >= x0) & (pts[:, 0] < x1) & (pts[:, 1] >= y0) & (pts[:, 1] < y1)] if len(pts) else pts
    return {"vertical": any(rhythm.regular(list(inside(centres[c])[:, 0])) for c in ("window", "door") if len(inside(centres[c]))),
            "layer": bool(len(inside(centres["window"]))) and rhythm.regular(list(inside(centres["window"])[:, 1]))}


def glazed_or_banded(label: np.ndarray) -> bool:
    names = list(COLOURS)
    window = label == names.index("window")
    built = window | (label == names.index("building")) | (label == names.index("door"))
    if built.sum() and window.sum() / built.sum() >= GLAZED_SHARE:
        return True
    comp, n = ndimage.label(window)
    if not n:
        return False
    ratios = [(sl[1].stop - sl[1].start) / max(1, sl[0].stop - sl[0].start) for sl in ndimage.find_objects(comp)]
    return float(np.median(ratios)) >= RIBBON_RATIO


def windows(record: dict) -> list[dict]:
    """Per façade window: instance items by phrase and score, segment items, and the human-label reference."""
    from common import CATEGORY_IDS

    facade = record["cats"] == CATEGORY_IDS.index("facade")
    segs = rhythm.segments(Image.open(record["image"]).convert("RGB"), facade)
    if record["dataset"] == "cmp":
        ref_centres = rhythm.label_centres(record["label"])
        reference = lambda box: rhythm.reference(ref_centres, box)
    else:
        ref_centres = lmf_centres(record["label"])
        reference = lambda box: lmf_reference(ref_centres, box)
    inst = {p: np.array([[i["cx"], i["cy"], i["score"]] for i in record["instances"].get(p, [])]).reshape(-1, 3)
            for p in rhythm.PHRASES + EXTRA}
    out = []
    for _, _, box in rhythm.cell_grid(facade):
        x0, y0, x1, y1 = box
        inside = lambda a: a[(a[:, 0] >= x0) & (a[:, 0] < x1) & (a[:, 1] >= y0) & (a[:, 1] < y1)] if len(a) else a
        out.append({"box": box, "reference": reference(box),
                    "base": np.vstack([inside(inst[p]) for p in rhythm.PHRASES]),
                    "extra": np.vstack([inside(inst[p]) for p in EXTRA]),
                    "segs": {f: segs[f][(segs[f][:, 0] >= x0) & (segs[f][:, 0] < x1) & (segs[f][:, 1] >= y0) & (segs[f][:, 1] < y1)]
                             for f in ("vertical", "layer")}})
    return out


def p_instances(items: np.ndarray, family: str) -> float:
    """Periodicity of instance centres along the family's axis (as the rhythm measure)."""
    if len(items) < rhythm.MIN_ITEMS:
        return 0.0
    pos = items[:, 0] if family == "vertical" else items[:, 1]
    return rhythm.periodicity(pos, np.ones(len(pos)))


def p_segments(segs: np.ndarray, family: str, box) -> float:
    pos, weights = rhythm.window_items(family, segs, np.zeros((0, 2)), box)
    return rhythm.periodicity(pos, weights)


def scores(cells: list[dict], candidate: str, params: dict) -> dict[str, np.ndarray]:
    """Per family: the periodicity under a candidate, already compared with its threshold (bool)."""
    out = {}
    for family in ("vertical", "layer"):
        flags = []
        for c in cells:
            base = c["base"][c["base"][:, 2] >= params.get("s", 0.65)]
            if candidate == "B":
                base = np.vstack([base, c["extra"][c["extra"][:, 2] >= params["sB"]]])
            if candidate == "C" and len(base) < rhythm.MIN_ITEMS:
                flags.append(p_segments(c["segs"][family], family, c["box"]) >= params["tauLine"][family])
                continue
            flags.append(p_instances(base, family) >= params["tau"][family])
        out[family] = np.array(flags, bool)
    return out


def truth(cells: list[dict]) -> dict[str, np.ndarray]:
    return {f: np.array([c["reference"][f] for c in cells], bool) for f in ("vertical", "layer")}


def mean_ba(cells: list[dict], candidate: str, params: dict) -> float:
    if not cells:
        return float("nan")
    pred, ref = scores(cells, candidate, params), truth(cells)
    return float(np.mean([rhythm.balanced_accuracy(pred[f], ref[f]) for f in ("vertical", "layer")]))


def calibrate(cells: list[dict], candidate: str, current: dict) -> dict:
    """Grid search on the calibration cells; τ per family is chosen independently within each setting."""
    grid = rhythm.TAU_GRID
    ref = truth(cells)

    def best_tau(make):  # make(tau_family_value, family) -> bool flags
        tau = {}
        for f in ("vertical", "layer"):
            accs = [rhythm.balanced_accuracy(make(t, f), ref[f]) for t in grid]
            tau[f] = float(grid[int(np.argmax(accs))])
        return tau

    if candidate == "C":
        base_counts = [len(c["base"][c["base"][:, 2] >= current["s"]]) for c in cells]
        p_inst = {f: np.array([p_instances(c["base"][c["base"][:, 2] >= current["s"]], f) for c in cells]) for f in ("vertical", "layer")}
        p_seg = {f: np.array([p_segments(c["segs"][f], f, c["box"]) for c in cells]) for f in ("vertical", "layer")}
        fallback = np.array(base_counts) < rhythm.MIN_ITEMS
        tau_line = best_tau(lambda t, f: np.where(fallback, p_seg[f] >= t, p_inst[f] >= current["tau"][f]))
        return {"s": current["s"], "tau": current["tau"], "tauLine": tau_line}
    best = None
    for s in (S_GRID if candidate == "D" else (current["s"],)):
        for sB in (S_GRID if candidate == "B" else (None,)):
            def items(c):
                base = c["base"][c["base"][:, 2] >= s]
                return np.vstack([base, c["extra"][c["extra"][:, 2] >= sB]]) if candidate == "B" else base
            p = {f: np.array([p_instances(items(c), f) for c in cells]) for f in ("vertical", "layer")}
            tau = best_tau(lambda t, f: p[f] >= t)
            params = {"s": s, "sB": sB, "tau": tau}
            acc = mean_ba(cells, candidate, params)
            if best is None or acc > best[0] + 1e-9:
                best = (acc, params)
    return best[1]


# --- prompt 065: rectified spacing (R) and translational symmetry (S) -------------------

VERTICAL_TILT = 80          # degrees from horizontal: segments for the vertical vanishing point
MAX_STRETCH = 10.0          # a window whose aspect would change more than this keeps its own coordinates


def planes(image: Image.Image, facade: np.ndarray) -> list[dict]:
    """Up to two façade planes, each with a projective map to façade axes (u across, v up) on the mask grid.
    Horizontal vanishing points from receding façade edges (tools/areas/groundfloor.py), the vertical one from
    near-vertical edges; a vertical direction at infinity when too few agree."""
    import cv2
    import groundfloor

    h, w = facade.shape
    gray = np.asarray(image.convert("L").resize((w * 2, h * 2), Image.LANCZOS))
    rng = np.random.default_rng(0)
    seg = groundfloor._segments(gray, facade) / 2
    lines = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD).detect(gray)[0]
    vertical_vp = np.array([0.0, 1.0, 0.0])
    if lines is not None:
        s = lines.reshape(-1, 4).astype(np.float64) / 2
        tilt = np.abs(np.degrees(np.arctan2(s[:, 3] - s[:, 1], s[:, 2] - s[:, 0])))
        tilt = np.minimum(tilt, 180 - tilt)
        length = np.hypot(s[:, 2] - s[:, 0], s[:, 3] - s[:, 1])
        mx, my = ((s[:, 0] + s[:, 2]) / 2).astype(int).clip(0, w - 1), ((s[:, 1] + s[:, 3]) / 2).astype(int).clip(0, h - 1)
        vert = s[(tilt >= VERTICAL_TILT) & (length >= 0.03 * w) & facade[my, mx]]
        if len(vert) >= groundfloor.MIN_SUPPORT:
            v, inliers = groundfloor._vanishing_point(vert, rng)
            if v is not None and inliers.sum() >= groundfloor.MIN_SUPPORT:
                vertical_vp = np.array([v[0], v[1], 1.0])
    out = []
    for _ in range(2):
        if len(seg) < groundfloor.MIN_SUPPORT:
            break
        v, inliers = groundfloor._vanishing_point(seg, rng)
        if v is None or inliers.sum() < groundfloor.MIN_SUPPORT:
            break
        out.append({"vp": np.array([v[0], v[1], 1.0]), "segments": seg[inliers], "support": int(inliers.sum())})
        seg = seg[~inliers]
    for plane in out:
        line = np.cross(plane["vp"], vertical_vp)
        if abs(line[2]) < 1e-12:
            plane["map"] = None
            continue
        hp = np.array([[1, 0, 0], [0, 1, 0], [line[0] / line[2], line[1] / line[2], 1.0]])
        dh, dv = hp @ plane["vp"], hp @ vertical_vp
        dh, dv = dh[:2] * (1 if dh[0] >= 0 else -1), dv[:2] * (1 if dv[1] >= 0 else -1)
        dh, dv = dh / (np.hypot(*dh) or 1), dv / (np.hypot(*dv) or 1)  # unit axes, so u and v share one scale
        axes = np.array([[dh[0], dv[0]], [dh[1], dv[1]]])
        if abs(np.linalg.det(axes)) < 1e-12:
            plane["map"] = None
            continue
        to_axes = np.eye(3)
        to_axes[:2, :2] = np.linalg.inv(axes)
        plane["map"] = to_axes @ hp
    return [p for p in out if p.get("map") is not None]


def window_map(planes_found: list[dict], box) -> np.ndarray | None:
    """The map from image to rectified window coordinates (scaled to the window's size), or None to keep the image's."""
    if not planes_found:
        return None
    x0, y0, x1, y1 = box
    inside = lambda s: ((s[:, 0] + s[:, 2]) / 2 >= x0) & ((s[:, 0] + s[:, 2]) / 2 < x1) & ((s[:, 1] + s[:, 3]) / 2 >= y0) & ((s[:, 1] + s[:, 3]) / 2 < y1)
    local = [np.hypot(*(p["segments"][inside(p["segments"])][:, 2:] - p["segments"][inside(p["segments"])][:, :2]).T).sum() for p in planes_found]
    plane = planes_found[int(np.argmax(local))] if max(local) > 0 else max(planes_found, key=lambda p: p["support"])
    corners = np.array([[x0, y0, 1], [x1, y0, 1], [x0, y1, 1], [x1, y1, 1]], float).T
    mapped = plane["map"] @ corners
    if not (np.all(mapped[2] > 0) or np.all(mapped[2] < 0)):
        return None  # the window crosses the vanishing line
    u, v = mapped[0] / mapped[2], mapped[1] / mapped[2]
    du, dv = u.max() - u.min(), v.max() - v.min()
    if not (np.isfinite(du) and np.isfinite(dv)) or du <= 0 or dv <= 0:
        return None
    su, sv = (x1 - x0) / du, (y1 - y0) / dv
    if max(su / sv, sv / su) > MAX_STRETCH:  # the overall scale is arbitrary; only a large change of aspect is refused
        return None
    fit = np.array([[su, 0, -u.min() * su], [0, sv, -v.min() * sv], [0, 0, 1.0]])
    return fit @ plane["map"]


def profile_periodicity(profile: np.ndarray) -> float:
    """Highest local peak of the normalised autocorrelation of a gradient profile at the rhythm measure's lags."""
    s = ndimage.gaussian_filter1d(profile.astype(np.float64), rhythm.SIGMA, mode="nearest")
    x = s - s.mean()
    ac = np.correlate(x, x, "full")[len(x) - 1:]
    if len(ac) < 3 or ac[0] <= 0:
        return 0.0
    ac = ac / ac[0]
    best = 0.0
    for k in range(rhythm.LAGS[0], min(rhythm.LAGS[1], len(ac) - 2) + 1):
        if ac[k] > ac[k - 1] and ac[k] >= ac[k + 1]:
            best = max(best, float(ac[k]))
    return best


def windows_rectified(record: dict) -> list[dict]:
    """Per façade window: instances (image and rectified positions), S's periodicities and the reference."""
    import cv2
    from common import CATEGORY_IDS

    image = Image.open(record["image"]).convert("RGB")
    facade = record["cats"] == CATEGORY_IDS.index("facade")
    h, w = facade.shape
    found = planes(image, facade)
    gray = np.asarray(image.convert("L").resize((w, h), Image.LANCZOS), np.float32)
    gx = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)) * facade
    gy = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)) * facade
    if record["dataset"] == "cmp":
        ref_centres = rhythm.label_centres(record["label"])
        reference = lambda box: rhythm.reference(ref_centres, box)
    else:
        ref_centres = lmf_centres(record["label"])
        reference = lambda box: lmf_reference(ref_centres, box)
    inst = np.vstack([np.array([[i["cx"], i["cy"], i["score"]] for i in record["instances"].get(p, [])]).reshape(-1, 3)
                      for p in rhythm.PHRASES])
    out = []
    for _, _, box in rhythm.cell_grid(facade):
        x0, y0, x1, y1 = box
        base = inst[(inst[:, 0] >= x0) & (inst[:, 0] < x1) & (inst[:, 1] >= y0) & (inst[:, 1] < y1)] if len(inst) else inst
        m = window_map(found, box)
        if m is None:
            m = np.array([[1, 0, -x0], [0, 1, -y0], [0, 0, 1.0]])
        pts = m @ np.c_[base[:, :2], np.ones(len(base))].T if len(base) else np.zeros((3, 0))
        rect = np.c_[pts[0] / pts[2], pts[1] / pts[2], base[:, 2]] if len(base) else np.zeros((0, 3))
        size = (x1 - x0, y1 - y0)
        px = cv2.warpPerspective(gx, m, size, flags=cv2.INTER_LINEAR, borderValue=0)
        py = cv2.warpPerspective(gy, m, size, flags=cv2.INTER_LINEAR, borderValue=0)
        out.append({"reference": reference(box), "base": base, "rect": rect, "rectified": bool(found) and m[2, :2].any(),
                    "S": {"vertical": profile_periodicity(px.sum(0)), "layer": profile_periodicity(py.sum(1))}})
    return out


def flags_065(cells: list[dict], candidate: str, params: dict) -> dict[str, np.ndarray]:
    out = {}
    for family in ("vertical", "layer"):
        if candidate == "S":
            values = np.array([c["S"][family] for c in cells])
        else:
            key = "rect" if candidate == "R" else "base"
            values = np.array([p_instances(c[key][c[key][:, 2] >= params["s"]], family) for c in cells])
        out[family] = values >= params["tau"][family]
    return out


def precision(pred: np.ndarray, ref: np.ndarray) -> float:
    return float((pred & ref).sum() / pred.sum()) if pred.sum() else float("nan")


def main_rectified() -> int:
    dev = torch.device("cpu")  # everything comes from the caches of prompts 041 and 053
    t0 = time.perf_counter()
    calibration = json.loads(rhythm.CALIBRATION.read_text())
    current = {"s": calibration["instanceThreshold"], "tau": {f: calibration["families"][f]["tau"] for f in ("vertical", "layer")}}
    records = rhythm.cmp_records(dev)
    for r in records:
        r["dataset"] = "cmp"
    records += lmf_records(dev)
    print(f"{len(records)} images; windows …", flush=True)
    sets = {"calibration": [], "cmpTest": [], "lmfTest": [], "lmfGlazedOrBanded": []}
    glazed_images = rectified = total = 0
    for k, r in enumerate(records):
        cells = windows_rectified(r)
        rectified += int(sum(c["rectified"] for c in cells))
        total += len(cells)
        if r["split"] == "calibration":
            sets["calibration"] += cells
        elif r["dataset"] == "cmp":
            sets["cmpTest"] += cells
        else:
            sets["lmfTest"] += cells
            if glazed_or_banded(r["label"]):
                sets["lmfGlazedOrBanded"] += cells
                glazed_images += 1
        if k % 100 == 0:
            print(f"  {k} images, {time.perf_counter() - t0:.0f} s", flush=True)
    print({k: len(v) for k, v in sets.items()}, f"rectified windows {rectified}/{total}", flush=True)

    ref_cal = truth(sets["calibration"])
    params = {"A": current}
    for cand in ("R", "S"):
        tau = {}
        for f in ("vertical", "layer"):
            accs = [rhythm.balanced_accuracy(flags_065(sets["calibration"], cand, {"s": current["s"], "tau": {f: t, "vertical" if f == "layer" else "layer": t}})[f], ref_cal[f])
                    for t in rhythm.TAU_GRID]
            tau[f] = float(rhythm.TAU_GRID[int(np.argmax(accs))])
        params[cand] = {"s": current["s"], "tau": tau}
        print(cand, params[cand], flush=True)

    table = {}
    for cand, p in params.items():
        row = {}
        for name in ("cmpTest", "lmfTest", "lmfGlazedOrBanded"):
            pred, ref = flags_065(sets[name], cand, p), truth(sets[name])
            row[name] = {"balancedAccuracy": float(np.mean([rhythm.balanced_accuracy(pred[f], ref[f]) for f in ("vertical", "layer")])),
                         "precision": float(np.nanmean([precision(pred[f], ref[f]) for f in ("vertical", "layer")])),
                         "byFamily": {f: {"balancedAccuracy": rhythm.balanced_accuracy(pred[f], ref[f]), "precision": precision(pred[f], ref[f])}
                                      for f in ("vertical", "layer")}}
        row["meanOfTestSets"] = float(np.mean([row["cmpTest"]["balancedAccuracy"], row["lmfTest"]["balancedAccuracy"]]))
        table[cand] = row
        print(cand, {k: (round(v["balancedAccuracy"], 3), round(v["precision"], 3)) if isinstance(v, dict) else round(v, 3)
                     for k, v in row.items()}, flush=True)
    a = table["A"]["cmpTest"]
    allowed = [c for c in params if table[c]["cmpTest"]["balancedAccuracy"] >= a["balancedAccuracy"] - TOLERANCE
               and table[c]["cmpTest"]["precision"] >= a["precision"] - 1e-12]
    choice = max(allowed, key=lambda c: (round(table[c]["meanOfTestSets"], 6), c == "A"))
    if table[choice]["meanOfTestSets"] <= table["A"]["meanOfTestSets"]:
        choice = "A"
    calibration["rectifiedComparison"] = {
        "date": time.strftime("%Y-%m-%d"), "prompt": "065",
        "candidates": {"A": "current: SAM 3 window and balcony centres, score >= s, current tau",
                       "R": "A with the centres rectified per window (horizontal and vertical vanishing points), tau recalibrated",
                       "S": "no instances: rectified gradient profiles per window, autocorrelation peak at lags 5-100 px, own tau"},
        "calibration": "CMP Facade base even images + LabelMeFacade train (100)",
        "tests": {"cmpTest": "CMP Facade base odd images", "lmfTest": "LabelMeFacade test",
                  "lmfGlazedOrBanded": f"LabelMeFacade test images, glazed or banded ({glazed_images} images)"},
        "windows": {k: len(v) for k, v in sets.items()}, "rectifiedWindows": [rectified, total],
        "params": params, "results": table,
        "rule": f"highest mean balanced accuracy over the two test sets among candidates within {TOLERANCE} of A on CMP odd "
                "and with precision on CMP odd not below A's; otherwise A",
        "choice": choice, "seconds": round(time.perf_counter() - t0, 1),
    }
    rhythm.CALIBRATION.write_text(json.dumps(calibration, indent=1))
    print(f"choice: {choice}")
    return 0


def main() -> int:
    if "--rectified" in sys.argv[1:]:
        return main_rectified()
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    t0 = time.perf_counter()
    calibration = json.loads(rhythm.CALIBRATION.read_text())
    current = {"s": calibration["instanceThreshold"], "tau": {f: calibration["families"][f]["tau"] for f in ("vertical", "layer")}}
    records = cmp_with_extra(dev) + lmf_records(dev)
    print(f"{len(records)} images; windows …", flush=True)
    sets = {"calibration": [], "cmpTest": [], "lmfTest": [], "lmfGlazedOrBanded": []}
    glazed_images = 0
    for r in records:
        cells = windows(r)
        if r["split"] == "calibration":
            sets["calibration"] += cells
        elif r["dataset"] == "cmp":
            sets["cmpTest"] += cells
        else:
            sets["lmfTest"] += cells
            if glazed_or_banded(r["label"]):
                sets["lmfGlazedOrBanded"] += cells
                glazed_images += 1
    print({k: len(v) for k, v in sets.items()}, f"glazed or banded test images: {glazed_images}", flush=True)

    params = {"A": current}
    for cand in ("B", "C", "D"):
        params[cand] = calibrate(sets["calibration"], cand, current)
        print(cand, params[cand], flush=True)
    table = {c: {k: mean_ba(sets[k], c, p) for k in ("cmpTest", "lmfTest", "lmfGlazedOrBanded")} for c, p in params.items()}
    for c, row in table.items():
        row["meanOfTestSets"] = float(np.mean([row["cmpTest"], row["lmfTest"]]))
        print(c, {k: round(v, 3) for k, v in row.items()}, flush=True)
    allowed = [c for c in params if table[c]["cmpTest"] >= table["A"]["cmpTest"] - TOLERANCE]
    choice = max(allowed, key=lambda c: (round(table[c]["meanOfTestSets"], 6), c == "A"))
    if table[choice]["meanOfTestSets"] <= table["A"]["meanOfTestSets"]:
        choice = "A"

    calibration["glassComparison"] = {
        "date": time.strftime("%Y-%m-%d"), "prompt": "053",
        "candidates": {"A": "current: SAM 3 window and balcony, score >= s, current tau",
                       "B": "A plus SAM 3 'ribbon window' and 'curtain wall panel' at score >= sB, tau recalibrated",
                       "C": "A plus LSD segments as items where a window has fewer than 3 instances, own threshold tauLine",
                       "D": "A with s and tau calibrated jointly"},
        "calibration": "CMP Facade base even images + LabelMeFacade train (100)",
        "tests": {"cmpTest": "CMP Facade base odd images", "lmfTest": "LabelMeFacade test (845)",
                  "lmfGlazedOrBanded": f"LabelMeFacade test images whose labelled windows cover >= {GLAZED_SHARE:.0%} of the building "
                                       f"or whose median window is >= {RIBBON_RATIO:g}x as wide as tall ({glazed_images} images)"},
        "windows": {k: len(v) for k, v in sets.items()},
        "params": params, "meanBalancedAccuracy": table,
        "rule": f"highest mean over the two test sets among candidates within {TOLERANCE} of A on CMP odd; otherwise A",
        "choice": choice, "seconds": round(time.perf_counter() - t0, 1),
    }
    rhythm.CALIBRATION.write_text(json.dumps(calibration, indent=1))
    print(f"choice: {choice}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
