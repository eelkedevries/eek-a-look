"""Image measures for the three design principles, for every example photo.

  uv run build.py                 every measure that is implemented
  uv run build.py --ground-floor  the active ground floor only (prompt 040)
  uv run build.py --rhythm        rhythm and variety only (prompt 041); calibrates
                                  τ on CMP Facade first if rhythm_calibration.json
                                  is missing
  uv run build.py --calibrate     re-run the rhythm calibration

Writes public/precomputed/qualities/<photo-id>.json (QualityFile in the
specification), keeping the principles not re-run, and a check overlay per
photo and principle to .cache/check/.
"""

import argparse
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

import frontage
from shared import CACHE, EXAMPLES, AreaData, check_quality, load_quality, photos, write_quality

OUTCOME = {"likely-present": "present", "likely-absent": "absent", "unclear": "unclear"}
FRONTAGE_COLOURS = {frontage.OPEN: (0, 158, 115), frontage.TRANSPARENT: (86, 180, 233), frontage.CLOSED: (213, 94, 0)}


def greyed(photo: dict, width: int, height: int) -> np.ndarray:
    image = Image.open(EXAMPLES / photo["file"]).convert("L").resize((width, height), Image.LANCZOS)
    return np.asarray(image.convert("RGB"), dtype=np.float32) * 0.6


def frontage_overlay(photo: dict, data: AreaData, classes: np.ndarray) -> None:
    w, h = data.width * 2, data.height * 2
    base = greyed(photo, w, h)
    floor = np.kron(data.mask("ground-floor"), np.ones((2, 2), bool))
    cols = np.repeat(classes, 2)
    for c, colour in FRONTAGE_COLOURS.items():
        area = floor & (cols == c)[None, :]
        base[area] = base[area] * 0.35 + np.array(colour) * 0.65
    strip = np.full((24, w, 3), 30, np.float32)
    for c, colour in FRONTAGE_COLOURS.items():
        strip[:, cols == c] = colour
    out = Image.fromarray(np.vstack([base, strip]).astype(np.uint8))
    draw = ImageDraw.Draw(out)
    for k, (name, c) in enumerate((("open", frontage.OPEN), ("transparent only", frontage.TRANSPARENT), ("closed", frontage.CLOSED))):
        draw.rectangle((8, 8 + 18 * k, 22, 22 + 18 * k), fill=FRONTAGE_COLOURS[c])
        draw.text((28, 9 + 18 * k), name, fill=(255, 255, 255))
    out.save(CACHE / "check" / f"{photo['id']}-ground-floor.png")


def rhythm_overlay(photo: dict, data: AreaData, detail: dict) -> None:
    import rhythm

    w, h = data.width * 2, data.height * 2
    colours = {rhythm.RHYTHMIC: (0, 158, 115), rhythm.LAYERS: (86, 180, 233), rhythm.BAYS: (0, 114, 178),
               rhythm.PLAIN: (213, 94, 0), rhythm.IRREGULAR: (204, 121, 167)}
    zone_colours = [(230, 159, 0), (86, 180, 233), (0, 158, 115), (240, 228, 66), (0, 114, 178), (213, 94, 0), (204, 121, 167)]
    facade = np.kron(data.category("facade"), np.ones((2, 2), bool))
    panels = []
    for kind in ("classes", "zones"):
        base = greyed(photo, w, h)
        for cell, cls, zone in zip(detail["cells"], detail["classes"], detail["zones"]):
            y0, x0 = cell["row"] * rhythm.CELL * 2, cell["col"] * rhythm.CELL * 2
            sl = (slice(y0, y0 + rhythm.CELL * 2), slice(x0, x0 + rhythm.CELL * 2))
            colour = colours[cls] if kind == "classes" else (zone_colours[zone % len(zone_colours)] if zone >= 0 else None)
            if colour is None:
                continue
            m = facade[sl]
            base[sl][m] = base[sl][m] * 0.45 + np.array(colour) * 0.55
        out = Image.fromarray(base.astype(np.uint8))
        draw = ImageDraw.Draw(out)
        if kind == "classes":
            for family, colour in (("layer", (255, 255, 120)), ("vertical", (255, 255, 255))):
                for s in detail["segments"][family]:
                    draw.line([(s[4] * 2, s[5] * 2), (s[6] * 2, s[7] * 2)], fill=colour, width=1)
            for phrase in detail["instances"].values():
                for i in phrase:
                    draw.ellipse((i["cx"] * 2 - 2, i["cy"] * 2 - 2, i["cx"] * 2 + 2, i["cy"] * 2 + 2), fill=(255, 0, 255))
            for k, (name, c) in enumerate((("rhythmic", rhythm.RHYTHMIC), ("layers only", rhythm.LAYERS), ("bays only", rhythm.BAYS),
                                           ("plain", rhythm.PLAIN), ("irregular", rhythm.IRREGULAR))):
                draw.rectangle((8, 8 + 18 * k, 22, 22 + 18 * k), fill=colours[c])
                draw.text((28, 9 + 18 * k), name, fill=(255, 255, 255))
        else:
            draw.text((8, 8), f"{int(detail['zones'].max() + 1) if len(detail['zones']) else 0} zones (cells outside a zone uncoloured)", fill=(255, 255, 255))
        panels.append(out)
    sheet = Image.new("RGB", (w * 2 + 8, h), (20, 20, 20))
    sheet.paste(panels[0], (0, 0)); sheet.paste(panels[1], (w + 8, 0))
    sheet.save(CACHE / "check" / f"{photo['id']}-rhythm.png")


