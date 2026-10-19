"""Façade elements: compare text-prompted models on human-labelled façades and
add the best per element to the area files (prompt 023).

  uv run elements.py --compare   calibrate on CMP (even image numbers), test on
                                 CMP (odd) and eTRIMS; pick a winner per element
  uv run elements.py --apply     add the winners' masks to the 24 area files
  uv run elements.py --panoramas the 360° panoramas only, searched as a whole and in
                                 four cube faces (prompt 061, panorama.py)

Every model gets one phrase per call. A model returns a score map: per pixel,
the highest score of the masks covering it, so the union of masks above a
threshold t is simply score ≥ t. Pixels outside the façade category (dilated by
1% of the width) are dropped.
"""

import argparse
import gc
import json
import os
import sys
import time

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import numpy as np
import torch
from PIL import Image, ImageDraw
from scipy import ndimage

import validate
from common import CACHE, CATEGORY_IDS, EXAMPLES, OUT, OneFormer, area_entry, decode_rle, device, mask_size, photos, write_area_file

ELEMENTS = {  # id: (label, phrase, eTRIMS class, CMP class)
    "windows": ("Windows", "window", 8, 3),
    "entrances": ("Entrances", "door", 3, 4),
    "balconies": ("Balconies", "balcony", None, 7),
    "shopfronts": ("Shopfronts", "storefront", None, 12),
}
THRESHOLDS = np.round(np.arange(0.05, 0.701, 0.05), 2)
LOW_CONFIDENCE_IOU = 0.20
TIE = 0.01
MAX_BOXES = 100
SAM_CHUNK = 16  # boxes decoded at once against one image embedding (8 GB GPU)
COMPARISON = CACHE / "elements_comparison.json"

SAM2 = ("facebook/sam2.1-hiera-large", "665f8e2ad61cf5f53d65644ff27c8ee525124610")
CANDIDATES = {
    "A": {"name": "Grounding DINO base + SAM 2.1 large", "licence": "Apache-2.0",
          "repos": [("IDEA-Research/grounding-dino-base", "12bdfa3120f3e7ec7b434d90674b3396eccf88eb"), SAM2]},
    "B": {"name": "OWLv2 large + SAM 2.1 large", "licence": "Apache-2.0",
          "repos": [("google/owlv2-large-patch14-ensemble", "95e26936e865f87db1742128404b3c035d47d89d"), SAM2]},
    "C": {"name": "Florence-2 large + SAM 2.1 large", "licence": "MIT (Florence-2), Apache-2.0 (SAM 2.1)",
          # The built-in transformers class needs the converted weights; microsoft/Florence-2-large is remote code.
          "repos": [("florence-community/Florence-2-large", "4271c66b88cdbc05735372ec13b2360108de5317"), SAM2]},
    "D": {"name": "SAM 3", "licence": "SAM License (acknowledgement required)",
          "repos": [("facebook/sam3", "3c879f39826c281e95690f02c7821c4de09afae7")]},
}
OPEN_LICENCE = {"A", "B", "C"}


# --- candidates ------------------------------------------------------------------

