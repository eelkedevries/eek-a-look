"""Image measures for the three design principles, for every example photo.

  uv run build.py                 every measure that is implemented
  uv run build.py --ground-floor  the active ground floor only (prompt 040)

Writes public/precomputed/qualities/<photo-id>.json (QualityFile in the
specification), keeping the principles not re-run, and a check overlay per
photo and principle to .cache/check/.
"""

import argparse
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


def fmt(value) -> str:
    if value is None:
        return "–"
    return f"{value:.2f}" if isinstance(value, float) else str(value)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ground-floor", action="store_true")
    args = parser.parse_args()
    run_all = not args.ground_floor
    (CACHE / "check").mkdir(parents=True, exist_ok=True)

    failures = 0
    counts: dict[str, dict[str, int]] = {}
    rows = []
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
        path = write_quality(quality)
        problems = check_quality(path)
        failures += bool(problems)
        if problems:
            print(f"{photo['id']}: PROBLEM {'; '.join(problems)}")

    if rows:
        keys = list(rows[0][1]["indicators"])
        print(f"{'photo':42} {'outcome':8} " + " ".join(f"{k[:11]:>11}" for k in keys))
        for pid, result in rows:
            print(f"{pid:42} {OUTCOME[result['outcome']]:8} " + " ".join(f"{fmt(result['indicators'][k]):>11}" for k in keys))
    for name, c in counts.items():
        print(f"\n{name}: " + ", ".join(f"{OUTCOME[o]} {n}" for o, n in sorted(c.items())))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
