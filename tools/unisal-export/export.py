"""Export UNISAL (MIT1003 fine-tuned weights) to ONNX fp16 for the browser, and verify it.

UNISAL: Droste, Jiao & Noble (2020), "Unified Image and Video Saliency
Modeling", ECCV. https://github.com/rdroste/unisal (Apache-2.0).

For MIT1003 and MIT300 the UNISAL code runs its static-image path with the
SALICON domain and the weights fine-tuned on MIT1003 eye-tracking data; this
script does the same. Two changes make the model browser-friendly without
retraining:

- The 16 Gaussian prior maps, which UNISAL builds from learned parameters at
  the size of its coarsest feature map, become a second model input. The
  browser builds them from the same parameters (stored in model.json), so the
  model accepts any input size UNISAL itself would use.
- Weights are stored as fp16; inputs and outputs stay fp32.

The output is UNISAL's own: a log density (log-softmax over all pixels) at the
input size. Verification compares ONNX Runtime with the unmodified PyTorch
forward pass on example photos and fails below the thresholds.
"""

import json
import shutil
import subprocess
import sys
import types
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from onnxconverter_common import float16
from PIL import Image

UNISAL_REPO = "https://github.com/rdroste/unisal.git"
UNISAL_COMMIT = "7f8ca1a7ecb3dbc1bf7fca837cb6186a85ac27d9"
DOMAIN = "SALICON"
WEIGHTS = "weights_ft_mit1003.pth"
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)
PRIOR_SCALING = 6.0
FEATURE_STRIDE = 32
THRESHOLD_FP32 = 0.999
THRESHOLD_FP16 = 0.99
GRID_LONG_SIDE = 128
REFERENCE_ID = "weena-delftse-poort"

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CACHE = HERE / ".cache" / "unisal"
OUT = REPO / "public" / "models" / "unisal"
EXAMPLES = REPO / "public" / "examples"
REFERENCE_DIR = HERE / "reference"
MODEL_FILE = "unisal-mit1003-fp16.onnx"


def fetch_unisal() -> None:
    if not (CACHE / ".git").exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--quiet", UNISAL_REPO, str(CACHE)], check=True)
    subprocess.run(["git", "-C", str(CACHE), "checkout", "--quiet", UNISAL_COMMIT], check=True)


def load_unisal() -> torch.nn.Module:
    # unisal/__init__.py imports the training code and its dependencies; a stub
    # package lets the model module load on its own.
    package = types.ModuleType("unisal")
    package.__path__ = [str(CACHE / "unisal")]
    sys.modules["unisal"] = package
    from unisal.model import UNISAL  # noqa: E402

    run_dir = CACHE / "training_runs" / "pretrained_unisal"
    cfg = json.loads((run_dir / "UNISAL.json").read_text())
    cfg["cnn_cfg"]["pretrained"] = False
    cfg["verbose"] = 0
    model = UNISAL(**cfg)
    model.load_state_dict(torch.load(run_dir / WEIGHTS, map_location="cpu"))
    model.eval()
    model.this_source = DOMAIN
    return model


def input_size(height: int, width: int) -> tuple[int, int]:
    """UNISAL's evaluation size for MIT1003: 32 × (n1, n2), 100 ≤ n1·n2 ≤ 120, closest aspect ratio."""
    aspect = height / width
    best, best_ratio = None, -1.0
    for n1 in range(7, 14):
        for n2 in range(7, 14):
            if 100 <= n1 * n2 <= 120:
                ratio = min(aspect, n1 / n2) / max(aspect, n1 / n2)
                if ratio > best_ratio:
                    best, best_ratio = (n1, n2), ratio
    return best[0] * FEATURE_STRIDE, best[1] * FEATURE_STRIDE


def prior_params(model: torch.nn.Module) -> np.ndarray:
    """Learned Gaussians, shape [16, 2 (y, x), 2 (mu, log std)]."""
    return getattr(model, f"coarse_gaussians_{DOMAIN.lower()}").detach().numpy().astype(np.float64)


def prior_maps(params: np.ndarray, fh: int, fw: int) -> np.ndarray:
    """The prior maps as UNISAL's _make_gaussian_maps builds them, in numpy."""
    ys = np.linspace(0, 1, fh)[:, None]
    xs = np.linspace(0, 1, fw)[None, :]
    maps = []
    for (mu_y, logstd_y), (mu_x, logstd_x) in params:
        gy = np.exp(-(((ys - mu_y) / np.exp(logstd_y)) ** 2) / 2)
        gx = np.exp(-(((xs - mu_x) / np.exp(logstd_x)) ** 2) / 2)
        maps.append(gy * gx * PRIOR_SCALING)
    return np.stack(maps)[None].astype(np.float32)