class BoxesThenSam:
    """A box detector per phrase, then SAM 2.1 masks for the boxes."""

    def __init__(self, key: str, dev: torch.device):
        from transformers import Sam2Model, Sam2Processor

        self.key, self.dev = key, dev
        (repo, rev), (sam_repo, sam_rev) = CANDIDATES[key]["repos"]
        self.sam_processor = Sam2Processor.from_pretrained(sam_repo, revision=sam_rev)
        self.sam = Sam2Model.from_pretrained(sam_repo, revision=sam_rev).to(dev).eval()
        if key == "A":
            from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor
            self.processor = AutoProcessor.from_pretrained(repo, revision=rev)
            self.detector = AutoModelForZeroShotObjectDetection.from_pretrained(repo, revision=rev).to(dev).eval()
        elif key == "B":
            from transformers import Owlv2ForObjectDetection, Owlv2Processor
            self.processor = Owlv2Processor.from_pretrained(repo, revision=rev)
            self.detector = Owlv2ForObjectDetection.from_pretrained(repo, revision=rev).to(dev).eval()
        else:
            from transformers import AutoProcessor, Florence2ForConditionalGeneration
            self.processor = AutoProcessor.from_pretrained(repo, revision=rev)
            self.detector = Florence2ForConditionalGeneration.from_pretrained(repo, revision=rev, torch_dtype=torch.float16).to(dev).eval()

    @torch.no_grad()
    def boxes(self, image: Image.Image, phrase: str) -> tuple[np.ndarray, np.ndarray]:
        w, h = image.size
        if self.key == "A":
            inputs = self.processor(images=image, text=f"{phrase}.", return_tensors="pt").to(self.dev)
            out = self.detector(**inputs)
            res = self.processor.post_process_grounded_object_detection(
                out, inputs.input_ids, threshold=THRESHOLDS[0], text_threshold=THRESHOLDS[0], target_sizes=[(h, w)])[0]
        elif self.key == "B":
            inputs = self.processor(text=[[phrase]], images=image, return_tensors="pt").to(self.dev)
            out = self.detector(**inputs)
            side = max(w, h)  # OWLv2 pads to a square at the bottom and right
            res = self.processor.post_process_grounded_object_detection(out, threshold=THRESHOLDS[0], target_sizes=[(side, side)])[0]
        else:
            task = "<OPEN_VOCABULARY_DETECTION>"
            inputs = self.processor(text=task + phrase, images=image, return_tensors="pt").to(self.dev, torch.float16)
            ids = self.detector.generate(**inputs, max_new_tokens=1024, num_beams=3, do_sample=False)
            text = self.processor.batch_decode(ids, skip_special_tokens=False)[0]
            parsed = self.processor.post_process_generation(text, task=task, image_size=(w, h))[task]
            boxes = np.array(parsed.get("bboxes", []), dtype=np.float32).reshape(-1, 4)
            return boxes, np.ones(len(boxes), np.float32)  # Florence-2 gives no scores
        boxes = res["boxes"].float().cpu().numpy()
        scores = res["scores"].float().cpu().numpy()
        boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, w)
        boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, h)
        order = np.argsort(-scores)[:MAX_BOXES]
        return boxes[order], scores[order]

    @torch.no_grad()
    def score_map(self, image: Image.Image, phrase: str, size: tuple[int, int]) -> np.ndarray:
        boxes, scores = self.boxes(image, phrase)
        out = np.zeros(size[::-1], np.uint8)
        keep = (boxes[:, 2] - boxes[:, 0] >= 2) & (boxes[:, 3] - boxes[:, 1] >= 2) if len(boxes) else []
        boxes, scores = boxes[keep], scores[keep]
        if not len(boxes):
            return out
        pixels = self.sam_processor(images=image, return_tensors="pt")["pixel_values"].to(self.dev)
        embeddings = self.sam.get_image_embeddings(pixels)
        for start in range(0, len(boxes), SAM_CHUNK):
            chunk = boxes[start:start + SAM_CHUNK]
            inputs = self.sam_processor(images=image, input_boxes=[chunk.tolist()], return_tensors="pt")
            result = self.sam(input_boxes=inputs["input_boxes"].to(self.dev), image_embeddings=embeddings, multimask_output=False)
            masks = self.sam_processor.post_process_masks(result.pred_masks.cpu(), [size[::-1]])[0][:, 0].numpy()
            for mask, score in zip(masks, scores[start:start + SAM_CHUNK]):
                np.maximum(out, np.where(mask > 0, np.uint8(round(score * 100)), 0).astype(np.uint8), out=out)
        return out


