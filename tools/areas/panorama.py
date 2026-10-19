"""Perspective views of a level 360° panorama (prompt 061): the four side faces of a cube map.

SAM 3 is trained on ordinary photos and finds no façade elements in the
equirectangular panoramas, where straight lines curve. Each face is a 90° × 90°
gnomonic view (yaw 0°, 90°, 180°, 270°; pitch 0°), so together they cover every
direction within about 35° of the horizon (45° straight ahead of a face) without
overlap. `to_face` samples an
equirectangular array into a face; `from_face` maps a face array back onto the
equirectangular grid.

Equirectangular convention: column u is longitude 2π (u + 0.5) / W − π, row v is
latitude π/2 − π (v + 0.5) / H (the horizon in the middle row, as in prompt 051).
"""

import cv2
import numpy as np

YAWS = (0, 90, 180, 270)
FACE = 512


def _face_to_equirect(yaw: float, width: int, height: int, n: int) -> tuple[np.ndarray, np.ndarray]:
    """For each face pixel, the (float) equirectangular column and row it shows."""
    psi = np.radians(yaw)
    j, i = np.meshgrid(np.arange(n), np.arange(n))
    x, y = 2 * (j + 0.5) / n - 1, 1 - 2 * (i + 0.5) / n
    dx, dz = x * np.cos(psi) + np.sin(psi), -x * np.sin(psi) + np.cos(psi)
    lon, lat = np.arctan2(dx, dz), np.arctan2(y, np.hypot(dx, dz))
    u = (lon + np.pi) / (2 * np.pi) * width - 0.5
    v = (np.pi / 2 - lat) / np.pi * height - 0.5
    return u.astype(np.float32), v.astype(np.float32)


def _equirect_to_face(yaw: float, width: int, height: int, n: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """For each equirectangular pixel, the (float) face column and row, and whether the face shows it."""
    psi = np.radians(yaw)
    u, v = np.meshgrid(np.arange(width), np.arange(height))
    lon = 2 * np.pi * (u + 0.5) / width - np.pi
    lat = np.pi / 2 - np.pi * (v + 0.5) / height
    dx, dy, dz = np.cos(lat) * np.sin(lon), np.sin(lat), np.cos(lat) * np.cos(lon)
    fx, fz = dx * np.cos(psi) - dz * np.sin(psi), dx * np.sin(psi) + dz * np.cos(psi)
    with np.errstate(divide="ignore", invalid="ignore"):
        x, y = fx / fz, dy / fz
    valid = (fz > 0) & (np.abs(x) <= 1) & (np.abs(y) <= 1)
    j = np.where(valid, (x + 1) / 2 * n - 0.5, -1)
    i = np.where(valid, (1 - y) / 2 * n - 0.5, -1)
    return j.astype(np.float32), i.astype(np.float32), valid


def to_face(array: np.ndarray, yaw: float, n: int = FACE, nearest: bool = False) -> np.ndarray:
    """An equirectangular image or label grid (H × W [× C]) seen in one face, n × n."""
    height, width = array.shape[:2]
    u, v = _face_to_equirect(yaw, width, height, n)
    return cv2.remap(array, u, v, cv2.INTER_NEAREST if nearest else cv2.INTER_CUBIC, borderMode=cv2.BORDER_WRAP)


def from_face(face: np.ndarray, yaw: float, width: int, height: int) -> tuple[np.ndarray, np.ndarray]:
    """A face array (labels or scores, nearest) on the equirectangular grid, and the pixels the face covers."""
    j, i, valid = _equirect_to_face(yaw, width, height, face.shape[0])
    out = cv2.remap(face, j, i, cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return np.where(valid, out, 0).astype(face.dtype), valid
