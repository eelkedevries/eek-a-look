"""Active ground floor: which columns of the ground floor are open, transparent
only or closed, and the fixed rule of the specification (prompt 040).

Operational definition (this project's, not the 2020 panel's): visible
street-level frontage that offers openings to the street, namely entrances and
shopfronts. Windows are shown but do not by themselves make a frontage active.
"""

import numpy as np
from scipy import ndimage

from shared import AreaData, evidence

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
    outcome, reasons = rule(indicators)
    if data.horizon["method"] == "assumed-level":
        reasons.append("The ground floor was estimated assuming a level camera.")

    columns = lambda c: floor & (classes == c)[None, :]
    layers = [
        evidence("open-frontage", "Open frontage", "supports", columns(OPEN)),
        evidence("transparent-frontage", "Transparent only", "context", columns(TRANSPARENT)),
        evidence("closed-frontage", "Closed frontage", "against", columns(CLOSED)),
        evidence("entrances", "Entrances", "supports", entrances & floor),
        evidence("shopfronts", "Shopfronts", "supports", shopfronts & floor),
    ]
    return {"outcome": outcome, "reasons": reasons, "indicators": indicators, "evidence": layers}, classes


def rule(ind: dict) -> tuple[str, list[str]]:
    """The rule of the specification (Architectural qualities, active ground floor)."""
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
