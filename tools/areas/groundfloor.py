"""The ground floor: façade pixels from where each façade meets the ground up to
a storey height, found from the horizon and an eye-height camera.

For a level pinhole camera at height c over flat ground, a point at height h on
a vertical façade lies at row y = y_h − (h − c)/c · (y0 − y_h), where y_h is the
horizon row and y0 the row where that façade meets the ground (Hoiem, Efros &
Hebert 2008). The horizon is estimated from vanishing points of receding
horizontal façade edges, assuming no roll.
"""

import cv2
import numpy as np
from scipy import ndimage

CAMERA_HEIGHT_M = 1.6
STOREY_HEIGHT_M = 4.0
MIN_SUPPORT = 15  # segments that must agree on a vanishing point
RANSAC_ROUNDS = 3000
INLIER_DEGREES = 1.5


def _segments(gray: np.ndarray, facade: np.ndarray) -> np.ndarray:
    """Receding horizontal edge candidates on façade pixels: (x1, y1, x2, y2) rows."""
    lines = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD).detect(gray)[0]
    if lines is None:
        return np.zeros((0, 4))
    seg = lines.reshape(-1, 4).astype(np.float64)
    h, w = gray.shape
    length = np.hypot(seg[:, 2] - seg[:, 0], seg[:, 3] - seg[:, 1])
    angle = np.degrees(np.abs(np.arctan2(seg[:, 3] - seg[:, 1], seg[:, 2] - seg[:, 0])))
    angle = np.minimum(angle, 180 - angle)  # 0 = horizontal, 90 = vertical
    mx = np.clip(((seg[:, 0] + seg[:, 2]) / 2 * facade.shape[1] / w).astype(int), 0, facade.shape[1] - 1)
    my = np.clip(((seg[:, 1] + seg[:, 3]) / 2 * facade.shape[0] / h).astype(int), 0, facade.shape[0] - 1)
    keep = (length >= 0.03 * w) & (angle >= 2) & (angle <= 75) & facade[my, mx]
    return seg[keep]


def _vanishing_point(seg: np.ndarray, rng: np.random.Generator) -> tuple[np.ndarray | None, np.ndarray]:
    """RANSAC: the point most segments point at, weighted by length; returns (point, inlier mask)."""
    p1 = np.c_[seg[:, :2], np.ones(len(seg))]
    p2 = np.c_[seg[:, 2:], np.ones(len(seg))]
    lines = np.cross(p1, p2)
    mid = (seg[:, :2] + seg[:, 2:]) / 2
    direction = seg[:, 2:] - seg[:, :2]
    length = np.hypot(*direction.T)
    best, best_score, best_inliers = None, 0.0, np.zeros(len(seg), bool)
    for _ in range(RANSAC_ROUNDS):
        i, j = rng.choice(len(seg), 2, replace=False)
        v = np.cross(lines[i], lines[j])
        if abs(v[2]) < 1e-9:
            continue
        v = v[:2] / v[2]
        to_v = v - mid
        cos = np.abs((to_v * direction).sum(1)) / (np.hypot(*to_v.T) * length + 1e-12)
        inliers = cos >= np.cos(np.radians(INLIER_DEGREES))
        score = length[inliers].sum()
        if score > best_score:
            best, best_score, best_inliers = v, score, inliers
    return best, best_inliers


def horizon_row(gray: np.ndarray, facade: np.ndarray, seed: int = 0) -> tuple[float, str, int]:
    """Horizon row in gray's pixels, the method and the number of supporting segments."""
    h = gray.shape[0]
    seg = _segments(gray, facade)
    rng = np.random.default_rng(seed)
    rows, weights = [], []
    for _ in range(2):  # up to two vanishing points (e.g. both sides of a street corner)
        if len(seg) < MIN_SUPPORT:
            break
        v, inliers = _vanishing_point(seg, rng)
        if v is None or inliers.sum() < MIN_SUPPORT:
            break
        rows.append(v[1])
        weights.append(int(inliers.sum()))
        seg = seg[~inliers]
    if rows:
        row = float(np.average(rows, weights=weights))
        if 0.1 * h <= row <= 0.9 * h:
            return row, "vanishing-lines", int(sum(weights))
    return h / 2, "assumed-level", int(sum(weights))


def ground_floor(categories: np.ndarray, ids: list[str], horizon: float,
                 camera_m: float = CAMERA_HEIGHT_M, storey_m: float = STOREY_HEIGHT_M) -> np.ndarray:
    """Ground-floor mask on the category grid; horizon is in the same rows."""
    height, width = categories.shape
    facade = categories == ids.index("facade")
    street = categories == ids.index("street-surface")
    base = np.full(width, np.nan)
    visible = np.zeros(width, bool)
    present = facade.any(0)
    for x in np.flatnonzero(present):
        bottom = np.flatnonzero(facade[:, x])[-1]
        # The base is visible only where the lowest façade pixel meets street
        # surface. Elsewhere (people, vehicles, furniture, signage, greenery,
        # the image edge or anything else) it is interpolated below.
        if bottom + 1 < height and street[bottom + 1, x]:
            base[x], visible[x] = bottom, True
    # Interpolate hidden bases within each run of façade columns.
    runs, n = ndimage.label(present)
    for k in range(1, n + 1):
        cols = np.flatnonzero(runs == k)
        known = cols[visible[cols]]
        if len(known) == 0:
            base[cols] = np.nan
            continue
        base[cols] = np.interp(cols, known, base[known])
    mask = np.zeros_like(facade)
    rows = np.arange(height)[:, None]
    ok = ~np.isnan(base) & (base > horizon)
    top = horizon - (storey_m - camera_m) / camera_m * (base - horizon)
    band = ok[None, :] & (rows >= top[None, :]) & (rows <= base[None, :])
    mask[band & facade] = True
    return mask


def head_offset(categories: np.ndarray, ids: list[str], horizon: float) -> float | None:
    """Median top row of standing people minus the horizon, in % of the height."""
    height = categories.shape[0]
    labels, n = ndimage.label(categories == ids.index("people"))
    tops = []
    for sl in ndimage.find_objects(labels):
        if sl is not None and (sl[0].stop - sl[0].start) >= 0.05 * height:
            tops.append(sl[0].start)
    if not tops:
        return None
    return float((np.median(tops) - horizon) / height * 100)
