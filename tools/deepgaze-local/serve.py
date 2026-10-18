"""Local GPU helper: runs DeepGaze IIE and MSDB live for eek-a-look on this laptop.

Started by `npm run local`, which also serves the site and forwards
/eek-a-look/local-api/ here, so the browser only talks to its own origin.
Listens on 127.0.0.1 only.
"""

import io
import threading
import time

import torch
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from PIL import Image

from common import MODEL_IDS, centerbias_template, device, load_model, payload, predict, prepare, to_grid

HOST, PORT = "127.0.0.1", 8765

dev = device()
template = centerbias_template()
started = time.perf_counter()
models = {model_id: load_model(model_id, dev) for model_id in MODEL_IDS}
print(f"Loaded {', '.join(models)} on {dev} in {time.perf_counter() - started:.0f} s", flush=True)

# One GPU: run one prediction at a time.
gpu = threading.Lock()
app = FastAPI(title="eek-a-look DeepGaze helper")


@app.get("/health")
def health() -> dict:
    name = torch.cuda.get_device_name(0) if dev.type == "cuda" else "CPU"
    return {"device": name, "models": list(models)}


@app.post("/predict")
async def predict_map(
    request: Request,
    model: str = Query(...),
    grid_width: int = Query(..., alias="gridWidth", ge=1, le=512),
    grid_height: int = Query(..., alias="gridHeight", ge=1, le=512),
) -> dict:
    if model not in models:
        raise HTTPException(404, f"Unknown model {model}")
    body = await request.body()
    if len(body) > 25 * 1024 * 1024:
        raise HTTPException(413, "Image larger than 25 MB")
    try:
        rgb = prepare(Image.open(io.BytesIO(body)))
    except Exception as error:
        raise HTTPException(400, f"Not a readable image: {error}") from error
    with gpu:
        log_density = predict(model, models[model], rgb, template, dev)
    return payload(model, None, grid_width, grid_height, to_grid(log_density, grid_width, grid_height))


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")
