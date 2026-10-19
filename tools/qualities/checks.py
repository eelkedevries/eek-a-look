"""Check the image measures (prompt 043).

  uv run checks.py
  uv run checks.py --surface   only the surface-detail check (prompt 063); writes surface_calibration.json

Writes public/precomputed/qualities/checks.json and the report
docs-dev/reference/secondary_background/qualities_validation.md.

What can be checked is whether each measure reads its *components* as people
labelled them (CMP Facade), how much the outcomes depend on the thresholds,
and whether the measures tell the 24 photos apart. The principles themselves
cannot be validated: no experts have labelled these photos.
"""

import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from scipy import ndimage, stats

import frontage
import rhythm
from shared import OUT, PRINCIPLES, REPO, photos

CHECKS = OUT / "checks.json"
REPORT = REPO / "docs-dev" / "reference" / "secondary_background" / "qualities_validation.md"
PANEL = REPO / "public" / "precomputed" / "vlm-panel" / "panel.json"
CMP_FACADE_CLASSES = (2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)  # every CMP class but background
CMP_OPENINGS, CMP_WINDOW = (4, 12), 3                     # door, shop; window
BAND = 0.25                                                # bottom quarter of the labelled façade

# Upchurch & Niu (2022), Table 8: DMS46 test-set per-class accuracy and IoU, for the classes in the groups.
DMS46_TABLE8 = {
    "Brickwork": (0.746, 0.491), "Stone, natural": (0.665, 0.436), "Wood": (0.797, 0.635), "Wood, tree": (0.428, 0.261),
    "Tile": (0.722, 0.550), "Wicker": (0.674, 0.460), "Foliage": (0.902, 0.761),
    "Glass": (0.653, 0.483), "Mirror": (0.452, 0.278), "Metal": (0.575, 0.303), "Stone, polished": (0.379, 0.236),
    "Paint/plaster/enamel": (0.694, 0.632), "Plastic, clear": (0.360, 0.222), "Plastic, non-clear": (0.519, 0.321),
    "Ceramic": (0.757, 0.427), "Concrete": (0.603, 0.304), "Asphalt": (0.628, 0.442),
}

# The rule thresholds of the specification, for the sensitivity test.
THRESHOLDS = {
    "groundFloor": {"frontageMin": 0.05, "openPresent": 0.30, "openAbsent": 0.10, "closedAbsent": 0.60},
    "rhythm": {"facadeCellsMin": 8, "rhythmicPresent": 0.25, "zonesPresent": 2, "rhythmicAbsent": 0.10},
    "materials": {"zoneMin": 0.10, "texturedPresent": 0.25, "texturedAbsent": 0.10, "smoothRatio": 2.0},
}
MAIN = {"groundFloor": "openShare", "rhythm": "rhythmicShare", "materials": "texturedShare"}


def outcome(principle: str, ind: dict, horizon: str, t: dict) -> str:
    """The specification's rules with adjustable thresholds (the reasons are left out)."""
    if principle == "groundFloor":
        if horizon == "assumed-level" or ind["frontageShare"] < t["frontageMin"]:
            return "unclear"
        if ind["openShare"] >= t["openPresent"]:
            return "likely-present"
        if ind["openShare"] < t["openAbsent"] and ind["closedShare"] >= t["closedAbsent"]:
            return "likely-absent"
        return "unclear"
    if principle == "rhythm":
        if ind["facadeCells"] < t["facadeCellsMin"]:
            return "unclear"
        if ind["rhythmicShare"] >= t["rhythmicPresent"]:
            return "likely-present" if ind["distinctZones"] >= t["zonesPresent"] else "unclear"
        return "likely-absent" if ind["rhythmicShare"] < t["rhythmicAbsent"] else "unclear"
    if horizon == "assumed-level" or ind["zoneShare"] < t["zoneMin"]:
        return "unclear"
    if ind["texturedShare"] >= t["texturedPresent"]:
        return "likely-present"
    if ind["texturedShare"] < t["texturedAbsent"] and ind["smoothShare"] >= t["smoothRatio"] * ind["texturedShare"]:
        return "likely-absent"
    return "unclear"


def load_qualities() -> dict:
    out = {}
    for photo in photos():
        q = json.loads((OUT / f"{photo['id']}.json").read_text())
        area = json.loads((REPO / "public" / "precomputed" / "areas" / f"{photo['id']}.json").read_text())
        out[photo["id"]] = {"quality": q, "horizon": area["horizon"]["method"],
                            "group": "study" if photo.get("imageKind") else "earlier"}
    return out


# --- rhythm on CMP (odd images) -------------------------------------------------------

