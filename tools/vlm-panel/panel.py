"""A simulated panel: a local vision-language model, run as eight members,
judges each example photo on three design principles (prompt 024).

The principles are those of the HvA expert panel in Spanjar & Suurenbroek
(2020): horizontal–vertical rhythm and variety, active ground floor, tactile
materials. Their wording here is this project's reading (prompt.md). A verdict
counts when at least 6 of 8 members agree; otherwise it is "ambiguous", as the
panel's was without consensus. This is an AI judgement, not an expert one.

  uv run panel.py            writes public/precomputed/vlm-panel/panel.json
  uv run panel.py --graded   ratings 0–4 with evidence boxes (prompt 044, prompt_graded.md);
                             writes public/precomputed/vlm-panel/panel-graded.json
"""

import argparse
import datetime
import gc
import hashlib
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from scipy import stats

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
EXAMPLES = REPO / "public" / "examples"
AREAS = REPO / "public" / "precomputed" / "areas"
OUT = REPO / "public" / "precomputed" / "vlm-panel" / "panel.json"
OUT_GRADED = OUT.with_name("panel-graded.json")
QUALITIES = REPO / "public" / "precomputed" / "qualities"

MODELS = [  # tried in order: (repo, revision, quantisation)
    ("Qwen/Qwen3-VL-8B-Instruct", "0c351dd01ed87e9c1b53cbc748cba10e6187ff3b", "4-bit NF4"),
    ("Qwen/Qwen3-VL-4B-Instruct", "ebb281ec70b05090aa6165b016eac8ec08e71b17", "8-bit"),
]
MAX_GPU_GB = 7.5
ROLES = ["architect", "landscape architect", "urban designer", "planner"]
SEEDS = {"first": [11, 23], "second": [37, 41]}  # the second run checks stability
PRINCIPLES = ["rhythm", "groundFloor", "materials"]
CONSENSUS = 6
MAX_PIXELS = 1_000_000
RETRIES = 2


def prompt_parts(name: str = "prompt.md") -> tuple[str, str, str]:
    text = (HERE / name).read_text()
    blocks = re.findall(r"```text\n(.*?)```", text, re.S)
    system, instruction = blocks[0].strip(), blocks[1].strip()
    digest = hashlib.sha256((system + "\n---\n" + instruction).encode()).hexdigest()
    return system, instruction, digest


def load_model(probe: Image.Image, system: str, instruction: str):
    """The first model that loads and answers a probe within MAX_GPU_GB."""
    from transformers import AutoProcessor, BitsAndBytesConfig, Qwen3VLForConditionalGeneration

    for repo, rev, quant in MODELS:
        model = None
        try:
            config = (BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16)
                      if quant.startswith("4") else BitsAndBytesConfig(load_in_8bit=True))
            torch.cuda.reset_peak_memory_stats()
            model = Qwen3VLForConditionalGeneration.from_pretrained(repo, revision=rev, quantization_config=config, device_map="cuda:0").eval()
            processor = AutoProcessor.from_pretrained(repo, revision=rev)
            ask(model, processor, probe, system.format(role=ROLES[0]), instruction, 0)
            peak = torch.cuda.max_memory_allocated() / 1e9
            if peak <= MAX_GPU_GB:
                return model, processor, (repo, rev, quant)
            print(f"{repo} ({quant}) peaked at {peak:.2f} GB, above {MAX_GPU_GB} GB")
        except (torch.cuda.OutOfMemoryError, RuntimeError, ValueError) as e:
            print(f"{repo} ({quant}) failed: {type(e).__name__}: {str(e)[:200]}")
        del model
        gc.collect(); torch.cuda.empty_cache()
    raise SystemExit("No model fits.")


def fit(image: Image.Image) -> Image.Image:
    scale = min(1.0, (MAX_PIXELS / (image.width * image.height)) ** 0.5)
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS) if scale < 1 else image


def parse(text: str) -> dict | None:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    out = {}
    for p in PRINCIPLES:
        item = data.get(p)
        if not isinstance(item, dict) or item.get("verdict") not in ("present", "absent") or not str(item.get("evidence", "")).strip():
            return None
        out[p] = {"verdict": item["verdict"], "evidence": str(item["evidence"]).strip()}
    return out


