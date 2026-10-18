"""Shared steps for running DeepGaze IIE and DeepGaze MSDB on the local GPU.

DeepGaze (https://github.com/matthias-k/DeepGaze) has no licence file, so its
code and weights are installed and downloaded on this machine only; eek-a-look
publishes nothing but the resulting maps.

Settings, matching the MIT300 benchmark entries quoted on the site:
- photos are resized to 1024 px on the long side, the scale of MIT1003;
- the MIT1003 centre-bias template from DeepGaze's v1.0.0 release is used;
- DeepGaze MSDB uses 35 pixels per degree and its MIT1003 parameters.
"""

import base64
import urllib.request
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from scipy.ndimage import zoom
from scipy.special import logsumexp

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CACHE = HERE / ".cache"
CENTERBIAS_URL = "https://github.com/matthias-k/DeepGaze/releases/download/v1.0.0/centerbias_mit1003.npy"
LONG_SIDE = 1024
PIXEL_PER_DVA = 35.0
GRID_LONG_SIDE = 128
MODEL_IDS = ("deepgaze-iie", "deepgaze-msdb")


def device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_model(model_id: str, dev: torch.device) -> torch.nn.Module:
    import deepgaze_pytorch

    if model_id == "deepgaze-iie":
        model = deepgaze_pytorch.DeepGazeIIE(pretrained=True)
    elif model_id == "deepgaze-msdb":
        model = deepgaze_pytorch.DeepGazeMSDB(pretrained=True)
    else:
        raise ValueError(f"Unknown model {model_id}")
    return model.to(dev).eval()


def centerbias_template() -> np.ndarray:
    path = CACHE / "centerbias_mit1003.npy"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(CENTERBIAS_URL, path)
    return np.load(path)


def prepare(image: Image.Image) -> np.ndarray:
    """RGB uint8 array at MIT1003's scale."""
    image = image.convert("RGB")
    scale = LONG_SIDE / max(image.size)
    size = (round(image.width * scale), round(image.height * scale))
    return np.asarray(image.resize(size, Image.LANCZOS))


@torch.no_grad()
def predict(model_id: str, model: torch.nn.Module, rgb: np.ndarray, template: np.ndarray, dev: torch.device) -> np.ndarray:
    """Log density over the prepared image, as DeepGaze's README computes it."""
    h, w = rgb.shape[:2]
    centerbias = zoom(template, (h / template.shape[0], w / template.shape[1]), order=0, mode="nearest")
    centerbias -= logsumexp(centerbias)
    image_tensor = torch.tensor(rgb.transpose(2, 0, 1)[None].copy()).to(dev)
    centerbias_tensor = torch.tensor(centerbias[None].copy()).to(dev)
    if model_id == "deepgaze-msdb":
        from deepgaze_pytorch import MSDBDataset

        out = model(image_tensor, centerbias_tensor, pixel_per_dva=PIXEL_PER_DVA, dataset=MSDBDataset.MIT1003)
    else:
        out = model(image_tensor, centerbias_tensor)
    # IIE returns [1, 1, H, W] and MSDB [1, H, W]; keep the last two axes.
    return out.reshape(-1, *out.shape[-2:])[0].float().cpu().numpy()


def grid_for(width: int, height: int) -> tuple[int, int]:
    """(width, height) of the shared grid; matches gridFor() in src/maps/saliency-map.ts."""
    half_up = lambda x: int(np.floor(x + 0.5))
    if width >= height:
        return GRID_LONG_SIDE, max(1, half_up(GRID_LONG_SIDE * height / width))
    return max(1, half_up(GRID_LONG_SIDE * width / height)), GRID_LONG_SIDE


def to_grid(log_density: np.ndarray, gw: int, gh: int) -> np.ndarray:
    """Probability map on the grid: bilinear with cell centres aligned, normalised (as resample() in the app)."""
    p = np.exp(log_density.astype(np.float64) - log_density.max())
    sh, sw = p.shape
    fy = np.clip((np.arange(gh) + 0.5) * sh / gh - 0.5, 0, sh - 1)
    fx = np.clip((np.arange(gw) + 0.5) * sw / gw - 0.5, 0, sw - 1)
    y0 = np.floor(fy).astype(int); y1 = np.minimum(y0 + 1, sh - 1); wy = (fy - y0)[:, None]
    x0 = np.floor(fx).astype(int); x1 = np.minimum(x0 + 1, sw - 1); wx = (fx - x0)[None, :]
    top = p[np.ix_(y0, x0)] * (1 - wx) + p[np.ix_(y0, x1)] * wx
    bottom = p[np.ix_(y1, x0)] * (1 - wx) + p[np.ix_(y1, x1)] * wx
    out = top * (1 - wy) + bottom * wy
    return out / out.sum()


def encode(probability: np.ndarray) -> str:
    """Little-endian uint16 scaled to the maximum, in base64."""
    scaled = np.round(probability / probability.max() * 65535).astype("<u2")
    return base64.b64encode(scaled.tobytes()).decode("ascii")


def decode(data: str, gw: int, gh: int) -> np.ndarray:
    values = np.frombuffer(base64.b64decode(data), dtype="<u2").astype(np.float64).reshape(gh, gw)
    return values / values.sum()


def payload(model_id: str, photo_id: str | None, gw: int, gh: int, probability: np.ndarray) -> dict:
    return {
        "model": model_id,
        "photo": photo_id,
        "grid": {"width": gw, "height": gh},
        "encoding": "uint16-base64",
        "data": encode(probability),
    }