def rhythm_check(dev: torch.device, tau: dict, s: float) -> dict:
    records = [r for r in rhythm.cmp_records(dev) if r["split"] == "test"]
    cells_all, per_image = [], []
    for r in records:
        cells = rhythm.cmp_windows(r, s)
        if not cells:
            continue
        cells_all += cells
        image_rhythmic = np.mean([c["vertical"] >= tau["vertical"] and c["layer"] >= tau["layer"] for c in cells])
        label_rhythmic = np.mean([c["reference"]["vertical"] and c["reference"]["layer"] for c in cells])
        per_image.append((image_rhythmic, label_rhythmic))
    result = {"dataset": "CMP Facade base, odd image numbers", "images": len(per_image), "windows": len(cells_all),
              "instanceThreshold": s, "families": {}}
    for family in ("vertical", "layer"):
        pred = np.array([c[family] >= tau[family] for c in cells_all])
        truth = np.array([c["reference"][family] for c in cells_all])
        result["families"][family] = {
            "tau": tau[family], "balancedAccuracy": rhythm.balanced_accuracy(pred, truth),
            "precision": float((pred & truth).sum() / max(pred.sum(), 1)), "recall": float((pred & truth).sum() / max(truth.sum(), 1)),
            "referenceRepeats": float(truth.mean()), "measureRepeats": float(pred.mean())}
    a, b = zip(*per_image)
    result["rhythmicShareSpearman"] = float(stats.spearmanr(a, b).statistic)
    result["rhythmicShareMeanAbsDiff"] = float(np.mean(np.abs(np.array(a) - np.array(b))))
    return result


# --- frontage on CMP (odd images with doors or shops) ---------------------------------------

def frontage_check(dev: torch.device) -> dict:
    import elements

    # The thresholds behind the area files' masks (prompt 023), which the frontage measure uses on the photos.
    winners = json.loads((REPO / "public/precomputed/areas/validation.json").read_text())["elements"]["winners"]
    tau = {"door": winners["entrances"]["threshold"], "storefront": winners["shopfronts"]["threshold"], "window": winners["windows"]["threshold"]}
    cache = rhythm.CACHE / "cmp-elements"
    cache.mkdir(parents=True, exist_ok=True)
    sam = None
    rows = []
    for r in rhythm.cmp_records(dev):
        label = r["label"]
        if r["split"] != "test" or not np.isin(label, CMP_OPENINGS).any():
            continue
        path = cache / f"{r['name']}.npz"
        if not path.exists():
            sam = sam or Sam3Masks(dev)
            zone = elements.facade_zone(r["cats"])
            image = Image.open(r["image"]).convert("RGB")
            size = (label.shape[1], label.shape[0])
            masks = {p: sam(image, p, size, tau[p]) & zone for p in ("door", "storefront", "window")}
            np.savez_compressed(path, **masks)
        masks = np.load(path)
        facade = np.isin(label, CMP_FACADE_CLASSES)
        ys = np.flatnonzero(facade.any(1))
        top, bottom = ys.min(), ys.max()
        floor = facade & (np.arange(label.shape[0])[:, None] >= bottom - BAND * (bottom - top))
        width = label.shape[1]
        values = {}
        for source, openings, windows in (("labels", np.isin(label, CMP_OPENINGS), label == CMP_WINDOW),
                                          ("sam3", masks["door"] | masks["storefront"], masks["window"])):
            classes = frontage.column_classes(floor, openings, windows)
            n = (classes != frontage.NONE).sum()
            ind = {"frontageShare": n / width,
                   "openShare": float((classes == frontage.OPEN).sum() / n) if n else 0.0,
                   "closedShare": float((classes == frontage.CLOSED).sum() / n) if n else 0.0}
            values[source] = {**ind, "outcome": outcome("groundFloor", ind, "found", THRESHOLDS["groundFloor"])}
        rows.append(values)
    del sam
    torch.cuda.empty_cache()
    gt = np.array([r["labels"]["openShare"] for r in rows])
    pr = np.array([r["sam3"]["openShare"] for r in rows])
    kinds = ["likely-present", "unclear", "likely-absent"]
    table = {a: {b: sum(1 for r in rows if r["labels"]["outcome"] == a and r["sam3"]["outcome"] == b) for b in kinds} for a in kinds}
    return {"dataset": "CMP Facade base, odd image numbers with door or shop labels", "images": len(rows),
            "groundFloorProxy": "the bottom quarter of the labelled façade (CMP has no horizon)",
            "openShareSpearman": float(stats.spearmanr(gt, pr).statistic), "openShareMeanAbsDiff": float(np.mean(np.abs(gt - pr))),
            "outcomeAgreement": float(np.mean([r["labels"]["outcome"] == r["sam3"]["outcome"] for r in rows])),
            "outcomes": {"rows": "from the human labels", "columns": "from the SAM 3 masks", "table": table}}


class Sam3Masks(rhythm.Sam3Instances):
    """The union of SAM 3 masks for one phrase above a threshold, on the mask grid."""

    @torch.no_grad()
    def __call__(self, image, phrase, size, threshold):
        inputs = self.processor(images=image, text=phrase, return_tensors="pt").to(self.dev)
        out = self.model(**inputs)
        res = self.processor.post_process_instance_segmentation(out, threshold=threshold, mask_threshold=0.5, target_sizes=[size[::-1]])[0]
        union = np.zeros(size[::-1], bool)
        for mask in res["masks"].cpu().numpy():
            union |= mask > 0
        return union


# --- sensitivity, discrimination, panel cross-table ----------------------------------------

