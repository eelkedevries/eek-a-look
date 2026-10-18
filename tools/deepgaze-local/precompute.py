"""Pre-compute DeepGaze IIE and MSDB maps for every example photo.

Writes public/precomputed/<model-id>/<photo-id>.json. Models run one after
the other so both fit in 8 GB of GPU memory.
"""

import gc
import json
import sys
import time

import numpy as np
import torch
from PIL import Image

from common import MODEL_IDS, REPO, centerbias_template, decode, device, grid_for, load_model, payload, predict, prepare, to_grid

EXAMPLES = REPO / "public" / "examples"
OUT = REPO / "public" / "precomputed"
UNISAL_REFERENCE = REPO / "tools" / "unisal-export" / "reference"


def main() -> int:
    dev = device()
    print(f"Device: {dev} ({torch.cuda.get_device_name(0) if dev.type == 'cuda' else 'CPU'})")
    photos = json.loads((EXAMPLES / "examples.json").read_text())
    template = centerbias_template()
    timings: dict[str, dict[str, float]] = {}

    for model_id in MODEL_IDS:
        started = time.perf_counter()
        model = load_model(model_id, dev)
        print(f"Loaded {model_id} in {time.perf_counter() - started:.1f} s")
        (OUT / model_id).mkdir(parents=True, exist_ok=True)
        for photo in photos:
            rgb = prepare(Image.open(EXAMPLES / photo["file"]))
            t0 = time.perf_counter()
            log_density = predict(model_id, model, rgb, template, dev)
            if dev.type == "cuda":
                torch.cuda.synchronize()
            timings.setdefault(photo["id"], {})[model_id] = time.perf_counter() - t0
            gw, gh = grid_for(photo["width"], photo["height"])
            data = payload(model_id, photo["id"], gw, gh, to_grid(log_density, gw, gh))
            (OUT / model_id / f"{photo['id']}.json").write_text(json.dumps(data))
        if dev.type == "cuda":
            print(f"  peak GPU memory: {torch.cuda.max_memory_allocated() / 1e9:.1f} GB")
            torch.cuda.reset_peak_memory_stats()
        del model
        gc.collect()
        torch.cuda.empty_cache()

    def load(model_id: str, photo_id: str) -> np.ndarray:
        d = json.loads((OUT / model_id / f"{photo_id}.json").read_text())
        return decode(d["data"], d["grid"]["width"], d["grid"]["height"])

    def r(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.corrcoef(a.ravel(), b.ravel())[0, 1])

    print(f"\n{'photo':42} {'IIE s':>6} {'MSDB s':>7}  r(IIE,MSDB)  r(MSDB,UNISAL)")
    ok = True
    for photo in photos:
        iie, msdb = load("deepgaze-iie", photo["id"]), load("deepgaze-msdb", photo["id"])
        ok &= all(np.isfinite(m).all() and m.min() >= 0 and abs(m.sum() - 1) < 1e-9 for m in (iie, msdb))
        ref = UNISAL_REFERENCE / f"{photo['id']}.json"
        vs_unisal = ""
        if ref.exists():
            u = json.loads(ref.read_text())
            vs_unisal = f"{r(msdb, np.array(u['data']).reshape(u['grid']['height'], u['grid']['width'])):.3f}"
        t = timings[photo["id"]]
        print(f"{photo['id']:42} {t['deepgaze-iie']:6.2f} {t['deepgaze-msdb']:7.2f}  {r(iie, msdb):11.3f}  {vs_unisal:>14}")

    size = sum(f.stat().st_size for f in OUT.rglob("*.json"))
    print(f"\nWrote {len(list(OUT.rglob('*.json')))} maps, {size / 1e6:.2f} MB in total.")
    ok &= size < 1e6
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
