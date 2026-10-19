"""Street categories and ground floor for every example photo.

Writes public/precomputed/areas/<photo-id>.json (AreaFile in the specification)
and a check overlay per photo to .cache/check/. Façade elements other than the
ground floor are added to the same files by elements.py (prompt 023).
"""

import json
import sys
import time

import numpy as np
import torch
from PIL import Image, ImageDraw

import argparse

from common import CACHE, CATEGORIES, CATEGORY_IDS, EXAMPLES, ONEFORMER, ONEFORMER_REVISION, OUT, OneFormer, area_entry, decode_rle, device, mask_size, photos, write_area_file
from groundfloor import CAMERA_HEIGHT_M, STOREY_HEIGHT_M, estimate_horizon, ground_floor, ground_floor_equirectangular, head_offset

MAX_FILE_BYTES = 150_000
# Okabe–Ito colours for the check overlays; white and grey for the last two.
COLOURS = ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#D55E00", "#0072B2", "#CC79A7", "#FFFFFF", "#888888"]


def check(path) -> list[str]:
    """The acceptance invariants of prompt 021 for one written file."""
    data = json.loads(path.read_text())
    w, h = data["width"], data["height"]
    problems = []
    if path.stat().st_size > MAX_FILE_BYTES:
        problems.append(f"{path.stat().st_size} bytes")
    masks = {}
    for area in data["areas"]:
        if sum(area["rle"]) != w * h:
            problems.append(f"{area['id']}: runs sum to {sum(area['rle'])}")
            continue
        masks[area["id"]] = decode_rle(area["rle"], w, h)
    cover = sum(masks[c].astype(int) for c in CATEGORY_IDS if c in masks)
    if not (cover == 1).all():
        problems.append("categories do not cover every pixel exactly once")
    shares = sum(a["share"] for a in data["areas"] if a["group"] == "category")
    if abs(shares - 1) > 1e-9:
        problems.append(f"category shares sum to {shares}")
    if (masks["ground-floor"] & ~masks["facade"]).any():
        problems.append("ground floor outside facade")
    return problems


def overlay(image: Image.Image, categories: np.ndarray, floor: np.ndarray, horizon: float, path) -> None:
    w, h = categories.shape[1] * 2, categories.shape[0] * 2
    photo = np.asarray(image.resize((w, h), Image.LANCZOS).convert("L").convert("RGB"), dtype=np.float32)
    palette = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in COLOURS], dtype=np.float32)
    cats = np.kron(categories, np.ones((2, 2), dtype=categories.dtype))
    blend = photo * 0.5 + palette[cats] * 0.5
    gf = np.kron(floor, np.ones((2, 2), dtype=bool))
    blend[gf] = blend[gf] * 0.4 + np.array([255, 0, 255]) * 0.6
    out = Image.fromarray(blend.astype(np.uint8))
    draw = ImageDraw.Draw(out)
    y = horizon * 2
    for x in range(0, w, 24):
        draw.line((x, y, x + 12, y), fill=(255, 40, 40), width=3)
    for k, cid in enumerate(CATEGORY_IDS):
        draw.rectangle((8, 8 + 18 * k, 22, 22 + 18 * k), fill=COLOURS[k])
        draw.text((28, 9 + 18 * k), CATEGORIES[cid][0], fill=(255, 255, 255))
    draw.rectangle((8, 8 + 18 * 9, 22, 22 + 18 * 9), fill=(255, 0, 255))
    draw.text((28, 9 + 18 * 9), "Ground floor", fill=(255, 255, 255))
    out.save(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only-missing", action="store_true", help="only photos without an area file (prompt 051)")
    args = parser.parse_args()
    dev = device()
    print(f"Device: {dev} ({torch.cuda.get_device_name(0) if dev.type == 'cuda' else 'CPU'})")
    OUT.mkdir(parents=True, exist_ok=True)
    (CACHE / "check").mkdir(parents=True, exist_ok=True)
    model = OneFormer(dev)
    if dev.type == "cuda":
        torch.cuda.reset_peak_memory_stats()

    header = f"{'photo':42} {'horizon':>15} {'head%':>6} " + " ".join(f"{c[:6]:>6}" for c in CATEGORY_IDS) + f" {'ground':>6} {'s':>5}"
    print(header)
    failures = 0
    for photo in photos():
        if args.only_missing and (OUT / f"{photo['id']}.json").exists():
            continue
        t0 = time.perf_counter()
        image = Image.open(EXAMPLES / photo["file"]).convert("RGB")
        size = mask_size(image.width, image.height)
        categories = model.categories(image, size)
        kind = photo.get("imageKind")
        if kind == "panorama":
            # A level 360° panorama: the horizon is the middle row and rows are elevation angles (prompt 051).
            horizon, method, support = size[1] / 2, "equirectangular", 0
            floor = ground_floor_equirectangular(categories, CATEGORY_IDS, horizon)
        else:
            horizon, method, support = estimate_horizon(np.asarray(image.convert("L")), categories, CATEGORY_IDS)
            floor = ground_floor(categories, CATEGORY_IDS, horizon)
        head = head_offset(categories, CATEGORY_IDS, horizon)
        if dev.type == "cuda":
            torch.cuda.synchronize()
        seconds = time.perf_counter() - t0

        areas = [area_entry(cid, CATEGORIES[cid][0], "category", categories == k) for k, cid in enumerate(CATEGORY_IDS)]
        areas.append(area_entry("ground-floor", "Ground floor", "element", floor, model="ground-floor"))
        # Keep the façade elements that elements.py (prompt 023) added to an earlier file.
        path = OUT / f"{photo['id']}.json"
        previous = json.loads(path.read_text()) if path.exists() else {"areas": [], "models": {}}
        kept = [a for a in previous["areas"] if a["group"] == "element" and a["id"] != "ground-floor"]
        areas += kept
        data = {
            "photo": photo["id"],
            "width": size[0],
            "height": size[1],
            "horizon": {"row": round(horizon, 1), "method": method, "support": support},
            "params": {"cameraHeightM": CAMERA_HEIGHT_M, "storeyHeightM": STOREY_HEIGHT_M},
            "models": {
                "categories": f"{ONEFORMER}@{ONEFORMER_REVISION}",
                "ground-floor": "geometric rule, tools/areas/groundfloor.py",
                **{a["id"]: previous["models"][a["id"]] for a in kept if a["id"] in previous["models"]},
            },
            "areas": areas,
        }
        if kind:
            # Renders: the camera height is unknown, so 1.6 m is assumed; panoramas: equirectangular rows.
            data["imageKind"] = kind
        write_area_file(path, data)
        overlay(image, categories, floor, horizon, CACHE / "check" / f"{photo['id']}.png")
        problems = check(path)
        failures += bool(problems)

        shares = " ".join(f"{(categories == k).mean() * 100:6.1f}" for k in range(len(CATEGORY_IDS)))
        head_text = "–" if head is None else f"{head:+.1f}"
        print(f"{photo['id']:42} {method[:9]:>9} {support:>5} {head_text:>6} {shares} {floor.mean() * 100:6.1f} {seconds:5.2f}"
              + (f"  PROBLEM: {'; '.join(problems)}" if problems else ""))

    if dev.type == "cuda":
        print(f"\nPeak GPU memory: {torch.cuda.max_memory_allocated() / 1e9:.2f} GB")
    sizes = [p.stat().st_size for p in OUT.glob("*.json") if p.name != "validation.json"]
    print(f"{len(sizes)} area files, largest {max(sizes) / 1e3:.0f} kB, {sum(sizes) / 1e6:.2f} MB in total.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