def having(data: dict, principle: str) -> dict:
    """The photos with a result for this principle (all of them since prompt 072)."""
    return {pid: d for pid, d in data.items() if principle in d["quality"]["principles"]}


def sensitivity(data: dict) -> dict:
    out = {}
    all_data = data
    for principle, defaults in THRESHOLDS.items():
        data = having(all_data, principle)
        base = {pid: outcome(principle, d["quality"]["principles"][principle]["indicators"], d["horizon"], defaults) for pid, d in data.items()}
        stored = {pid: d["quality"]["principles"][principle]["outcome"] for pid, d in data.items()}
        assert base == stored, f"{principle}: the re-implemented rule does not reproduce the stored outcomes"
        out[principle] = {}
        for name, value in defaults.items():
            changes = {}
            for factor in (0.5, 1.5):
                t = dict(defaults)
                t[name] = round(value * factor) if isinstance(value, int) else value * factor
                changes[f"x{factor}"] = sum(outcome(principle, d["quality"]["principles"][principle]["indicators"], d["horizon"], t) != base[pid]
                                            for pid, d in data.items())
            out[principle][name] = {"value": value, **changes}
    return out


def discrimination(data: dict) -> dict:
    out = {}
    all_data = data
    for principle in PRINCIPLES:
        data = having(all_data, principle)
        outcomes = [d["quality"]["principles"][principle]["outcome"] for d in data.values()]
        values = [d["quality"]["principles"][principle]["indicators"].get(MAIN[principle]) for d in data.values()]
        values = [v for v in values if v is not None]
        counts = {k: outcomes.count(k) for k in ("likely-present", "unclear", "likely-absent")}
        groups = {}
        for group in ("earlier", "study"):  # prompt 052: the 28 photos (24 earlier, 4 Andersson) and the 10 study images
            g = [d["quality"]["principles"][principle]["outcome"] for d in data.values() if d["group"] == group]
            if g:
                c = {k: g.count(k) for k in ("likely-present", "unclear", "likely-absent")}
                groups[group] = {"photos": len(g), "outcomes": c, "sameOnAllPhotos": max(c.values()) == len(g)}
        out[principle] = {"outcomes": counts, "indicator": MAIN[principle], "byGroup": groups,
                          "min": min(values) if values else None, "max": max(values) if values else None,
                          "sameOnAllPhotos": max(counts.values()) == len(outcomes),
                          # Per photo, for the page's table of all photos (so it need not load 24 quality files).
                          "perPhoto": {pid: {"outcome": d["quality"]["principles"][principle]["outcome"],
                                             "value": d["quality"]["principles"][principle]["indicators"].get(MAIN[principle])}
                                       for pid, d in data.items()}}
    return out


def panel_cross_table(data: dict) -> dict:
    panel = json.loads(PANEL.read_text())["photos"]
    to_panel = {"likely-present": "present", "likely-absent": "absent", "unclear": "ambiguous"}
    out = {}
    for principle in PRINCIPLES:
        kinds = ["present", "ambiguous", "absent"]
        table = {a: {b: 0 for b in kinds} for a in kinds}
        judged = {pid: d for pid, d in having(data, principle).items() if pid in panel}  # the panel judged the 24 earlier photos
        for pid, d in judged.items():
            table[to_panel[d["quality"]["principles"][principle]["outcome"]]][panel[pid][principle]["consensus"]] += 1
        out[principle] = {"rows": "image measure", "columns": "simulated panel v1", "table": table, "photos": len(judged),
                          "agreement": sum(table[k][k] for k in kinds) / len(judged)}
    return out


FRONTAGE_HAND_CHECK = [
    "", "### Frontage grade: a check by eye (prompt 062)", "",
    "Three photos, openings on the ground floor counted by eye, against the automatic counts within 60 m of the camera.", "",
    "| Photo | Entrances (eye / automatic) | Shopfronts | Ground-floor windows | Grade |",
    "|---|---|---|---|---|",
    "| zurich-24 | about 4 / 2 | about 3 / 3 | about 8 / 15 | D |",
    "| zurich-42 | 2–3 / 2 (one is a first-floor balcony door) | 3–4 / 0 | 3–4 / 12 | D |",
    "| zuidas-gershwinplein | 2–3 / 1 | 0 / 1 (a glazed lobby) | 0 / 0 | E |",
    "",
    "Doors are missed, so entrances per 100 m, the grade's main criterion, come out low and the grade tends to be too low. "
    "In the Zürich photos the estimated ground floor reaches the first-floor windows, so ground-floor windows are over-counted. "
    "Over the 38 photos: E 16, D 3, D–E 2, no grade 17 (no horizon found, or under 20 m of frontage within 60 m). "
    "The grade is shown as an estimate and changes no outcome.",
]