class WithPriorInput(torch.nn.Module):
    """UNISAL's static forward pass, with the prior maps supplied as an input."""

    def __init__(self, model: torch.nn.Module):
        super().__init__()
        self.model = model
        self._prior = None
        model._get_gaussian_maps = lambda *args, **kwargs: self._prior

    def forward(self, image: torch.Tensor, prior: torch.Tensor) -> torch.Tensor:
        self._prior = prior
        out = self.model(image.unsqueeze(1), source=DOMAIN, static=True)
        return out[:, 0]


def preprocess(path: Path, size: tuple[int, int]) -> np.ndarray:
    image = Image.open(path).convert("RGB").resize((size[1], size[0]), Image.LANCZOS)
    x = np.asarray(image, dtype=np.float32) / 255
    x = (x - np.array(MEAN, dtype=np.float32)) / np.array(STD, dtype=np.float32)
    return x.transpose(2, 0, 1)[None].copy()


def export(model: torch.nn.Module, fp32_path: Path) -> None:
    wrapper = WithPriorInput(model).eval()
    h, w = 288, 416
    image = torch.randn(1, 3, h, w)
    prior = torch.from_numpy(prior_maps(prior_params(model), h // FEATURE_STRIDE, w // FEATURE_STRIDE))
    names = dict(input_names=["image", "prior"], output_names=["log_density"])
    try:
        torch.onnx.export(
            wrapper, (image, prior), str(fp32_path), opset_version=17, dynamo=False,
            dynamic_axes={"image": {2: "height", 3: "width"}, "prior": {2: "fh", 3: "fw"},
                          "log_density": {2: "height", 3: "width"}},
            **names,
        )
        print("Exported with the TorchScript exporter.")
    except Exception as error:  # the legacy exporter may be unavailable in newer torch
        print(f"TorchScript export failed ({error}); trying torch.export.")
        fh = torch.export.Dim("fh", min=7, max=13)
        fw = torch.export.Dim("fw", min=7, max=13)
        shapes = {"image": {2: FEATURE_STRIDE * fh, 3: FEATURE_STRIDE * fw}, "prior": {2: fh, 3: fw}}
        program = torch.onnx.export(wrapper, (image, prior), dynamic_shapes=shapes, opset_version=18, dynamo=True, **names)
        program.save(str(fp32_path))
        print("Exported with torch.export.")
    finally:
        # Restore UNISAL's own prior construction for the reference runs.
        del model._get_gaussian_maps


def pearson(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.corrcoef(a.ravel(), b.ravel())[0, 1])


def to_probability(log_density: np.ndarray) -> np.ndarray:
    p = np.exp(log_density.astype(np.float64) - log_density.max())
    return p / p.sum()


def resample(values: np.ndarray, gh: int, gw: int) -> np.ndarray:
    """Bilinear resampling with cell centres aligned; matches resample() in src/maps/saliency-map.ts."""
    sh, sw = values.shape
    out = np.empty((gh, gw))
    for y in range(gh):
        fy = min(max((y + 0.5) * sh / gh - 0.5, 0), sh - 1)
        y0 = int(np.floor(fy)); y1 = min(y0 + 1, sh - 1); wy = fy - y0
        for x in range(gw):
            fx = min(max((x + 0.5) * sw / gw - 0.5, 0), sw - 1)
            x0 = int(np.floor(fx)); x1 = min(x0 + 1, sw - 1); wx = fx - x0
            top = values[y0, x0] * (1 - wx) + values[y0, x1] * wx
            bottom = values[y1, x0] * (1 - wx) + values[y1, x1] * wx
            out[y, x] = top * (1 - wy) + bottom * wy
    return out / out.sum()


def main() -> int:
    fetch_unisal()
    model = load_unisal()
    params = prior_params(model)

    work = HERE / ".cache" / "build"
    work.mkdir(parents=True, exist_ok=True)
    fp32_path = work / "unisal-fp32.onnx"
    export(model, fp32_path)

    fp16_model = float16.convert_float_to_float16(onnx.load(str(fp32_path)), keep_io_types=True)
    OUT.mkdir(parents=True, exist_ok=True)
    fp16_path = OUT / MODEL_FILE
    onnx.save(fp16_model, str(fp16_path))

    sessions = {name: ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
                for name, path in (("fp32", fp32_path), ("fp16", fp16_path))}

    manifest = json.loads((EXAMPLES / "examples.json").read_text())
    rows, ok = [], True
    for photo in manifest:
        size = input_size(photo["height"], photo["width"])
        x = preprocess(EXAMPLES / photo["file"], size)
        prior = prior_maps(params, size[0] // FEATURE_STRIDE, size[1] // FEATURE_STRIDE)
        with torch.no_grad():
            reference = model(torch.from_numpy(x).unsqueeze(1), source=DOMAIN, static=True)[0, 0, 0].numpy()
        p_ref = to_probability(reference)
        row = {"id": photo["id"], "size": size}
        for name, session in sessions.items():
            out = session.run(["log_density"], {"image": x, "prior": prior})[0][0, 0]
            row[name] = pearson(p_ref, to_probability(out))
            if name == "fp16" and photo["id"] == REFERENCE_ID:
                gh, gw = (GRID_LONG_SIDE, round(GRID_LONG_SIDE * photo["width"] / photo["height"])) \
                    if photo["height"] > photo["width"] else (round(GRID_LONG_SIDE * photo["height"] / photo["width"]), GRID_LONG_SIDE)
                grid = resample(to_probability(out), gh, gw)
                REFERENCE_DIR.mkdir(exist_ok=True)
                (REFERENCE_DIR / f"{REFERENCE_ID}.json").write_text(json.dumps({
                    "id": REFERENCE_ID, "inputSize": size, "grid": {"width": gw, "height": gh},
                    "data": [float(f"{v:.6g}") for v in grid.ravel()],
                }))
        ok &= row["fp32"] >= THRESHOLD_FP32 and row["fp16"] >= THRESHOLD_FP16
        rows.append(row)

    print(f"\n{'photo':44} {'input':>9}  r fp32   r fp16")
    for r in rows:
        print(f"{r['id']:44} {r['size'][0]:>4}×{r['size'][1]:<4}  {r['fp32']:.5f}  {r['fp16']:.5f}")
    print(f"thresholds: fp32 ≥ {THRESHOLD_FP32}, fp16 ≥ {THRESHOLD_FP16}")

    (OUT / "model.json").write_text(json.dumps({
        "name": "UNISAL",
        "file": MODEL_FILE,
        "source": "https://github.com/rdroste/unisal",
        "commit": UNISAL_COMMIT,
        "weights": WEIGHTS,
        "domain": f"{DOMAIN} (static-image path, weights fine-tuned on MIT1003, as UNISAL uses for MIT300)",
        "licence": "Apache-2.0",
        "inputs": {
            "image": "float32 [1, 3, H, W], RGB scaled to 0–1, then (x − mean) / std",
            "prior": "float32 [1, 16, H/32, W/32], Gaussian prior maps built from priorParams",
        },
        "output": "log_density: float32 [1, 1, H, W], log-softmax over all pixels",
        "mean": MEAN,
        "std": STD,
        "sizeRule": "H, W = 32·(n1, n2) with 7 ≤ n ≤ 13 and 100 ≤ n1·n2 ≤ 120, closest in aspect ratio to the photo",
        "featureStride": FEATURE_STRIDE,
        "priorScaling": PRIOR_SCALING,
        "priorParams": [[[round(float(v), 7) for v in axis] for axis in g] for g in params],
        "priorParamsLayout": "[gaussian][y, x][mu, log std], on linspace(0, 1) grids",
    }, indent=1) + "\n")
    shutil.copy(CACHE / "LICENSE", OUT / "LICENSE")
    (OUT / "NOTICE").write_text(
        "UNISAL — Unified Image and Video Saliency Modeling\n"
        "Copyright Richard Droste, Jianbo Jiao and J. Alison Noble.\n"
        "Droste, R., Jiao, J., & Noble, J. A. (2020). Unified Image and Video Saliency Modeling. ECCV.\n"
        f"Source: {UNISAL_REPO} (commit {UNISAL_COMMIT}), licensed under the Apache License 2.0 (see LICENSE).\n\n"
        f"Converted to ONNX fp16 by eek-a-look from {WEIGHTS}; no retraining. The Gaussian prior maps\n"
        "are supplied as a second input, built from the model's own learned parameters (model.json).\n"
    )
    size_mb = fp16_path.stat().st_size / 1e6
    print(f"\nWrote {fp16_path.relative_to(REPO)} ({size_mb:.1f} MB), model.json, LICENSE, NOTICE.")
    if size_mb > 10:
        print("The model is larger than 10 MB.")
        ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