class Sam3:
    def __init__(self, dev: torch.device):
        from transformers import Sam3Model, Sam3Processor

        repo, rev = CANDIDATES["D"]["repos"][0]
        self.dev = dev
        self.processor = Sam3Processor.from_pretrained(repo, revision=rev)
        self.model = Sam3Model.from_pretrained(repo, revision=rev).to(dev).eval()

    @torch.no_grad()
    def score_map(self, image: Image.Image, phrase: str, size: tuple[int, int]) -> np.ndarray:
        inputs = self.processor(images=image, text=phrase, return_tensors="pt").to(self.dev)
        out = self.model(**inputs)
        res = self.processor.post_process_instance_segmentation(
            out, threshold=THRESHOLDS[0], mask_threshold=0.5, target_sizes=[size[::-1]])[0]
        result = np.zeros(size[::-1], np.uint8)
        for mask, score in zip(res["masks"].cpu().numpy(), res["scores"].float().cpu().numpy()):
            np.maximum(result, np.where(mask > 0, np.uint8(round(float(score) * 100)), 0).astype(np.uint8), out=result)
        return result


def load_candidate(key: str, dev: torch.device):
    return Sam3(dev) if key == "D" else BoxesThenSam(key, dev)


def candidate_available(key: str) -> str | None:
    """None when the weights can be downloaded, otherwise the reason."""
    from huggingface_hub import hf_hub_download
    for repo, rev in CANDIDATES[key]["repos"]:
        try:
            hf_hub_download(repo, "config.json", revision=rev)
        except Exception as e:  # gated or missing
            return "access pending" if "403" in str(e) or "Gated" in type(e).__name__ else f"{type(e).__name__}"
    return None


# --- data ------------------------------------------------------------------------

def facade_zone(cats: np.ndarray) -> np.ndarray:
    radius = max(1, round(cats.shape[1] * 0.01))
    disk = np.hypot(*np.mgrid[-radius:radius + 1, -radius:radius + 1]) <= radius
    return ndimage.binary_dilation(cats == CATEGORY_IDS.index("facade"), disk)


def instances_from_objects(objects: np.ndarray, gt: np.ndarray) -> np.ndarray:
    """eTRIMS: object ids restricted to one class, renumbered 1..n."""
    ids = np.where(gt, objects, 0)
    _, inverse = np.unique(ids, return_inverse=True)
    return inverse.reshape(ids.shape)


def load_dataset(name: str, model: OneFormer) -> list[dict]:
    mapping = validate.load_mapping(validate.MAPPINGS / f"{name}.json")
    records = []
    for label_path in sorted(mapping["labels"].glob("*.png")):
        image_path = mapping["images"] / (label_path.stem + mapping["imageSuffix"])
        if not image_path.exists():
            continue
        image = Image.open(image_path).convert("RGB")
        size = mask_size(image.width, image.height)
        cats = model.categories(image, size)
        label = np.asarray(Image.open(label_path).resize(size, Image.NEAREST))
        objects = (np.asarray(Image.open(mapping["objects"] / label_path.name).resize(size, Image.NEAREST))
                   if mapping.get("objects") else None)
        number = int("".join(ch for ch in label_path.stem if ch.isdigit()) or 0)
        split = "test" if name == "etrims" or number % 2 else "calibration"
        records.append({"dataset": name, "name": label_path.stem, "image": image_path, "size": size,
                        "zone": facade_zone(cats), "label": label, "objects": objects, "split": split})
    return records


def gt_masks(record: dict) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """Element id → (mask, instance labels) for the elements this dataset labels."""
    out = {}
    column = 2 if record["dataset"] == "etrims" else 3
    for eid, spec in ELEMENTS.items():
        cls = spec[column]
        if cls is None:
            continue
        gt = record["label"] == cls
        inst = instances_from_objects(record["objects"], gt) if record["objects"] is not None else ndimage.label(gt)[0]
        out[eid] = (gt, inst)
    return out