def glass_section() -> list[str]:
    """The comparison of prompt 053 (glass and ribbon-window façades), from rhythm_calibration.json, if it ran."""
    comparison = json.loads(rhythm.CALIBRATION.read_text()).get("glassComparison")
    if not comparison:
        return []
    names = {"cmpTest": "CMP odd", "lmfTest": "LabelMeFacade test", "lmfGlazedOrBanded": "LabelMeFacade glazed or banded"}
    lines = ["", "### Glass and ribbon-window façades (prompt 053)", "",
             "Four ways of finding repeating elements, calibrated on the even CMP images and the LabelMeFacade "
             "train split, tested on held-out labels (mean balanced accuracy over bays and floors).", "",
             "| Candidate | " + " | ".join(names.values()) + " | Mean of the two test sets |", "|---|---|---|---|---|"]
    for key, row in comparison["meanBalancedAccuracy"].items():
        lines.append(f"| {key}: {comparison['candidates'][key]} | " + " | ".join(f"{row[k]:.3f}" for k in names)
                     + f" | {row['meanOfTestSets']:.3f} |")
    params, windows = comparison["params"], comparison["windows"]
    lines += ["", f"D's joint calibration chose s = {params['D']['s']}, A's own threshold, so D is A. C's line threshold "
              f"(bays {params['C']['tauLine']['vertical']}, floors {params['C']['tauLine']['layer']}) is so strict that the line "
              "fallback hardly ever counts, so C differs from A only in the fourth decimal. B's extra phrases at "
              f"s_B = {params['B']['sB']} lower the glazed or banded subset. That subset is 4 images with "
              f"{windows['lmfGlazedOrBanded']} windows, too few to show a gain on glass façades either way."]
    lines += ["", f"Rule: {comparison['rule']}. Choice: **{comparison['choice']}**. "
              f"{comparison['tests']['lmfGlazedOrBanded']}. LabelMeFacade's window labels are often incomplete "
              "(in 7 of 10 test images checked by eye only some windows are labelled), which counts true repetition as false and so "
              "penalises candidates that find more windows."]
    return lines


def rectified_section() -> list[str]:
    """The comparison of prompt 065 (rectified spacing and translational symmetry), if it ran."""
    comparison = json.loads(rhythm.CALIBRATION.read_text()).get("rectifiedComparison")
    if not comparison:
        return []
    names = {"cmpTest": "CMP odd", "lmfTest": "LabelMeFacade test", "lmfGlazedOrBanded": "glazed or banded"}
    lines = ["", "### Rectified façades and translational symmetry (prompt 065)", "",
             "Same windows and reference as above; balanced accuracy / precision, mean over bays and floors.", "",
             "| Candidate | " + " | ".join(names.values()) + " | Mean of the two test sets |", "|---|---|---|---|---|"]
    for key, row in comparison["results"].items():
        lines.append(f"| {key}: {comparison['candidates'][key]} | "
                     + " | ".join(f"{row[k]['balancedAccuracy']:.3f} / {row[k]['precision']:.3f}" for k in names)
                     + f" | {row['meanOfTestSets']:.3f} |")
    done, total = comparison["rectifiedWindows"]
    lines += ["", f"Rectified: {done} of {total} windows ({done / total:.0%}); the others have no façade plane with enough "
              f"agreeing edges (most CMP façades are already rectified). Rule: {comparison['rule']}. Choice: **{comparison['choice']}**."]
    return lines


def observed_section() -> list[str]:
    """The observing panel of prompt 060 (tools/vlm-panel), if it ran: spread, stability and its link with the measures."""
    path = REPO / "public" / "precomputed" / "vlm-panel" / "panel-observed.json"
    if not path.exists():
        return []
    o = json.loads(path.read_text())
    kinds = {p["id"]: p.get("imageKind", "photo") for p in photos()}
    lines = ["", "## The simulated panel as observer (prompt 060)", "",
             "Qwen3-VL answered visible questions (counts and yes/no; four sampled runs per photo); ratings 0–4 come from a rule "
             "fixed before the run. Weighted: the graded prompt's expected rating from the probabilities of 0–4, mean over four roles. "
             "Automated against automated, not a validation.", "",
             "| Principle | Observed: values (sd) | On the 24 photos | Weighted: distinct (range) | Graded medians (24 photos) | ρ observed / weighted with the measure |",
             "|---|---|---|---|---|---|"]
    for p in PRINCIPLES:
        d, s = o["discrimination"][p], o["spearmanWithImageMeasure"][p]
        on_photos = sorted(e["ratings"][p] for pid, e in o["photos"].items() if e["ratings"] and kinds.get(pid) == "photo")
        counts = ", ".join(f"{v}: {on_photos.count(v)}" for v in sorted(set(on_photos)))
        g = d["graded (prompt 044, medians)"]
        f = lambda v: "–" if v is None else f"{v:.2f}"
        lines.append(f"| {p} | {d['observed']['min']}–{d['observed']['max']} ({d['observed']['sd']:.2f}) | {counts} | "
                     f"{d['weighted']['distinct']} ({d['weighted']['min']:.1f}–{d['weighted']['max']:.1f}) | "
                     f"{g['distinct']} ({g['min']:.0f}–{g['max']:.0f}) | {f(s['observed']['rho'])} / {f(s['weighted']['rho'])} ({s['indicator']}) |")
    stab = ", ".join(f"{k} {v['allRunsAgree']:.0%}" for k, v in o["stability"].items() if v["allRunsAgree"] is not None)
    lines += ["", f"All four runs give the same answer: {stab}.",
              "On the ordinary photos the model answers yes to the rhythm questions almost every time, so rhythm still hardly "
              "separates them; its spread comes from the renderings."]
    return lines


