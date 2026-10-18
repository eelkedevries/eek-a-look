"""Check the automatic areas against human labels, and test the ground floor
and the attention numbers (prompt 022).

  uv run validate.py --all
      eTRIMS and CMP Facade (fetch_validation.py first), the ground-floor
      checks and the attention robustness on the example photos; writes
      public/precomputed/areas/validation.json and the report in
      docs-dev/reference/secondary_background/areas_validation.md.
  uv run validate.py --labels DIR --mapping FILE.json [--images DIR]
      scores any folder of PNG label masks through a mapping file (see
      mappings/), e.g. annotations drawn later by an expert panel.
"""

import argparse
import base64
import datetime
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage, stats

from common import CATEGORIES, CATEGORY_IDS, HERE, ONEFORMER, ONEFORMER_REVISION, OUT, REPO, OneFormer, decode_rle, device, mask_size, photos
from groundfloor import CAMERA_HEIGHT_M, STOREY_HEIGHT_M, ground_floor, head_offset, horizon_row

MAPPINGS = HERE / "mappings"
VALIDATION_JSON = OUT / "validation.json"
REPORT = REPO / "docs-dev" / "reference" / "secondary_background" / "areas_validation.md"
PRECOMPUTED = REPO / "public" / "precomputed"
DEGREES_ACROSS = 1280 / 45.6  # the Zürich study: 45.6 px per degree on 1280 px photos
MIN_SHARE = 0.005
SETTINGS = [(1.6, 4.0), (1.5, 4.0), (1.7, 4.0), (1.6, 3.5), (1.6, 4.5), (1.6, 5.0)]
LAYERS = ["deepgaze-msdb", "deepgaze-iie", "centre-bias"]


# --- datasets -----------------------------------------------------------------

def load_mapping(path: Path, labels: str | None = None, images: str | None = None) -> dict:
    mapping = json.loads(path.read_text())
    for key, override in (("labels", labels), ("images", images)):
        value = override or mapping[key]
        mapping[key] = Path(value) if Path(value).is_absolute() else (HERE / value)
    if mapping.get("objects"):
        mapping["objects"] = HERE / mapping["objects"]
    return mapping


def segment(mapping: dict, model: OneFormer) -> list[dict]:
    """Run the pipeline on every labelled image; labels are resized to the mask size."""
    records = []
    for label_path in sorted(mapping["labels"].glob("*.png")):
        image_path = mapping["images"] / (label_path.stem + mapping["imageSuffix"])
        if not image_path.exists():
            continue
        image = Image.open(image_path).convert("RGB")
        size = mask_size(image.width, image.height)
        cats = model.categories(image, size)
        record = {"name": label_path.stem, "cats": cats,
                  "label": np.asarray(Image.open(label_path).resize(size, Image.NEAREST))}
        if mapping.get("doors"):
            row, method, _ = horizon_row(np.asarray(image.convert("L")), cats == CATEGORY_IDS.index("facade"))
            record["horizon"] = row * size[1] / image.height
            record["method"] = method
            if mapping.get("objects"):
                record["objects"] = np.asarray(Image.open(mapping["objects"] / label_path.name).resize(size, Image.NEAREST))
        records.append(record)
    return records


def score_categories(records: list[dict], mapping: dict) -> dict:
    pairs = {cat: np.array(classes) for cat, classes in mapping["categories"].items()}
    ignore = np.array(mapping.get("ignore", []))
    inter = {c: 0 for c in pairs}
    union = {c: 0 for c in pairs}
    per_image = {c: [] for c in pairs}
    correct = total = 0
    for r in records:
        valid = ~np.isin(r["label"], ignore) if ignore.size else np.ones(r["label"].shape, bool)
        mapped = np.zeros(r["label"].shape, bool)
        for cat, classes in pairs.items():
            gt = np.isin(r["label"], classes) & valid
            pred = (r["cats"] == CATEGORY_IDS.index(cat)) & valid
            i, u = int((gt & pred).sum()), int((gt | pred).sum())
            inter[cat] += i
            union[cat] += u
            if u:
                per_image[cat].append(i / u)
            correct += int((gt & pred).sum())
            mapped |= gt
        total += int(mapped.sum())
    return {
        "name": mapping["name"],
        "images": len(records),
        "categories": {c: {"iou": inter[c] / union[c] if union[c] else None,
                           "meanImageIou": float(np.mean(per_image[c])) if per_image[c] else None}
                       for c in pairs},
        "pixelAccuracy": correct / total if total else None,
    }