def fmt(value) -> str:
    if value is None:
        return "–"
    return f"{value:.2f}" if isinstance(value, float) else str(value)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ground-floor", action="store_true")
    parser.add_argument("--rhythm", action="store_true")
    parser.add_argument("--calibrate", action="store_true")
    args = parser.parse_args()
    run_all = not (args.ground_floor or args.rhythm or args.calibrate)
    (CACHE / "check").mkdir(parents=True, exist_ok=True)

    tau, dev, sam_holder = None, None, {}
    if run_all or args.rhythm or args.calibrate:
        import torch
        import rhythm

        dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if args.calibrate or not rhythm.CALIBRATION.exists():
            result = rhythm.calibrate(dev)
            print(f"Calibration on {result['images']} CMP images, {result['windows']} windows, {result['seconds']} s:")
            for family, r in result["families"].items():
                print(f"  {family:8} tau {r['tau']:.2f}  balanced accuracy {r['balancedAccuracy']:.3f}  "
                      f"precision {r['precision']:.2f}  recall {r['recall']:.2f}  reference repeats {r['referenceRepeats']:.0%}")
        calibration = json.loads(rhythm.CALIBRATION.read_text())
        tau = {f: calibration["families"][f]["tau"] for f in ("vertical", "layer")}
        if dev.type == "cuda":
            torch.cuda.reset_peak_memory_stats()

    failures = 0
    counts: dict[str, dict[str, int]] = {}
    rows, rhythm_rows = [], []
    for photo in photos():
        data = AreaData(photo["id"])
        quality = load_quality(data)
        if run_all or args.ground_floor:
            result, classes = frontage.measure(data)
            quality["principles"]["groundFloor"] = result
            quality["models"]["groundFloor"] = "frontage columns, tools/qualities/frontage.py (area file: ground floor, entrances, shopfronts, windows)"
            frontage_overlay(photo, data, classes)
            counts.setdefault("groundFloor", {}).setdefault(result["outcome"], 0)
            counts["groundFloor"][result["outcome"]] += 1
            rows.append((photo["id"], result))
        if run_all or args.rhythm:
            import rhythm

            result, detail = rhythm.measure(photo, data, dev, sam_holder, tau)
            quality["principles"]["rhythm"] = result
            quality["models"]["rhythm"] = (f"cells and periodicity, tools/qualities/rhythm.py; tau vertical {tau['vertical']}, "
                                          f"layer {tau['layer']} (CMP calibration); SAM 3 {rhythm.elements.CANDIDATES['D']['repos'][0][0]}@"
                                          f"{rhythm.elements.CANDIDATES['D']['repos'][0][1]}; OpenCV LSD")
            rhythm_overlay(photo, data, detail)
            counts.setdefault("rhythm", {}).setdefault(result["outcome"], 0)
            counts["rhythm"][result["outcome"]] += 1
            rhythm_rows.append((photo["id"], result))
        path = write_quality(quality)
        problems = check_quality(path)
        failures += bool(problems)
        if problems:
            print(f"{photo['id']}: PROBLEM {'; '.join(problems)}")

    for table in (rows, rhythm_rows):
        if not table:
            continue
        keys = list(table[0][1]["indicators"])
        print(f"\n{'photo':42} {'outcome':8} " + " ".join(f"{k[:11]:>11}" for k in keys))
        for pid, result in table:
            print(f"{pid:42} {OUTCOME[result['outcome']]:8} " + " ".join(f"{fmt(result['indicators'][k]):>11}" for k in keys))
    if dev is not None and dev.type == "cuda":
        import torch
        print(f"\nPeak GPU memory: {torch.cuda.max_memory_allocated() / 1e9:.2f} GB")
    for name, c in counts.items():
        print(f"\n{name}: " + ", ".join(f"{OUTCOME[o]} {n}" for o, n in sorted(c.items())))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