def report(result: dict) -> str:
    r, f, s, d, x = result["rhythm"], result["frontage"], result["sensitivity"], result["discrimination"], result["panelCrossTable"]
    pct = lambda v: f"{v:.0%}"
    lines = [
        "# Image measures: checks",
        "",
        f"Made by `tools/qualities/checks.py` (prompt 043) on {result['date']}. Figures in",
        "`public/precomputed/qualities/checks.json`.",
        "",
        "## What was and was not checked",
        "",
        "- **Checked:** whether each measure reads its *components* as people",
        "  labelled them in public datasets, how much the outcomes depend on the",
        f"  rule thresholds, and whether the measures tell the {sum(v['photos'] for v in d['rhythm']['byGroup'].values())}",
        "  example photos apart (the photos and the study images, design",
        "  renderings, separately).",
        "- **Not checked:** the principles themselves. No experts have judged these",
        "  photos, so agreement with experts has not been evaluated. Agreement",
        "  between automated methods (below) is not validity.",
        "",
        "## Rhythm: repetition against CMP labels",
        "",
        f"{r['images']} CMP Facade images with odd numbers ({r['windows']} façade windows), not used for the",
        "calibration of τ. Reference: at least 3 regularly spaced elements of one labelled class (spec).",
        "",
        "| Family | τ | Balanced accuracy | Precision | Recall | Repeats (labels) | Repeats (measure) |",
        "|---|---|---|---|---|---|---|",
    ]
    for fam, v in r["families"].items():
        lines.append(f"| {fam} | {v['tau']:.2f} | {v['balancedAccuracy']:.2f} | {v['precision']:.2f} | {v['recall']:.2f} | "
                     f"{pct(v['referenceRepeats'])} | {pct(v['measureRepeats'])} |")
    lines += ["", f"Per image, the share of rhythmic windows from the measure against the share from the labels: "
              f"Spearman ρ = {r['rhythmicShareSpearman']:.2f}, mean absolute difference {r['rhythmicShareMeanAbsDiff']:.2f}.",
              "CMP façades are rectified (no perspective) and mostly classical, so this is an easier test than the street photos.",
              *glass_section(),
              *rectified_section(),
              "", "## Frontage: openings against CMP labels", "",
              f"{f['images']} CMP images with odd numbers that label doors or shops. {f['groundFloorProxy'][0].upper() + f['groundFloorProxy'][1:]} stands",
              "in for the ground floor, the same band for both sides, so only the openings and windows differ.", "",
              f"- `openShare` from the human labels against `openShare` from SAM 3: Spearman ρ = {f['openShareSpearman']:.2f},",
              f"  mean absolute difference {f['openShareMeanAbsDiff']:.2f};",
              f"- the same outcome from both: {pct(f['outcomeAgreement'])} of the images.", "",
              "| Labels ↓ / SAM 3 → | likely present | unclear | likely absent |", "|---|---|---|---|"]
    for a, row in f["outcomes"]["table"].items():
        lines.append(f"| {a.replace('-', ' ')} | " + " | ".join(str(v) for v in row.values()) + " |")
    lines += FRONTAGE_HAND_CHECK
    m = result["materials"]
    lines += ["", "## Materials: DMS46", "", m["note"], "",
              "| Class | Group | Test accuracy | Test IoU |", "|---|---|---|---|"]
    for name, v in m["table8"].items():
        lines.append(f"| {name} | {v['group']} | {v['accuracy']:.3f} | {v['iou']:.3f} |")
    lines += ["", m["ownCheck"], *surface_section(), "", "## Sensitivity of the rules", "",
              f"How many of the {len(result['discrimination']['rhythm']['perPhoto'])} outcomes change when one threshold is halved or multiplied by 1.5.", "",
              "| Principle | Threshold | Value | × 0.5 | × 1.5 |", "|---|---|---|---|---|"]
    for p, ts in s.items():
        for name, v in ts.items():
            lines.append(f"| {p} | {name} | {v['value']} | {v['x0.5']} | {v['x1.5']} |")
    lines += ["", "## Do the measures tell the photos apart?", "",
              "| Principle | Photos | Likely present | Unclear | Likely absent |", "|---|---|---|---|---|"]
    names = {"earlier": "photos", "study": "study images"}
    for p, v in d.items():
        for group, g in v["byGroup"].items():
            o = g["outcomes"]
            lines.append(f"| {p} | {g['photos']} {names.get(group, group)} | {o['likely-present']} | {o['unclear']} | {o['likely-absent']} |")
    lines += ["", "| Principle | Main indicator | Range over all photos |", "|---|---|---|"]
    for p, v in d.items():
        rng = "–" if v["min"] is None else f"{v['min']:.2f}–{v['max']:.2f}"
        lines.append(f"| {p} | `{v['indicator']}` | {rng} |")
    flagged = [f"{p} ({names.get(group, group)})" for p, v in d.items() for group, g in v["byGroup"].items() if g["sameOnAllPhotos"]]
    lines += ["", ("Flagged (same outcome on every photo of a group): " + ", ".join(flagged)) if flagged else
              "No measure gives the same outcome on every photo of a group.", "",
              "## Image measure against the simulated panel (automated against automated)", "",
              "Rows: image measure (likely present → present, unclear → ambiguous, likely absent → absent). "
              "Columns: the simulated panel's v1 consensus. Neither is an expert judgement.", ""]
    for p, v in x.items():
        lines += [f"**{p}** (same label on {pct(v['agreement'])} of the {v['photos']} photos the panel judged)", "",
                  "| Measure ↓ / panel → | present | ambiguous | absent |", "|---|---|---|---|"]
        for a, row in v["table"].items():
            lines.append(f"| {a} | " + " | ".join(str(c) for c in row.values()) + " |")
        lines.append("")
    lines += [*observed_section()[1:], "", "## Expert labels later", "",
              "Raters judge the photos on `/eek-a-look/rate.html` (prompt 059) on the 2020 panel's scale (`present`, `ambiguous`,",
              "`absent`) and send back its CSV; `uv run agreement.py --labels a.csv b.csv …` reports their agreement with each",
              "other (Krippendorff's alpha) and each method's agreement with their majority label.", ""]
    return "\n".join(lines)