def door_check(records: list[dict], door: int, camera_m: float, storey_m: float) -> dict:
    """How much of the human-labelled doors lies inside the computed ground floor."""
    inside_px = door_px = 0
    halves = instances = no_floor = 0
    for r in records:
        floor = ground_floor(r["cats"], CATEGORY_IDS, r["horizon"], camera_m, storey_m)
        doors = r["label"] == door
        if not doors.any():
            continue
        no_floor += not floor.any()
        inside_px += int((doors & floor).sum())
        door_px += int(doors.sum())
        if "objects" in r:
            for obj in np.unique(r["objects"][doors]):
                pixels = (r["objects"] == obj) & doors
                if obj == 0 or pixels.sum() < 20:
                    continue
                instances += 1
                halves += (pixels & floor).sum() >= 0.5 * pixels.sum()
    return {"pixelShareInside": inside_px / door_px if door_px else None,
            "instances": instances, "instancesHalfInside": halves / instances if instances else None,
            "imagesWithDoorsButNoFloor": no_floor}


# --- example photos and maps ---------------------------------------------------

def load_areas(photo_id: str) -> dict:
    data = json.loads((OUT / f"{photo_id}.json").read_text())
    w, h = data["width"], data["height"]
    masks = {a["id"]: decode_rle(a["rle"], w, h) for a in data["areas"]}
    cats = np.zeros((h, w), np.uint8)
    for k, c in enumerate(CATEGORY_IDS):
        cats[masks[c]] = k
    return {"data": data, "masks": masks, "cats": cats}


def grid_for(width: int, height: int) -> tuple[int, int]:
    """(width, height) of the shared grid, as gridFor() in src/maps/saliency-map.ts."""
    half_up = lambda x: int(np.floor(x + 0.5))
    if width >= height:
        return 128, max(1, half_up(128 * height / width))
    return max(1, half_up(128 * width / height)), 128


def centre_bias(gw: int, gh: int, width: int, height: int) -> np.ndarray:
    """As centreBiasValues() in src/models/centre-bias.ts (Clarke & Tatler 2014)."""
    aspect = height / width
    y = ((np.arange(gh) + 0.5) / gh - 0.5) * 2 * aspect
    x = ((np.arange(gw) + 0.5) / gw - 0.5) * 2
    values = np.exp(-(x[None, :] ** 2) / (2 * 0.22) - (y[:, None] ** 2) / (2 * 0.45 * 0.22))
    return values / values.sum()


def decode_map(path: Path) -> np.ndarray:
    d = json.loads(path.read_text())
    values = np.frombuffer(base64.b64decode(d["data"]), dtype="<u2").astype(np.float64)
    values = values.reshape(d["grid"]["height"], d["grid"]["width"])
    return values / values.sum()


def resample(p: np.ndarray, width: int, height: int) -> np.ndarray:
    """Bilinear with cell centres aligned, then normalised: resample() in src/maps/saliency-map.ts."""
    sh, sw = p.shape
    fy = np.clip((np.arange(height) + 0.5) * sh / height - 0.5, 0, sh - 1)
    fx = np.clip((np.arange(width) + 0.5) * sw / width - 0.5, 0, sw - 1)
    y0 = np.floor(fy).astype(int); y1 = np.minimum(y0 + 1, sh - 1); wy = (fy - y0)[:, None]
    x0 = np.floor(fx).astype(int); x1 = np.minimum(x0 + 1, sw - 1); wx = (fx - x0)[None, :]
    top = p[np.ix_(y0, x0)] * (1 - wx) + p[np.ix_(y0, x1)] * wx
    bottom = p[np.ix_(y1, x0)] * (1 - wx) + p[np.ix_(y1, x1)] * wx
    out = np.clip(top * (1 - wy) + bottom * wy, 0, None)
    return out / out.sum()