def match(gt_inst: np.ndarray, pred: np.ndarray) -> tuple[int, int, int]:
    """(matched, ground-truth instances, predicted instances) at IoU ≥ 0.5, one-to-one, greedy."""
    pred_inst, n_pred = ndimage.label(pred)
    n_gt = int(gt_inst.max())
    if n_gt == 0 or n_pred == 0:
        return 0, n_gt, n_pred
    joint = np.bincount(gt_inst.ravel() * (n_pred + 1) + pred_inst.ravel(), minlength=(n_gt + 1) * (n_pred + 1))
    joint = joint.reshape(n_gt + 1, n_pred + 1)[1:, 1:].astype(float)
    area_gt = np.bincount(gt_inst.ravel(), minlength=n_gt + 1)[1:][:, None]
    area_pred = np.bincount(pred_inst.ravel(), minlength=n_pred + 1)[1:][None, :]
    iou = joint / (area_gt + area_pred - joint)
    matched, used_gt, used_pred = 0, set(), set()
    for g, p in zip(*np.unravel_index(np.argsort(-iou, axis=None), iou.shape)):
        if iou[g, p] < 0.5:
            break
        if g in used_gt or p in used_pred:
            continue
        used_gt.add(g); used_pred.add(p); matched += 1
    return matched, n_gt, n_pred


# --- compare ---------------------------------------------------------------------

def compare(dev: torch.device) -> dict:
    model = OneFormer(dev)
    records = load_dataset("cmp", model) + load_dataset("etrims", model)
    del model; gc.collect(); torch.cuda.empty_cache()
    print(f"{sum(r['split'] == 'calibration' for r in records)} calibration and {sum(r['split'] == 'test' for r in records)} test images")

    results = {}
    for key, spec in CANDIDATES.items():
        reason = candidate_available(key)
        if reason:
            print(f"{key} {spec['name']}: skipped ({reason})")
            results[key] = {"name": spec["name"], "status": reason}
            continue
        try:
            candidate = load_candidate(key, dev)
        except Exception as e:  # e.g. a missing built-in class
            print(f"{key} {spec['name']}: skipped ({type(e).__name__}: {e})")
            results[key] = {"name": spec["name"], "status": f"could not load: {type(e).__name__}"}
            continue
        torch.cuda.reset_peak_memory_stats()
        t0 = time.perf_counter()
        calib = {eid: np.zeros((len(THRESHOLDS), 2)) for eid in ELEMENTS}  # [threshold, (intersection, union)]
        test_maps = []
        for r in records:
            image = Image.open(r["image"]).convert("RGB")
            gts = gt_masks(r)
            maps = {}
            for eid in gts:
                maps[eid] = np.where(r["zone"], candidate.score_map(image, ELEMENTS[eid][1], r["size"]), 0).astype(np.uint8)
            if r["split"] == "calibration":
                for eid, (gt, _) in gts.items():
                    for k, t in enumerate(THRESHOLDS):
                        pred = maps[eid] >= round(t * 100)
                        calib[eid][k] += ((gt & pred).sum(), (gt | pred).sum())
            else:
                test_maps.append((r, maps))
        seconds = (time.perf_counter() - t0) / len(records)
        peak = torch.cuda.max_memory_allocated() / 1e9 if dev.type == "cuda" else None
        chosen = {}
        for eid, acc in calib.items():
            iou = acc[:, 0] / np.maximum(acc[:, 1], 1)
            chosen[eid] = float(THRESHOLDS[int(np.argmax(iou))]) if key != "C" else None  # Florence-2 has no scores
        tests = {}
        for eid in ELEMENTS:
            for dataset in ("etrims", "cmp"):
                inter = union = matched = n_gt = n_pred = 0
                seen = False
                for r, maps in test_maps:
                    if r["dataset"] != dataset or eid not in maps:
                        continue
                    seen = True
                    gt, inst = gt_masks(r)[eid]
                    pred = maps[eid] >= (round(chosen[eid] * 100) if chosen[eid] is not None else 1)
                    inter += int((gt & pred).sum()); union += int((gt | pred).sum())
                    m, g, p = match(inst, pred)
                    matched += m; n_gt += g; n_pred += p
                if seen:
                    tests.setdefault(eid, {})[dataset] = {
                        "iou": inter / union if union else None,
                        "recall": matched / n_gt if n_gt else None,
                        "precision": matched / n_pred if n_pred else None,
                        "instances": n_gt}
        results[key] = {"name": spec["name"], "status": "ok", "licence": spec["licence"],
                        "repos": [f"{repo}@{rev}" for repo, rev in spec["repos"]],
                        "thresholds": chosen, "test": tests,
                        "secondsPerImage": round(seconds, 2), "peakGpuGb": None if peak is None else round(peak, 2)}
        print(f"{key} {spec['name']}: {seconds:.2f} s per image, peak {peak:.2f} GB" if peak else f"{key}: {seconds:.2f} s")
        del candidate; gc.collect(); torch.cuda.empty_cache()

    # Winner per element: highest mean test IoU over the datasets that label it; within TIE prefer an open licence.
    winners = {}
    for eid in ELEMENTS:
        scored = []
        for key, res in results.items():
            if res["status"] != "ok":
                continue
            ious = [v["iou"] for v in res["test"].get(eid, {}).values() if v["iou"] is not None]
            if ious:
                scored.append((float(np.mean(ious)), key))
        scored.sort(reverse=True)
        best_iou, best = scored[0]
        for iou, key in scored:
            if best_iou - iou <= TIE and key in OPEN_LICENCE and best not in OPEN_LICENCE:
                best = key
                best_iou = iou
                break
        winners[eid] = {"candidate": best, "meanTestIou": best_iou,
                        "threshold": results[best]["thresholds"][eid],
                        "lowConfidence": best_iou < LOW_CONFIDENCE_IOU}
    comparison = {"date": time.strftime("%Y-%m-%d"), "phrases": {e: s[1] for e, s in ELEMENTS.items()},
                  "thresholdGrid": THRESHOLDS.tolist(), "calibration": "CMP Facade base, even image numbers",
                  "test": "CMP Facade base, odd image numbers; eTRIMS 8-class (windows, doors)",
                  "candidates": results, "winners": winners}
    COMPARISON.write_text(json.dumps(comparison, indent=1))
    return comparison