def main() -> int:
    if "--surface" in sys.argv[1:]:  # prompt 063: only the surface-detail check
        s = surface_check()
        print(json.dumps({k: v for k, v in s.items() if k not in ("rule", "detail")}, indent=1))
        return 0
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    t0 = time.perf_counter()
    calibration = json.loads(rhythm.CALIBRATION.read_text())
    tau = {f: calibration["families"][f]["tau"] for f in ("vertical", "layer")}
    data = load_qualities()
    result = {"date": time.strftime("%Y-%m-%d"), "tool": "tools/qualities/checks.py"}
    result["rhythm"] = rhythm_check(dev, tau, calibration["instanceThreshold"])
    result["frontage"] = frontage_check(dev)
    result["materials"] = materials_check()
    result["sensitivity"] = sensitivity(data)
    result["discrimination"] = discrimination(data)
    result["panelCrossTable"] = panel_cross_table(data)
    result["seconds"] = round(time.perf_counter() - t0, 1)
    CHECKS.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    REPORT.write_text(report(result))
    print(json.dumps({k: v for k, v in result.items() if k not in ("materials",)}, indent=1)[:6000])
    print(f"Wrote {CHECKS.relative_to(REPO)} and {REPORT.relative_to(REPO)}")
    return 0


DMS_VAL = rhythm.CACHE / "dms-val"
DMS_IMAGES = 200
FACADE_LIKE = ("Brickwork", "Concrete", "Glass", "Paint/plaster/enamel", "Stone, natural", "Stone, polished", "Tile", "Metal")


def dms_test_images() -> list[dict]:
    """Up to 200 DMS test images, by id: outdoor, man-made, outdoor area or far outdoor, not rotated,
    with at least 20% of façade-like materials labelled. Their photos come from the original Flickr URLs."""
    import gzip

    info = json.loads(gzip.open(DMS_VAL / "DMS_v1" / "info.json.gz").read())
    names = json.loads((DMS_VAL / "DMS_v1" / "taxonomy.json").read_text())["names"]
    facade = [names.index(n) for n in FACADE_LIKE]
    chosen = [x for x in sorted(info, key=lambda x: x["id"]) if x["split"] == "test"
              and "outdoor, man-made" in x["predicted_scene_level1_attributes"]
              and x["photographic_label"] in ("outdoor_area", "far_outdoor")
              and not x["openimages_metadata"].get("Rotation")
              and sum(x["label_fraction"][i] for i in facade) >= 0.2]
    return chosen


def fetch_original(datum: dict) -> Path | None:
    """The original photo from Flickr, checked against Open Images' MD5; None when it is gone or differs."""
    import base64
    import hashlib
    import urllib.request

    path = DMS_VAL / "images" / f"{datum['id']}.jpg"
    if path.exists():
        return path
    meta = datum["openimages_metadata"]
    try:
        data = urllib.request.urlopen(meta["OriginalURL"], timeout=30).read()
    except Exception:
        return None
    if base64.b64encode(hashlib.md5(data).digest()).decode() != meta["OriginalMD5"]:
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


MIN_REGION = 400   # pixels: labelled regions smaller than this are left out of the AUCs (prompt 063)
STRIDE = 2         # every second pixel in each direction for the pixel counts


def auc(positive: list[float], negative: list[float]) -> float | None:
    """Probability that a positive region has more surface detail than a negative one (ties count half)."""
    if not positive or not negative:
        return None
    pos, neg = np.asarray(positive), np.asarray(negative)
    greater = (pos[:, None] > neg[None, :]).sum() + 0.5 * (pos[:, None] == neg[None, :]).sum()
    return float(greater / (len(pos) * len(neg)))


