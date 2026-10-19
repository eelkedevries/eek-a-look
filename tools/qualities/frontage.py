"""Active ground floor: which columns of the ground floor are open, transparent
only or closed, and the fixed rule of the specification (prompt 040).

Operational definition (this project's, not the 2020 panel's): visible
street-level frontage that offers openings to the street, namely entrances and
shopfronts. Windows are shown but do not by themselves make a frontage active.
"""

import json

import numpy as np
from scipy import ndimage

from shared import CACHE, CATEGORY_IDS, HERE, AreaData, evidence
import groundfloor  # noqa: E402  (tools/areas, on the path via shared: façade bases and the camera model)

MIN_COLUMN_PIXELS = 3
COVER = 0.30            # share of a column's ground floor that makes it open (or transparent)
MIN_ENTRANCE_PIXELS = 20
USE_BAND = 0.5          # band below the ground floor, as a share of its local height
OPEN, TRANSPARENT, CLOSED, NONE = 2, 1, 0, -1


def column_classes(floor: np.ndarray, openings: np.ndarray, windows: np.ndarray) -> np.ndarray:
    """Per image column: OPEN, TRANSPARENT, CLOSED, or NONE where there is no frontage."""
    n = floor.sum(0)
    opened = (floor & openings).sum(0)
    glazed = (floor & windows).sum(0)
    classes = np.full(floor.shape[1], NONE)
    frontage = n >= MIN_COLUMN_PIXELS
    classes[frontage] = CLOSED
    classes[frontage & (glazed >= COVER * n)] = TRANSPARENT
    classes[frontage & (opened >= COVER * n)] = OPEN
    return classes


def longest_run(flags: np.ndarray) -> int:
    best = run = 0
    for f in flags:
        run = run + 1 if f else 0
        best = max(best, run)
    return best


def use_cues(data: AreaData, floor: np.ndarray, classes: np.ndarray) -> float | None:
    """Share of a band under the ground floor covered by people, signage or street furniture."""
    cues = data.category("people") | data.category("signage") | data.category("street-furniture")
    hit = total = 0
    for x in np.flatnonzero(classes != NONE):
        rows = np.flatnonzero(floor[:, x])
        base, tall = rows[-1], rows[-1] - rows[0] + 1
        band = slice(base + 1, min(data.height, base + 1 + int(np.ceil(USE_BAND * tall))))
        hit += int(cues[band, x].sum())
        total += band.stop - band.start
    return hit / total if total else None


# --- frontage density and an adapted grade (prompt 062) ---------------------------
# Urban Design Compendium, Table 5.3 "Active frontage guidelines" (adapted from Gehl, 1994): premises and
# doors and windows per 100 m, and the share of blind or passive façade. Entrances stand in for premises.

FIELDS_OF_VIEW = (45, 60, 75)   # assumed horizontal field of view of a perspective photo, degrees; 60 is the main one
MAIN_FOV = 60
MAX_DISTANCE_M = 60.0           # frontage further away is not counted
MAX_STEP_M = 3.0                # a larger jump between neighbouring columns is a break (another façade)
MIN_FRONTAGE_M = 20.0           # less counted frontage gives no grade
SMOOTH_COLUMNS = 9
GRADE_SOURCE = "adapted from the Urban Design Compendium, Table 5.3 (after Gehl, 1994); not an expert grade"


def smoothed_bases(data: AreaData) -> np.ndarray:
    """Per column, the row where the façade meets the street (tools/areas), smoothed within each run of façade."""
    base = groundfloor._bases(data.categories, CATEGORY_IDS)
    out = np.full_like(base, np.nan)
    runs, n = ndimage.label(~np.isnan(base))
    for k in range(1, n + 1):
        cols = np.flatnonzero(runs == k)
        values = ndimage.median_filter(base[cols], size=min(SMOOTH_COLUMNS, len(cols)), mode="nearest")
        out[cols] = ndimage.uniform_filter1d(values, size=min(SMOOTH_COLUMNS, len(cols)), mode="nearest")
    return out