def print_table(comparison: dict) -> None:
    print(f"\n{'element':11} {'cand':5} {'thr':>5} {'eTRIMS IoU':>11} {'P':>5} {'R':>5} {'CMP IoU':>8} {'P':>5} {'R':>5}")
    for eid in ELEMENTS:
        for key, res in comparison["candidates"].items():
            if res["status"] != "ok":
                continue
            t = res["test"].get(eid, {})
            e, c = t.get("etrims", {}), t.get("cmp", {})
            f = lambda v: "–" if v is None else f"{v:.2f}"
            thr = res["thresholds"].get(eid)
            print(f"{eid:11} {key:5} {f(thr):>5} {f(e.get('iou')):>11} {f(e.get('precision')):>5} {f(e.get('recall')):>5} "
                  f"{f(c.get('iou')):>8} {f(c.get('precision')):>5} {f(c.get('recall')):>5}")
    for key, res in comparison["candidates"].items():
        if res["status"] != "ok":
            print(f"{key} {res['name']}: {res['status']}")
    print("\nWinners:", {e: (w["candidate"], round(w["meanTestIou"], 3), w["threshold"], "low-confidence" if w["lowConfidence"] else "")
                         for e, w in comparison["winners"].items()})


# --- apply -----------------------------------------------------------------------