def surface_check() -> dict:
    """Prompt 063: surface detail against DMS's human material labels on the outdoor test images of the materials check,
    and the fixed rule for using it (adopted only if it improves the grouping on the odd images)."""
    import materials

    names = json.loads((DMS_VAL / "DMS_v1" / "taxonomy.json").read_text())["names"]
    groups = ["textured", "smooth", "neutral"]
    group = lambda n: "textured" if n in materials.TEXTURED else "smooth" if n in materials.SMOOTH else "neutral"
    full_group = np.array([groups.index(group(n)) if k else -1 for k, n in enumerate(names)])
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dms = None
    pred_cache = DMS_VAL / "pred"
    pred_cache.mkdir(exist_ok=True)
    regions, pixels, used = [], [], 0
    for datum in dms_test_images():
        if used == DMS_IMAGES:
            break
        path = fetch_original(datum)
        if path is None:
            continue
        size = (datum["width"], datum["height"])
        image = Image.open(path).convert("RGB").resize(size, Image.LANCZOS)
        truth = np.asarray(Image.open(DMS_VAL / "DMS_v1" / datum["label_path"]))
        cached = pred_cache / f"{datum['id']}.png"
        if cached.exists():
            pred = np.asarray(Image.open(cached))
        else:
            dms = dms or materials.Dms46(dev)
            pred = dms.labels(image, size)
            Image.fromarray(pred).save(cached)
        detail = materials.surface_detail(image)
        split = "even" if used % 2 == 0 else "odd"
        for k, name in enumerate(names):
            if not k or group(name) == "neutral":
                continue
            comp, n = ndimage.label(truth == k)
            if not n:
                continue
            sizes = ndimage.sum(np.ones_like(comp), comp, range(1, n + 1))
            means = ndimage.mean(detail, comp, range(1, n + 1))
            regions += [{"split": split, "name": name, "group": group(name), "detail": float(m)} for m, s in zip(means, sizes) if s >= MIN_REGION]
        dms_names = materials.names()
        sl = (slice(None, None, STRIDE), slice(None, None, STRIDE))
        t_g = full_group[truth[sl]]
        p_names = np.array(dms_names)[pred[sl]]
        p_g = np.array([groups.index(group(n)) for n in dms_names])[pred[sl]]
        candidate = np.isin(p_names, materials.DETAIL_CLASSES)
        pixels.append({"split": split, "truth": t_g.ravel(), "pred": p_g.ravel(), "candidate": candidate.ravel(), "detail": detail[sl].ravel()})
        used += 1
    if dms is not None:
        del dms
        torch.cuda.empty_cache()

    def scores(split: str, t: float | None) -> dict:
        inter, union = np.zeros(3), np.zeros(3)
        correct = total = 0
        for p in (x for x in pixels if x["split"] == split):
            pred = p["pred"].copy()
            if t is not None:
                pred[p["candidate"] & (p["detail"] > t)] = 0
            valid = p["truth"] >= 0
            for g in range(3):
                inter[g] += ((pred == g) & (p["truth"] == g) & valid).sum()
                union[g] += (((pred == g) | (p["truth"] == g)) & valid).sum()
            correct += ((pred == p["truth"]) & valid).sum()
            total += valid.sum()
        return {"pixelAccuracy": float(correct / total), "texturedIou": float(inter[0] / union[0]) if union[0] else None}

    even_detail = np.concatenate([p["detail"][p["candidate"]] for p in pixels if p["split"] == "even"])
    grid = np.unique(np.round(np.quantile(even_detail, np.linspace(0.5, 0.995, 40)), 4)) if len(even_detail) else np.zeros(0)
    by_t = [(float(t), scores("even", float(t))["pixelAccuracy"]) for t in grid]
    threshold = max(by_t, key=lambda x: x[1])[0] if by_t else None
    base_even, base_odd = scores("even", None), scores("odd", None)
    with_odd = scores("odd", threshold) if threshold is not None else base_odd
    adopted = bool(threshold is not None and with_odd["pixelAccuracy"] - base_odd["pixelAccuracy"] >= 0.01
                   and (with_odd["texturedIou"] or 0) >= (base_odd["texturedIou"] or 0))
    odd = [r for r in regions if r["split"] == "odd"]
    result = {
        "date": time.strftime("%Y-%m-%d"), "prompt": "063", "images": used,
        "detail": "|G(1) − G(3)| / (G(8) of the grey image + 0.01), averaged with G(8), at the image's own resolution",
        "regions": {"minPixels": MIN_REGION, "odd": len(odd)},
        "aucTexturedVsSmooth": auc([r["detail"] for r in odd if r["group"] == "textured"], [r["detail"] for r in odd if r["group"] == "smooth"]),
        "aucBrickVsPlaster": auc([r["detail"] for r in odd if r["name"] == "Brickwork"], [r["detail"] for r in odd if r["name"] == "Paint/plaster/enamel"]),
        "regionCounts": {"brick": sum(r["name"] == "Brickwork" for r in odd), "plaster": sum(r["name"] == "Paint/plaster/enamel" for r in odd),
                         "textured": sum(r["group"] == "textured" for r in odd), "smooth": sum(r["group"] == "smooth" for r in odd)},
        "candidateClasses": list(materials.DETAIL_CLASSES),
        "threshold": threshold, "evenAccuracy": {"without": base_even["pixelAccuracy"], "with": max(x[1] for x in by_t) if by_t else None},
        "odd": {"without": base_odd, "with": with_odd},
        "rule": "pixels DMS46 calls plaster/paint or concrete with surface detail above t count as textured; t maximises the grouping's "
                "pixel accuracy on the even images; adopted only if on the odd images the accuracy rises by at least 1 point and "
                "textured IoU does not fall",
        "adopted": adopted,
    }
    materials.SURFACE_CALIBRATION.write_text(json.dumps(result, indent=1))
    return result