def parse_graded(text: str) -> dict | None:
    """Ratings 0–4, one evidence sentence and up to three boxes (relative 0–1000) per principle."""
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    out = {}
    for p in PRINCIPLES:
        item = data.get(p)
        if not isinstance(item, dict) or not isinstance(item.get("rating"), (int, float)) or not str(item.get("evidence", "")).strip():
            return None
        rating = item["rating"]
        if rating != int(rating) or not 0 <= rating <= 4:
            return None
        boxes = []
        for box in (item.get("boxes") or [])[:3]:
            coords = box.get("bbox_2d") if isinstance(box, dict) else None
            if not (isinstance(coords, list) and len(coords) == 4 and all(isinstance(v, (int, float)) for v in coords)):
                return None
            x1, y1, x2, y2 = (min(1000.0, max(0.0, float(v))) for v in coords)
            if x2 > x1 and y2 > y1:
                boxes.append({"bbox": [x1, y1, x2, y2], "label": str(box.get("label", "")).strip()[:60]})
        out[p] = {"rating": int(rating), "evidence": str(item["evidence"]).strip(), "boxes": boxes}
    return out


@torch.no_grad()
def ask(model, processor, image: Image.Image, system: str, instruction: str, seed: int,
        parser=parse, max_new_tokens: int = 300) -> dict | None:
    messages = [
        {"role": "system", "content": [{"type": "text", "text": system}]},
        {"role": "user", "content": [{"type": "image", "image": image}, {"type": "text", "text": instruction}]},
    ]
    inputs = processor.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt").to(model.device)
    for attempt in range(1 + RETRIES):
        torch.manual_seed(seed + 1000 * attempt)
        ids = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=True, temperature=0.7, top_p=0.9)
        answer = processor.batch_decode(ids[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0]
        parsed = parser(answer)
        if parsed:
            return parsed
    return None


def consensus(votes: list[str | None]) -> str:
    present, absent = votes.count("present"), votes.count("absent")
    return "present" if present >= CONSENSUS else "absent" if absent >= CONSENSUS else "ambiguous"


def fleiss_kappa(counts: np.ndarray) -> float:
    """Fleiss' kappa with a varying number of raters per subject; counts is subjects × categories."""
    n = counts.sum(1)
    keep = n >= 2
    counts, n = counts[keep], n[keep]
    p_i = ((counts ** 2).sum(1) - n) / (n * (n - 1))
    p_j = counts.sum(0) / counts.sum()
    p_bar, p_e = p_i.mean(), (p_j ** 2).sum()
    return float((p_bar - p_e) / (1 - p_e)) if p_e < 1 else float("nan")


def ground_floor_open_share(photo_id: str) -> float | None:
    """Share of the ground floor covered by entrances and shopfronts (area files from 021 and 023)."""
    path = AREAS / f"{photo_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    w, h = data["width"], data["height"]

    def mask(aid):
        area = next((a for a in data["areas"] if a["id"] == aid), None)
        if area is None:
            return None
        values = np.zeros(len(area["rle"]), bool)
        values[1::2] = True
        return np.repeat(values, area["rle"]).reshape(h, w)

    floor, doors, shops = mask("ground-floor"), mask("entrances"), mask("shopfronts")
    if floor is None or doors is None or shops is None or not floor.any():
        return None
    return float((floor & (doors | shops)).sum() / floor.sum())


def run(model, processor, photos: list[dict], system: str, instruction: str, seeds: list[int]) -> dict:
    results = {}
    for photo in photos:
        image = fit(Image.open(EXAMPLES / photo["file"]).convert("RGB"))
        t0 = time.perf_counter()
        members = []
        for role in ROLES:
            for seed in seeds:
                members.append({"role": role, "seed": seed, "answer": ask(model, processor, image, system.format(role=role), instruction, seed)})
        results[photo["id"]] = {"members": members, "seconds": time.perf_counter() - t0}
        votes = {p: [m["answer"][p]["verdict"] if m["answer"] else None for m in members] for p in PRINCIPLES}
        print(f"{photo['id']:42} " + " ".join(f"{p[:6]}={consensus(v)[:4]}({v.count('present')}/{v.count('absent')})" for p, v in votes.items())
              + f"  {results[photo['id']]['seconds']:.0f} s", flush=True)
    return results


# --- graded mode (prompt 044) ----------------------------------------------------

GRADED_TOKENS = 700
BOX_MARGIN = 0.02  # ground floor dilated by 2% of the width for the box check


def krippendorff_ordinal(units: list[list[int]], categories: int = 5) -> float | None:
    """Krippendorff's alpha with the ordinal metric; units are lists of ratings (missing left out)."""
    o = np.zeros((categories, categories))
    for values in units:
        m = len(values)
        if m < 2:
            continue
        counts = np.bincount(values, minlength=categories).astype(float)
        o += (np.outer(counts, counts) - np.diag(counts)) / (m - 1)
    n_c = o.sum(1)
    n = n_c.sum()
    if n < 2:
        return None
    delta = np.zeros((categories, categories))
    for c in range(categories):
        for k in range(categories):
            lo, hi = min(c, k), max(c, k)
            delta[c, k] = (n_c[lo:hi + 1].sum() - (n_c[c] + n_c[k]) / 2) ** 2
    d_o = (o * delta).sum() / n
    d_e = (np.outer(n_c, n_c) * delta).sum() / (n * (n - 1))
    return float(1 - d_o / d_e) if d_e > 0 else None


def run_graded(model, processor, photos: list[dict], system: str, instruction: str, seeds: list[int]) -> dict:
    results = {}
    for photo in photos:
        image = fit(Image.open(EXAMPLES / photo["file"]).convert("RGB"))
        t0 = time.perf_counter()
        members = []
        for role in ROLES:
            for seed in seeds:
                members.append({"role": role, "seed": seed, "answer": ask(model, processor, image, system.format(role=role), instruction,
                                                                          seed, parser=parse_graded, max_new_tokens=GRADED_TOKENS)})
        results[photo["id"]] = {"members": members, "seconds": time.perf_counter() - t0}
        ratings = {p: [m["answer"][p]["rating"] for m in members if m["answer"]] for p in PRINCIPLES}
        print(f"{photo['id']:42} " + " ".join(f"{p[:6]}={np.median(r) if r else float('nan'):.1f}({','.join(map(str, r))})" for p, r in ratings.items())
              + f"  {results[photo['id']]['seconds']:.0f} s", flush=True)
    return results


def area_masks(photo_id: str) -> dict | None:
    """Mask-grid regions for the box check: dilated ground floor, façade, eye-level zone (prompt 042)."""
    from scipy import ndimage

    path = AREAS / f"{photo_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    w, h = data["width"], data["height"]

    def decode(rle):
        values = np.zeros(len(rle), bool)
        values[1::2] = True
        return np.repeat(values, rle).reshape(h, w)

    get = lambda aid: decode(next(a for a in data["areas"] if a["id"] == aid)["rle"])
    radius = max(1, round(BOX_MARGIN * w))
    disk = np.hypot(*np.mgrid[-radius:radius + 1, -radius:radius + 1]) <= radius
    regions = {"groundFloor": ndimage.binary_dilation(get("ground-floor"), disk), "rhythm": get("facade")}
    quality = QUALITIES / f"{photo_id}.json"
    if quality.exists():
        materials = json.loads(quality.read_text())["principles"].get("materials")
        zone = next((e for e in materials["evidence"] if e["id"] == "eye-level-zone"), None) if materials else None
        if zone:
            regions["materials"] = decode(zone["rle"])
    return {"width": w, "height": h, **regions}


def to_grid(box: list[float], w: int, h: int) -> list[int]:
    x1, y1, x2, y2 = box
    return [int(np.floor(x1 / 1000 * w)), int(np.floor(y1 / 1000 * h)), int(np.ceil(x2 / 1000 * w)), int(np.ceil(y2 / 1000 * h))]


def main_graded() -> int:
    system, instruction, digest = prompt_parts("prompt_graded.md")
    photos = json.loads((EXAMPLES / "examples.json").read_text())
    probe = fit(Image.open(EXAMPLES / photos[0]["file"]).convert("RGB"))
    model, processor, (repo, rev, quant) = load_model(probe, system, instruction)
    print(f"Model: {repo}@{rev} ({quant}); peak after a probe {torch.cuda.max_memory_allocated() / 1e9:.2f} GB")
    answer = ask(model, processor, probe, system.format(role=ROLES[0]), instruction, 0, parser=parse_graded, max_new_tokens=GRADED_TOKENS)
    print(f"Probe on {photos[0]['id']} (format check only): {json.dumps(answer, ensure_ascii=False)[:600]}")

    first = run_graded(model, processor, photos, system, instruction, SEEDS["first"])
    print("\nSecond run (other seeds) for stability")
    second = run_graded(model, processor, photos, system, instruction, SEEDS["second"])
    peak = torch.cuda.max_memory_allocated() / 1e9

    out_photos, units = {}, {p: [] for p in PRINCIPLES}
    stable = total = 0
    inside = {p: [0, 0] for p in PRINCIPLES}  # [box pixels inside the region, box pixels]
    medians = {p: {} for p in PRINCIPLES}
    for photo in photos:
        pid = photo["id"]
        regions = area_masks(pid)
        entry = {}
        for p in PRINCIPLES:
            answers = [m for m in first[pid]["members"] if m["answer"]]
            ratings = [m["answer"][p]["rating"] for m in answers]
            again = [m["answer"][p]["rating"] for m in second[pid]["members"] if m["answer"]]
            median = float(np.median(ratings)) if ratings else None
            if median is not None and again:
                stable += abs(float(np.median(again)) - median) <= 0.5
                total += 1
            units[p].append(ratings)
            medians[p][pid] = median
            closest = min(answers, key=lambda m: abs(m["answer"][p]["rating"] - median)) if answers else None
            boxes = []
            for k, m in enumerate(first[pid]["members"]):
                if not m["answer"]:
                    continue
                for b in m["answer"][p]["boxes"]:
                    grid = to_grid(b["bbox"], regions["width"], regions["height"]) if regions else None
                    boxes.append({"member": k, "label": b["label"], "box": grid})
                    if regions and p in regions and grid:
                        x0, y0, x1, y1 = grid
                        inside[p][0] += int(regions[p][y0:y1, x0:x1].sum())
                        inside[p][1] += max(0, (x1 - x0) * (y1 - y0))
            entry[p] = {"ratings": [m["answer"][p]["rating"] if m["answer"] else None for m in first[pid]["members"]],
                        "median": median,
                        "iqr": float(np.subtract(*np.percentile(ratings, [75, 25]))) if ratings else None,
                        "evidence": closest["answer"][p]["evidence"] if closest else None,
                        "boxes": boxes}
        out_photos[pid] = entry

    alpha = {p: krippendorff_ordinal(u) for p, u in units.items()}
    discrimination = {p: {"distinctMedians": len({m for m in medians[p].values() if m is not None}),
                          "min": min(m for m in medians[p].values() if m is not None),
                          "max": max(m for m in medians[p].values() if m is not None)} for p in PRINCIPLES}
    box_share = {p: (v[0] / v[1] if v[1] else None) for p, v in inside.items()}
    main_indicator = {"groundFloor": "openShare", "rhythm": "rhythmicShare", "materials": "texturedShare"}
    spearman = {}
    for p, key in main_indicator.items():
        pairs = []
        for pid, med in medians[p].items():
            path = QUALITIES / f"{pid}.json"
            result = json.loads(path.read_text())["principles"].get(p) if path.exists() else None
            value = result["indicators"].get(key) if result else None
            if med is not None and value is not None:
                pairs.append((med, value))
        rho = stats.spearmanr(*zip(*pairs)).statistic if len(pairs) >= 3 else None
        spearman[p] = {"indicator": key, "rho": None if rho is None or not np.isfinite(rho) else float(rho), "photos": len(pairs)}
    seconds = float(np.mean([first[pid]["seconds"] for pid in first]))

    result = {
        "date": datetime.date.today().isoformat(),
        "model": f"{repo}@{rev}", "licence": "Apache-2.0", "quantisation": quant,
        "promptSha256": digest, "members": [f"{r} (seeds {', '.join(map(str, SEEDS['first']))})" for r in ROLES],
        "scale": {"0": "absent", "1": "a trace", "2": "partly present", "3": "clearly present", "4": "strongly present throughout"},
        "boxes": "mask grid of the area file: [x0, y0, x1, y1]; converted from Qwen3-VL's relative 0–1000 bbox_2d",
        "krippendorffAlphaOrdinal": alpha,
        "discrimination": discrimination,
        "stability": {"medianWithinHalf": stable / total if total else None, "labels": total, "secondRunSeeds": SEEDS["second"]},
        "boxesInsideRegion": {"label": "exploratory: share of box area inside the matching automatic region (ground floor dilated by 2% "
                                       "of the width; façade; eye-level zone)", **box_share},
        "spearmanWithImageMeasure": {"label": "exploratory: two automated methods, not a validation", **spearman},
        "secondsPerPhoto": round(seconds, 1), "peakGpuGb": round(peak, 2),
        "photos": out_photos,
    }
    OUT_GRADED.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    print("\nKrippendorff's alpha (ordinal): " + ", ".join(f"{p} {'undefined' if a is None else f'{a:.2f}'}" for p, a in alpha.items()))
    print("Discrimination: " + "; ".join(f"{p} {d['distinctMedians']} distinct medians, {d['min']}–{d['max']}" for p, d in discrimination.items()))
    print(f"Stability: {stable}/{total} medians within 0.5 in the second run")
    print("Boxes inside region: " + ", ".join(f"{p} {'–' if s is None else f'{s:.0%}'}" for p, s in box_share.items()))
    print("Spearman with the image measure (exploratory): " + ", ".join(
        f"{p} ({v['indicator']}) {'–' if v['rho'] is None else format(v['rho'], '.2f')} n={v['photos']}" for p, v in spearman.items()))
    print(f"Time per photo (8 members): {seconds:.0f} s; peak GPU memory {peak:.2f} GB")
    print(f"Wrote {OUT_GRADED.relative_to(REPO)} ({OUT_GRADED.stat().st_size / 1e3:.0f} kB)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--graded", action="store_true")
    if parser.parse_args().graded:
        return main_graded()
    system, instruction, digest = prompt_parts()
    photos = json.loads((EXAMPLES / "examples.json").read_text())
    probe = fit(Image.open(EXAMPLES / photos[0]["file"]).convert("RGB"))
    model, processor, (repo, rev, quant) = load_model(probe, system, instruction)
    print(f"Model: {repo}@{rev} ({quant}); peak after a probe {torch.cuda.max_memory_allocated() / 1e9:.2f} GB")

    first = run(model, processor, photos, system, instruction, SEEDS["first"])
    print("\nSecond run (other seeds) for stability")
    second = run(model, processor, photos, system, instruction, SEEDS["second"])
    peak = torch.cuda.max_memory_allocated() / 1e9

    out_photos, kappa_counts = {}, {p: [] for p in PRINCIPLES}
    same = total = 0
    for photo in photos:
        pid = photo["id"]
        members = first[pid]["members"]
        entry = {}
        for p in PRINCIPLES:
            votes = [m["answer"][p]["verdict"] if m["answer"] else None for m in members]
            label = consensus(votes)
            evidence = [m["answer"][p]["evidence"] for m in members if m["answer"] and m["answer"][p]["verdict"] == label][:2]
            entry[p] = {"consensus": label, "votes": {"present": votes.count("present"), "absent": votes.count("absent"),
                                                       "missing": votes.count(None)}, "evidence": evidence}
            kappa_counts[p].append([votes.count("present"), votes.count("absent")])
            again = consensus([m["answer"][p]["verdict"] if m["answer"] else None for m in second[pid]["members"]])
            same += again == label
            total += 1
        out_photos[pid] = entry

    # Kappa is undefined (null) when every member gave the same verdict on every photo.
    kappas = {p: (k if np.isfinite(k := fleiss_kappa(np.array(c, dtype=float))) else None) for p, c in kappa_counts.items()}
    pairs = [(1 if out_photos[pid]["groundFloor"]["consensus"] == "present" else 0, share)
             for pid in out_photos if out_photos[pid]["groundFloor"]["consensus"] != "ambiguous"
             and (share := ground_floor_open_share(pid)) is not None]
    rho = stats.spearmanr(*zip(*pairs)).statistic if len(pairs) >= 3 and len({v for v, _ in pairs}) > 1 else None
    seconds = float(np.mean([first[pid]["seconds"] for pid in first]))

    result = {
        "date": datetime.date.today().isoformat(),
        "model": f"{repo}@{rev}", "licence": "Apache-2.0", "quantisation": quant,
        "promptSha256": digest, "members": [f"{r} (seeds {', '.join(map(str, SEEDS['first']))})" for r in ROLES],
        "consensusRule": f"at least {CONSENSUS} of {len(ROLES) * len(SEEDS['first'])} members agree; otherwise ambiguous",
        "fleissKappa": kappas,
        "fleissKappaNote": "null: every member gave the same verdict on every photo, so agreement beyond chance is undefined",
        "stability": {"sameConsensus": same / total, "labels": total, "secondRunSeeds": SEEDS["second"]},
        "crossCheck": {"label": "exploratory: two automated methods, not a validation",
                       "spearmanGroundFloorVsOpenShare": None if rho is None or not np.isfinite(rho) else float(rho),
                       "photos": len(pairs)},
        "secondsPerPhoto": round(seconds, 1), "peakGpuGb": round(peak, 2),
        "photos": out_photos,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print(f"\nFleiss' kappa: " + ", ".join(f"{p} {'undefined' if k is None else f'{k:.2f}'}" for p, k in kappas.items()))
    print(f"Stability: {same}/{total} consensus labels unchanged in the second run ({same / total:.0%})")
    print(f"Cross-check (exploratory): ground-floor verdict vs entrance + shopfront share of the ground floor: "
          f"rho = {result['crossCheck']['spearmanGroundFloorVsOpenShare']}, n = {len(pairs)}")
    print(f"Time per photo (8 members): {seconds:.0f} s; peak GPU memory {peak:.2f} GB")
    print(f"Wrote {OUT.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