def apply(dev: torch.device, only_missing: bool = False) -> None:
    comparison = json.loads(COMPARISON.read_text())
    winners = comparison["winners"]
    by_candidate: dict[str, list[str]] = {}
    for eid, w in winners.items():
        by_candidate.setdefault(w["candidate"], []).append(eid)
    files = {p["id"]: json.loads((OUT / f"{p['id']}.json").read_text()) for p in photos(include_edited=True)}
    if only_missing:  # prompt 051: leave photos that already have their element masks untouched
        files = {pid: data for pid, data in files.items() if not any(a["id"] in ELEMENTS for a in data["areas"])}
    found: dict[str, dict[str, np.ndarray]] = {pid: {} for pid in files}
    for key, eids in by_candidate.items():
        candidate = load_candidate(key, dev)
        for photo in photos(include_edited=True):
            if photo["id"] not in files:
                continue
            data = files[photo["id"]]
            w, h = data["width"], data["height"]
            cats = np.zeros((h, w), np.uint8)
            for k, c in enumerate(CATEGORY_IDS):
                area = next(a for a in data["areas"] if a["id"] == c)
                cats[decode_rle(area["rle"], w, h)] = k
            zone = facade_zone(cats)
            image = Image.open(EXAMPLES / photo["file"]).convert("RGB")
            for eid in eids:
                scores = np.where(zone, candidate.score_map(image, ELEMENTS[eid][1], (w, h)), 0)
                threshold = winners[eid]["threshold"]
                found[photo["id"]][eid] = (scores >= (round(threshold * 100) if threshold is not None else 1), scores)
        del candidate; gc.collect(); torch.cuda.empty_cache()

    for pid, data in files.items():
        data["areas"] = [a for a in data["areas"] if a["id"] not in ELEMENTS]
        for eid, (label, *_rest) in ELEMENTS.items():
            mask, scores = found[pid][eid]
            win = winners[eid]
            spec = CANDIDATES[win["candidate"]]
            data["models"][eid] = f"{spec['name']}: " + ", ".join(spec["repos"][i][0] + "@" + spec["repos"][i][1] for i in range(len(spec["repos"]))) \
                + (f"; threshold {win['threshold']}" if win["threshold"] is not None else "")
            extra = {"model": eid, "instances": int(ndimage.label(mask)[1]),
                     "meanScore": round(float(scores[mask].mean()) / 100, 3) if mask.any() else None}
            if win["lowConfidence"]:
                extra["lowConfidence"] = True
            data["areas"].append(area_entry(eid, label, "element", mask, **extra))
        write_area_file(OUT / f"{pid}.json", data)
        overlay(pid, data)