def surface_section() -> list[str]:
    """The check of prompt 063, from surface_calibration.json, if it ran."""
    import materials

    if not materials.SURFACE_CALIBRATION.exists():
        return []
    s = json.loads(materials.SURFACE_CALIBRATION.read_text())
    f = lambda v: "–" if v is None else f"{v:.2f}"
    c = s["regionCounts"]
    return ["", "### Surface detail (prompt 063)", "",
            f"Surface detail ({s['detail']}) per labelled region of {s['images']} outdoor DMS test images, chosen as above "
            f"(more originals could be downloaded than for the materials check), odd images only: "
            f"AUC textured against smooth classes {f(s['aucTexturedVsSmooth'])} ({c['textured']} and {c['smooth']} regions), "
            f"brickwork against paint/plaster {f(s['aucBrickVsPlaster'])} ({c['brick']} and {c['plaster']} regions).", "",
            f"Rule tested: {s['rule']}. t = {s['threshold']}. Odd images: pixel accuracy {f(s['odd']['without']['pixelAccuracy'])} → "
            f"{f(s['odd']['with']['pixelAccuracy'])}, textured IoU {f(s['odd']['without']['texturedIou'])} → {f(s['odd']['with']['texturedIou'])}. "
            f"**{'Adopted' if s['adopted'] else 'Not adopted'}**: "
            + ("the materials measure counts such pixels as textured." if s["adopted"] else "surface detail is shown as an indicator only.")]


def materials_check() -> dict:
    """Table 8 of the paper, and the textured / smooth / neutral grouping scored on DMS test images."""
    import materials

    group = lambda n: "textured" if n in materials.TEXTURED else "smooth" if n in materials.SMOOTH else "neutral"
    result = {"note": "Per-class results of DMS46 on the DMS test set, from Upchurch & Niu (2022), Table 8. "
                      "They describe the model on its own kind of photos, not on Dutch or Swiss street façades.",
              "table8": {n: {"group": group(n), "accuracy": a, "iou": i} for n, (a, i) in DMS46_TABLE8.items()}}
    if not (DMS_VAL / "DMS_v1" / "info.json.gz").exists():
        result["ownCheck"] = "The DMS labels were not available, so no own check was run."
        return result

    names = json.loads((DMS_VAL / "DMS_v1" / "taxonomy.json").read_text())["names"]
    groups = ["textured", "smooth", "neutral"]
    full_group = np.array([groups.index(group(n)) if k else -1 for k, n in enumerate(names)])  # 0 = no label
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dms = materials.Dms46(dev)
    pred_group = np.array([groups.index(group(n)) for n in dms.names])
    inter, union = np.zeros(3), np.zeros(3)
    correct = total = used = missing = 0
    for datum in dms_test_images():
        if used == DMS_IMAGES:
            break
        path = fetch_original(datum)
        if path is None:
            missing += 1
            continue
        image = Image.open(path).convert("RGB").resize((datum["width"], datum["height"]), Image.LANCZOS)
        truth = full_group[np.asarray(Image.open(DMS_VAL / "DMS_v1" / datum["label_path"]))]
        pred = pred_group[dms.labels(image, (datum["width"], datum["height"]))]
        valid = truth >= 0
        for g in range(3):
            inter[g] += ((pred == g) & (truth == g) & valid).sum()
            union[g] += (((pred == g) | (truth == g)) & valid).sum()
        correct += ((pred == truth) & valid).sum()
        total += valid.sum()
        used += 1
    result["dmsTest"] = {"images": used, "originalsMissing": missing,
                         "selection": "DMS test split, by id: outdoor man-made, outdoor area or far outdoor, not rotated, "
                                      "at least 20% façade-like materials labelled; photos from their original Flickr URLs, MD5-checked",
                         "groupIou": {g: float(inter[k] / union[k]) if union[k] else None for k, g in enumerate(groups)},
                         "groupPixelAccuracy": float(correct / total) if total else None}
    iou = result["dmsTest"]["groupIou"]
    result["ownCheck"] = (f"Own check on {used} outdoor DMS test images ({missing} originals no longer available): the textured / "
                          f"smooth / neutral grouping agrees with the human labels on {result['dmsTest']['groupPixelAccuracy']:.0%} of "
                          f"labelled pixels; IoU textured {iou['textured']:.2f}, smooth {iou['smooth']:.2f}, neutral {iou['neutral']:.2f}. "
                          "These are the model's own kind of photos (in-domain), so on Dutch and Swiss streets it may do worse.")
    del dms
    torch.cuda.empty_cache()
    return result


if __name__ == "__main__":
    sys.exit(main())