def ground_points(data: AreaData, base: np.ndarray, fov: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Where each column's façade base meets the ground, in metres from the camera (x across, z ahead), and its distance.
    Perspective: a level pinhole camera at eye height (groundfloor.py); the sideways position needs no focal length,
    the depth does."""
    width = data.width
    below = base + 0.5 - data.horizon["row"]
    below = np.where(below > 0, below, np.nan)
    x = np.arange(width) + 0.5
    c = groundfloor.CAMERA_HEIGHT_M
    focal = (width / 2) / np.tan(np.radians(fov) / 2)
    gx, gz = (x - width / 2) * c / below, c * focal / below
    return gx, gz, np.hypot(gx, gz)


def components(mask: np.ndarray) -> list[tuple[float, float]]:
    """Centres (row, column) of the connected parts of a mask of at least MIN_ENTRANCE_PIXELS."""
    labels, count = ndimage.label(mask)
    if not count:
        return []
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    centres = ndimage.center_of_mass(mask, labels, range(1, count + 1))
    return [c for c, s in zip(centres, sizes) if s >= MIN_ENTRANCE_PIXELS]


def adapted_grade(entrances: float, openings: float, blind_passive: float) -> str:
    """The grade of prompt 062, fixed before it ran; per 100 m of counted frontage."""
    if entrances > 15 and openings > 25 and blind_passive < 0.10:
        return "A"
    if entrances >= 10 and openings > 15 and blind_passive < 0.25:
        return "B"
    if entrances >= 6 and blind_passive < 0.50:
        return "C"
    if entrances >= 3:
        return "D"
    return "E"


def frontage_density(data: AreaData, floor: np.ndarray, classes: np.ndarray, entrances: np.ndarray, shopfronts: np.ndarray) -> dict:
    """Counted length, openings per 100 m and the adapted grade, per assumed field of view."""
    base = smoothed_bases(data)
    doors = components(entrances & floor)
    shops = components(shopfronts & floor)
    threshold = json.loads((HERE / "rhythm_calibration.json").read_text())["instanceThreshold"]
    path = CACHE / "instances-scored" / f"{data.photo}.json"
    found = json.loads(path.read_text()).get("window", []) if path.exists() else []
    openings_mask = entrances | shopfronts
    windows = []
    for i in found:
        row, col = int(i["cy"]), int(i["cx"])
        if i["score"] >= threshold and 0 <= row < data.height and 0 <= col < data.width and floor[row, col] and not openings_mask[row, col]:
            windows.append((i["cy"], i["cx"]))

    per_view = {}
    for fov in FIELDS_OF_VIEW:
        gx, gz, distance = ground_points(data, base, fov)
        counted = (classes != NONE) & np.isfinite(distance) & (distance <= MAX_DISTANCE_M)
        step = np.hypot(np.diff(gx), np.diff(gz))
        pairs = counted[:-1] & counted[1:] & np.isfinite(step) & (step <= MAX_STEP_M)
        length = float(step[pairs].sum())
        inside = lambda centres: sum(1 for _, col in centres if counted[min(int(col), data.width - 1)])
        n_doors, n_shops, n_windows = inside(doors), inside(shops), inside(windows)
        cols = int(counted.sum())
        blind_passive = float(((classes == CLOSED) | (classes == TRANSPARENT))[counted].sum() / cols) if cols else None
        per100 = lambda n: 100 * n / length if length > 0 else None
        grade = (adapted_grade(per100(n_doors), per100(n_doors + n_shops + n_windows), blind_passive)
                 if length >= MIN_FRONTAGE_M and blind_passive is not None else None)
        per_view[fov] = {"lengthM": length, "entrances": n_doors, "shopfronts": n_shops, "windows": n_windows,
                         "entrancesPer100m": per100(n_doors), "openingsPer100m": per100(n_doors + n_shops + n_windows),
                         "blindPassiveShare": blind_passive, "grade": grade}
    main = per_view[MAIN_FOV]
    grades = sorted({v["grade"] for v in per_view.values() if v["grade"]})
    value = None if main["grade"] is None else grades[0] if len(grades) == 1 else f"{grades[0]}–{grades[-1]}"
    return {"main": main, "grade": {"value": value, "source": GRADE_SOURCE,
                                    "byFieldOfView": {str(f): v["grade"] for f, v in per_view.items()}}}


def measure(data: AreaData) -> dict:
    floor = data.mask("ground-floor")
    entrances, shopfronts, windows = data.mask("entrances"), data.mask("shopfronts"), data.mask("windows")
    classes = column_classes(floor, entrances | shopfronts, windows)
    frontage = classes != NONE
    n = int(frontage.sum())
    share = lambda c: float((classes == c).sum() / n) if n else None

    labels, count = ndimage.label(entrances)
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1)) if count else []
    on_floor = ndimage.maximum(floor, labels, range(1, count + 1)) if count else []
    n_entrances = int(sum(1 for s, f in zip(sizes, on_floor) if s >= MIN_ENTRANCE_PIXELS and f))

    indicators = {
        "frontageShare": n / data.width,
        "openShare": share(OPEN),
        "transparentShare": share(TRANSPARENT),
        "closedShare": share(CLOSED),
        "entrances": n_entrances,
        "longestClosedRun": longest_run(classes == CLOSED) / n if n else None,
        "useCues": use_cues(data, floor, classes),
    }
    density = None
    if data.horizon["method"] != "assumed-level":  # prompt 040b: the geometry needs a found horizon
        density = frontage_density(data, floor, classes, entrances, shopfronts)
        main = density["main"]
        indicators |= {"countedFrontageM": main["lengthM"], "entrancesPer100m": main["entrancesPer100m"],
                       "openingsPer100m": main["openingsPer100m"], "blindPassiveShare": main["blindPassiveShare"],
                       "shopfronts": main["shopfronts"], "groundFloorWindows": main["windows"]}
    outcome, reasons = rule(indicators, data.horizon["method"])

    columns = lambda c: floor & (classes == c)[None, :]
    layers = [
        evidence("open-frontage", "Open frontage", "supports", columns(OPEN)),
        evidence("transparent-frontage", "Transparent only", "context", columns(TRANSPARENT)),
        evidence("closed-frontage", "Closed frontage", "against", columns(CLOSED)),
        evidence("entrances", "Entrances", "supports", entrances & floor),
        evidence("shopfronts", "Shopfronts", "supports", shopfronts & floor),
    ]
    result = {"outcome": outcome, "reasons": reasons, "indicators": indicators, "evidence": layers}
    if density:
        result["grade"] = density["grade"]
    return result, classes


def rule(ind: dict, horizon_method: str) -> tuple[str, list[str]]:
    """The rule of the specification (Architectural qualities, active ground floor)."""
    if horizon_method == "assumed-level":  # prompt 040b: the 4 m rule needs a found horizon
        return "unclear", ["The horizon could not be found, so the ground floor may be far too tall or missing."]
    if ind["frontageShare"] < 0.05:
        return "unclear", ["Too little ground floor is visible."]
    if ind["openShare"] >= 0.30:
        return "likely-present", [f"Entrances or shopfronts along {ind['openShare']:.0%} of the visible frontage."]
    if ind["openShare"] < 0.10 and ind["closedShare"] >= 0.60:
        return "likely-absent", [f"Closed along {ind['closedShare']:.0%} of the visible frontage; "
                                 f"entrances or shopfronts along {ind['openShare']:.0%}."]
    if ind["transparentShare"] >= 0.30:
        return "unclear", ["Mostly windows: transparency alone does not show an active frontage."]
    return "unclear", ["Open and closed stretches are mixed."]