def apply_panoramas(dev: torch.device) -> None:
    """Prompt 061: for the 360° panoramas, the winners' search also runs on the four cube faces (panorama.py); each
    face's score map is mapped back and the highest score per pixel counts, before the façade zone and threshold."""
    import panorama

    comparison = json.loads(COMPARISON.read_text())
    winners = comparison["winners"]
    targets = [p for p in photos() if p.get("imageKind") == "panorama"]
    files = {p["id"]: json.loads((OUT / f"{p['id']}.json").read_text()) for p in targets}
    by_candidate: dict[str, list[str]] = {}
    for eid, w in winners.items():
        by_candidate.setdefault(w["candidate"], []).append(eid)
    found: dict[str, dict[str, tuple]] = {pid: {} for pid in files}
    for key, eids in by_candidate.items():
        candidate = load_candidate(key, dev)
        for photo in targets:
            data = files[photo["id"]]
            w, h = data["width"], data["height"]
            cats = np.zeros((h, w), np.uint8)
            for k, c in enumerate(CATEGORY_IDS):
                area = next(a for a in data["areas"] if a["id"] == c)
                cats[decode_rle(area["rle"], w, h)] = k
            zone = facade_zone(cats)
            image = Image.open(EXAMPLES / photo["file"]).convert("RGB")
            pixels = np.asarray(image.resize((w, h), Image.LANCZOS))
            faces = [(yaw, Image.fromarray(panorama.to_face(pixels, yaw))) for yaw in panorama.YAWS]
            for eid in eids:
                scores = candidate.score_map(image, ELEMENTS[eid][1], (w, h))
                for yaw, face in faces:
                    back, _ = panorama.from_face(candidate.score_map(face, ELEMENTS[eid][1], (panorama.FACE, panorama.FACE)), yaw, w, h)
                    np.maximum(scores, back, out=scores)
                scores = np.where(zone, scores, 0)
                threshold = winners[eid]["threshold"]
                found[photo["id"]][eid] = (scores >= (round(threshold * 100) if threshold is not None else 1), scores)
            print(f"{photo['id']}: " + ", ".join(f"{eid} {int(ndimage.label(found[photo['id']][eid][0])[1])}" for eid in eids), flush=True)
        del candidate; gc.collect(); torch.cuda.empty_cache()

    for pid, data in files.items():
        data["areas"] = [a for a in data["areas"] if a["id"] not in ELEMENTS]
        for eid, (label, *_rest) in ELEMENTS.items():
            mask, scores = found[pid][eid]
            win = winners[eid]
            spec = CANDIDATES[win["candidate"]]
            data["models"][eid] = f"{spec['name']}: " + ", ".join(spec["repos"][i][0] + "@" + spec["repos"][i][1] for i in range(len(spec["repos"]))) \
                + (f"; threshold {win['threshold']}" if win["threshold"] is not None else "") \
                + "; whole panorama and four cube faces (prompt 061)"
            extra = {"model": eid, "instances": int(ndimage.label(mask)[1]),
                     "meanScore": round(float(scores[mask].mean()) / 100, 3) if mask.any() else None}
            if win["lowConfidence"]:
                extra["lowConfidence"] = True
            data["areas"].append(area_entry(eid, label, "element", mask, **extra))
        write_area_file(OUT / f"{pid}.json", data)
        overlay(pid, data)


COLOURS = {"ground-floor": (255, 0, 255), "windows": (86, 180, 233), "entrances": (230, 159, 0),
           "balconies": (0, 158, 115), "shopfronts": (240, 228, 66)}


def overlay(pid: str, data: dict) -> None:
    photo = next(p for p in photos(include_edited=True) if p["id"] == pid)
    w, h = data["width"], data["height"]
    base = np.asarray(Image.open(EXAMPLES / photo["file"]).convert("L").resize((w * 2, h * 2)).convert("RGB"), dtype=np.float32) * 0.6
    for area in data["areas"]:
        if area["id"] in COLOURS:
            mask = np.kron(decode_rle(area["rle"], w, h), np.ones((2, 2), bool))
            edge = mask & ~ndimage.binary_erosion(mask, iterations=2)
            base[mask] = base[mask] * 0.6 + np.array(COLOURS[area["id"]]) * 0.4
            base[edge] = COLOURS[area["id"]]
    out = Image.fromarray(base.astype(np.uint8))
    draw = ImageDraw.Draw(out)
    for k, (aid, colour) in enumerate(COLOURS.items()):
        draw.rectangle((8, 8 + 18 * k, 22, 22 + 18 * k), fill=colour)
        draw.text((28, 9 + 18 * k), aid, fill=(255, 255, 255))
    (CACHE / "check").mkdir(parents=True, exist_ok=True)
    out.save(CACHE / "check" / f"{pid}-elements.png")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--compare", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--only-missing", action="store_true", help="with --apply: only photos without element masks (prompt 051)")
    parser.add_argument("--panoramas", action="store_true", help="the 360° panoramas only, also searched in cube faces (prompt 061)")
    args = parser.parse_args()
    dev = device()
    if args.compare:
        comparison = compare(dev)
        print_table(comparison)
        validate.save_elements(comparison)
    if args.panoramas:
        apply_panoramas(dev)
        print(f"Added {', '.join(ELEMENTS)} to the panoramas' area files; overlays in .cache/check/")
    elif args.apply:
        apply(dev, args.only_missing)
        print(f"Added {', '.join(ELEMENTS)} to the area files; overlays in .cache/check/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