def layer_map(layer: str, photo: dict, width: int, height: int) -> np.ndarray | None:
    if layer == "centre-bias":
        gw, gh = grid_for(photo["width"], photo["height"])
        grid = centre_bias(gw, gh, photo["width"], photo["height"])
    else:
        path = PRECOMPUTED / layer / f"{photo['id']}.json"
        if not path.exists():
            return None
        grid = decode_map(path)
    return resample(grid, width, height)


def ratio(p: np.ndarray, mask: np.ndarray) -> float | None:
    share = mask.mean()
    return float(p[mask].sum() / share) if share > 0 else None


# --- the full run ----------------------------------------------------------------

def run_all(model: OneFormer) -> dict:
    result: dict = {
        "date": datetime.date.today().isoformat(),
        "tool": {"categories": f"{ONEFORMER}@{ONEFORMER_REVISION}",
                 "groundFloor": {"cameraHeightM": CAMERA_HEIGHT_M, "storeyHeightM": STOREY_HEIGHT_M}},
    }

    t0 = time.perf_counter()
    etrims_map = load_mapping(MAPPINGS / "etrims.json")
    etrims = segment(etrims_map, model)
    cmp_map = load_mapping(MAPPINGS / "cmp.json")
    cmp = segment(cmp_map, model)
    result["categories"] = {"etrims": score_categories(etrims, etrims_map), "cmp": score_categories(cmp, cmp_map)}
    print(f"Segmented {len(etrims)} eTRIMS and {len(cmp)} CMP images in {time.perf_counter() - t0:.0f} s")

    # Ground floor: human-labelled doors, sensitivity, horizons on the example photos.
    examples = {p["id"]: (p, load_areas(p["id"])) for p in photos()}
    base_share = {pid: a["masks"]["ground-floor"].mean() for pid, (_, a) in examples.items()}
    sensitivity = []
    for camera_m, storey_m in SETTINGS:
        shares = [ground_floor(a["cats"], CATEGORY_IDS, a["data"]["horizon"]["row"], camera_m, storey_m).mean()
                  for _, a in examples.values()]
        sensitivity.append({"cameraHeightM": camera_m, "storeyHeightM": storey_m,
                            "meanShareExamples": float(np.mean(shares)),
                            "meanChangeExamples": float(np.mean([s - base_share[pid] for pid, s in zip(examples, shares)])),
                            "etrimsDoors": door_check(etrims, etrims_map["doors"], camera_m, storey_m)})
    horizons = []
    for pid, (_, a) in examples.items():
        hz = a["data"]["horizon"]
        head = head_offset(a["cats"], CATEGORY_IDS, hz["row"])
        horizons.append({"photo": pid, "method": hz["method"], "support": hz["support"],
                         "headOffsetPercent": None if head is None else round(head, 1),
                         "groundFloorShare": round(float(base_share[pid]), 4)})
    result["groundFloor"] = {
        "etrimsDoors": sensitivity[0]["etrimsDoors"],
        "etrimsHorizonMethods": {m: sum(r["method"] == m for r in etrims) for m in ("vanishing-lines", "assumed-level")},
        "sensitivity": sensitivity,
        "examples": horizons,
    }

    # Attention: ratios as they are, with masks eroded and dilated by 1°, and the match with measured gaze.
    ratios: dict = {}
    spread: dict = {layer: {} for layer in ["measured", *LAYERS]}
    rhos: dict = {layer: [] for layer in LAYERS}
    for pid, (photo, a) in examples.items():
        w, h = a["data"]["width"], a["data"]["height"]
        radius = max(1, round(w / DEGREES_ACROSS))
        disk = np.hypot(*np.mgrid[-radius:radius + 1, -radius:radius + 1]) <= radius
        area_ids = [*CATEGORY_IDS, "ground-floor"]
        maps = {layer: layer_map(layer, photo, w, h) for layer in ["measured", *LAYERS]}
        ratios[pid] = {}
        for layer, p in maps.items():
            if p is None:
                continue
            if layer in ("measured", "deepgaze-msdb"):
                ratios[pid][layer] = {aid: round(r, 4) for aid in area_ids if (r := ratio(p, a["masks"][aid])) is not None}
            for aid in area_ids:
                mask = a["masks"][aid]
                if mask.mean() < MIN_SHARE:
                    continue
                variants = [ratio(p, m) for m in (ndimage.binary_erosion(mask, disk), mask, ndimage.binary_dilation(mask, disk))]
                variants = [v for v in variants if v is not None]
                spread[layer].setdefault(aid, []).append((variants[len(variants) // 2] if len(variants) == 3 else ratio(p, mask),
                                                          max(variants) - min(variants)))
        if maps["measured"] is not None:
            big = [aid for aid in area_ids if a["masks"][aid].mean() >= MIN_SHARE]
            measured = [ratio(maps["measured"], a["masks"][aid]) for aid in big]
            for layer in LAYERS:
                rho = stats.spearmanr([ratio(maps[layer], a["masks"][aid]) for aid in big], measured).statistic
                if np.isfinite(rho):
                    rhos[layer].append(float(rho))
    result["robustness"] = {
        "radiusDegrees": 1,
        "summary": {layer: {aid: {"medianRatio": float(np.median([v[0] for v in vals])),
                                  "medianRange": float(np.median([v[1] for v in vals])),
                                  "photos": len(vals)}
                            for aid, vals in areas.items()}
                    for layer, areas in spread.items() if areas},
    }
    result["measuredMatch"] = {layer: {"meanSpearman": float(np.mean(v)), "sd": float(np.std(v)), "photos": len(v)}
                               for layer, v in rhos.items() if v}
    result["measuredMatch"]["unisal"] = "not computed: its browser resizing and priors are not reproduced in Python"
    result["measuredMatch"]["classic-salience"] = "not computed: it exists only in the browser"
    result["ratios"] = ratios
    result["elements"] = None
    return result


# --- output ------------------------------------------------------------------------

def fmt(x, digits=2) -> str:
    return "–" if x is None else f"{x:.{digits}f}"


def report(result: dict) -> str:
    cats = result["categories"]
    gf = result["groundFloor"]
    lines = [
        "# Areas in the image: validation",
        "",
        f"Generated by `tools/areas/validate.py --all` on {result['date']} (prompt 022). Categories from "
        f"`{result['tool']['categories']}`; ground floor with camera height "
        f"{result['tool']['groundFloor']['cameraHeightM']} m and storey height {result['tool']['groundFloor']['storeyHeightM']} m. "
        "Human labels: eTRIMS 8-class (Korč & Förstner 2009; 60 street-level photos) and the CMP Facade base set "
        "(Tyleček & Šára 2013; 378 rectified façades). Labels are compared at the mask size (640 px on the long side). "
        "Nothing was tuned on these datasets.",
        "",
        "## Street categories against human labels",
        "",
        "| Category | eTRIMS classes | IoU | Mean per-image IoU |",
        "|---|---|---|---|",
    ]
    names = {"facade": "building + window + door", "sky": "sky", "greenery": "vegetation",
             "street-surface": "road + pavement", "vehicles": "car"}
    for cat, s in cats["etrims"]["categories"].items():
        lines.append(f"| {CATEGORIES[cat][0]} | {names[cat]} | {fmt(s['iou'])} | {fmt(s['meanImageIou'])} |")
    c = cats["cmp"]["categories"]["facade"]
    lines += [
        "",
        f"Pixel accuracy over the mapped eTRIMS classes: {fmt(cats['etrims']['pixelAccuracy'])}. "
        f"CMP Facade, façade outline (every class except background): IoU {fmt(c['iou'])}, "
        f"mean per-image IoU {fmt(c['meanImageIou'])}, pixel accuracy {fmt(cats['cmp']['pixelAccuracy'])}.",
        "",
        "## Ground floor",
        "",
        "Doors belong to the ground floor, so the share of human-labelled eTRIMS doors inside the computed "
        "ground floor tests the rule. eTRIMS horizons: "
        + ", ".join(f"{m} {n}" for m, n in gf["etrimsHorizonMethods"].items()) + ".",
        "",
        "| Camera height | Storey height | Door pixels inside | Door instances ≥ half inside | Images with doors but no floor | Mean ground-floor share, example photos | Change |",
        "|---|---|---|---|---|---|---|",
    ]
    for s in gf["sensitivity"]:
        d = s["etrimsDoors"]
        lines.append(f"| {s['cameraHeightM']} m | {s['storeyHeightM']} m | {fmt(d['pixelShareInside'])} | "
                     f"{fmt(d['instancesHalfInside'])} (n = {d['instances']}) | {d['imagesWithDoorsButNoFloor']} | "
                     f"{fmt(s['meanShareExamples'] * 100, 1)}% | {s['meanChangeExamples'] * 100:+.1f} pp |")
    lines += [
        "",
        "Horizon per example photo. The head offset is the median top row of standing people minus the "
        "horizon, in % of the height; near 0 is expected for an eye-height camera.",
        "",
        "| Photo | Horizon | Supporting segments | Head offset | Ground floor |",
        "|---|---|---|---|---|",
    ]
    for e in gf["examples"]:
        lines.append(f"| {e['photo']} | {e['method']} | {e['support']} | {fmt(e['headOffsetPercent'], 1)} | "
                     f"{e['groundFloorShare'] * 100:.1f}% |")
    lines += [
        "",
        "## Attention ÷ size",
        "",
        "Median over the example photos of each area's attention ÷ size (1.0 = what its size alone predicts), "
        "and the median range when the masks are eroded and dilated by 1° (photo width / 28). Areas under "
        "0.5% of a photo are left out.",
        "",
    ]
    summary = result["robustness"]["summary"]
    layers = [l for l in ["measured", *LAYERS] if l in summary]
    lines.append("| Area | " + " | ".join(f"{l}: ratio (range)" for l in layers) + " |")
    lines.append("|---|" + "---|" * len(layers))
    for aid in [*CATEGORY_IDS, "ground-floor"]:
        cells = []
        for l in layers:
            s = summary[l].get(aid)
            cells.append("–" if s is None else f"{s['medianRatio']:.2f} ({s['medianRange']:.2f}, n = {s['photos']})")
        label = CATEGORIES[aid][0] if aid in CATEGORIES else "Ground floor"
        lines.append(f"| {label} | " + " | ".join(cells) + " |")
    lines += [
        "",
        "Match with measured gaze on the 12 Zürich photos: per photo, the Spearman correlation between a "
        "layer's ratios and the measured ratios across areas of at least 0.5%; mean (SD) over the photos.",
        "",
        "| Layer | Mean ρ | SD | Photos |",
        "|---|---|---|---|",
    ]
    for layer, m in result["measuredMatch"].items():
        if isinstance(m, dict):
            lines.append(f"| {layer} | {m['meanSpearman']:.2f} | {m['sd']:.2f} | {m['photos']} |")
        else:
            lines.append(f"| {layer} | {m} | | |")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--labels")
    parser.add_argument("--images")
    parser.add_argument("--mapping")
    args = parser.parse_args()
    if not args.all and not (args.labels and args.mapping):
        parser.error("use --all, or --labels with --mapping")

    dev = device()
    model = OneFormer(dev)
    if args.all:
        result = run_all(model)
        VALIDATION_JSON.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        REPORT.write_text(report(result))
        print(report(result))
        print(f"Wrote {VALIDATION_JSON.relative_to(REPO)} ({VALIDATION_JSON.stat().st_size / 1e3:.0f} kB) and {REPORT.relative_to(REPO)}")
        return 0

    mapping = load_mapping(Path(args.mapping), args.labels, args.images)
    records = segment(mapping, model)
    scores = score_categories(records, mapping)
    print(json.dumps(scores, indent=1))
    if mapping.get("doors"):
        print(json.dumps({"doors": door_check(records, mapping["doors"], CAMERA_HEIGHT_M, STOREY_HEIGHT_M)}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
