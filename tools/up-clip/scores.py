"""UP-CLIP scores for the eek-a-look example photos (prompt 046).

For plain CLIP ViT-L/14 and the UP-CLIP reproduction (prompt 045): the cosine
similarity of every example photo with every description in descriptions.json,
in both directions, and a principle score per photo (mean similarity with the
positive sentences minus mean similarity with the negative ones).

CLIP gives one embedding per image, so these scores have no location. The
photo embedding is the mean of three square crops across the photo's width
(left, centre, right), so the sides are not cut off by CLIP's centre crop;
this is an adaptation of the authors' pipeline, which uses the centre crop.

  uv run scores.py    writes public/precomputed/up-clip/scores.json
"""

import json
import sys
import time

import numpy as np
import torch
from PIL import Image
from scipy import stats
from transformers import CLIPModel, CLIPProcessor

from evaluate import BASE, CHECKPOINT, projected
from split import HERE

REPO = HERE.parents[1]
EXAMPLES = REPO / "public" / "examples"
OUT = REPO / "public" / "precomputed" / "up-clip" / "scores.json"
QUALITIES = REPO / "public" / "precomputed" / "qualities"
GRADED = REPO / "public" / "precomputed" / "vlm-panel" / "panel-graded.json"
PRINCIPLES = ("rhythm", "groundFloor", "materials")
MAIN = {"groundFloor": "openShare", "rhythm": "rhythmicShare", "materials": "texturedShare"}
MODELS = [
    {"id": "up-clip-reproduction", "name": "UP-CLIP reproduction (1k pairs)", "path": str(CHECKPOINT), "revision": None},
    {"id": "clip", "name": "Plain CLIP ViT-L/14", "path": BASE[0], "revision": BASE[1]},
]


def crops(image: Image.Image) -> list[Image.Image]:
    """Three squares across the long side: start, middle, end."""
    w, h = image.size
    side = min(w, h)
    if w >= h:
        return [image.crop((x, 0, x + side, side)) for x in (0, (w - side) // 2, w - side)]
    return [image.crop((0, y, side, y + side)) for y in (0, (h - side) // 2, h - side)]


@torch.no_grad()
def embeddings(model, processor, photos: list[dict], texts: list[str], dev) -> tuple[np.ndarray, np.ndarray]:
    img = []
    for photo in photos:
        pixel = processor(images=crops(Image.open(EXAMPLES / photo["file"]).convert("RGB")), return_tensors="pt")["pixel_values"].to(dev)
        e = torch.nn.functional.normalize(projected(model.get_image_features(pixel_values=pixel)), dim=-1).mean(0)
        img.append(torch.nn.functional.normalize(e, dim=-1).cpu())
    tokens = processor(text=texts, return_tensors="pt", padding=True, truncation=True).to(dev)
    txt = torch.nn.functional.normalize(projected(model.get_text_features(**tokens)), dim=-1).cpu()
    return torch.stack(img).numpy(), txt.numpy()


def main() -> int:
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    photos = json.loads((EXAMPLES / "examples.json").read_text())
    descriptions = json.loads((HERE / "descriptions.json").read_text())["descriptions"]
    texts = [d["text"] for d in descriptions]
    retrieval = json.loads((HERE / "retrieval.json").read_text())
    processor = CLIPProcessor.from_pretrained(BASE[0], revision=BASE[1])

    similarity, principle_scores, models_out = {}, {}, []
    for spec in MODELS:
        model = CLIPModel.from_pretrained(spec["path"], revision=spec["revision"]).to(dev).eval()
        img, txt = embeddings(model, processor, photos, texts, dev)
        sim = img @ txt.T
        similarity[spec["id"]] = [[round(float(v), 4) for v in row] for row in sim]
        scores = {}
        for i, photo in enumerate(photos):
            scores[photo["id"]] = {}
            for p in PRINCIPLES:
                pos = [k for k, d in enumerate(descriptions) if d.get("principle") == p and d["polarity"] == "positive"]
                neg = [k for k, d in enumerate(descriptions) if d.get("principle") == p and d["polarity"] == "negative"]
                scores[photo["id"]][p] = round(float(sim[i, pos].mean() - sim[i, neg].mean()), 4)
        principle_scores[spec["id"]] = scores
        label = next(k for k in retrieval["models"] if ("UP-CLIP" in k) == (spec["id"] == "up-clip-reproduction"))
        models_out.append({"id": spec["id"], "name": spec["name"],
                           "source": f"{spec['path']}@{spec['revision']}" if spec["revision"] else "tools/up-clip/.cache/checkpoint (not published)",
                           "retrieval": retrieval["models"][label]})
        del model
        torch.cuda.empty_cache()

    graded = json.loads(GRADED.read_text())["photos"] if GRADED.exists() else {}
    correlations = {}
    for spec in MODELS:
        correlations[spec["id"]] = {}
        for p in PRINCIPLES:
            # Only the photos with image measures (the 24 Dutch and Zürich photos) take part.
            ours = [(principle_scores[spec["id"]][ph["id"]][p],
                     json.loads((QUALITIES / f"{ph['id']}.json").read_text())["principles"][p]["indicators"].get(MAIN[p]))
                    for ph in photos if (QUALITIES / f"{ph['id']}.json").exists()]
            ours = [(a, b) for a, b in ours if b is not None]
            panel = [(principle_scores[spec["id"]][ph["id"]][p], graded[ph["id"]][p]["median"])
                     for ph in photos if ph["id"] in graded and graded[ph["id"]][p]["median"] is not None]
            rho = lambda pairs: (None if len(pairs) < 3 else (lambda r: None if not np.isfinite(r) else round(float(r), 3))(stats.spearmanr(*zip(*pairs)).statistic))
            correlations[spec["id"]][p] = {"imageMeasure": {"indicator": MAIN[p], "rho": rho(ours), "photos": len(ours)},
                                           "gradedPanel": {"rho": rho(panel), "photos": len(panel)}}

    result = {
        "date": time.strftime("%Y-%m-%d"),
        "note": "Cosine similarities: comparable between descriptions within one model only, not probabilities. No location in the photo.",
        "imageEmbedding": "mean of three square crops across the photo's width (left, centre, right); an adaptation",
        "principleScore": "mean similarity with the two positive sentences minus mean similarity with the two negative ones",
        "models": models_out,
        "retrievalTest": {k: retrieval[k] for k in ("testPool", "dedupedPool", "dedupeRule", "captionsTruncatedAt77Tokens", "training", "dataCheck")
                          if k in retrieval},
        "descriptions": descriptions,
        "photos": [p["id"] for p in photos],
        "similarity": similarity,
        "principleScores": principle_scores,
        "correlations": {"label": "exploratory: automated methods against each other, not a validation", **correlations},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    print(f"Wrote {OUT.relative_to(REPO)} ({OUT.stat().st_size / 1e3:.0f} kB)")

    for spec in MODELS:
        sim = np.array(similarity[spec["id"]])
        print(f"\n{spec['name']}")
        for pid in ("zuidas-gershwinplein", "weena-stationsplein", "zurich-24"):
            i = result["photos"].index(pid)
            top = np.argsort(-sim[i])[:3]
            print(f"  {pid}: " + "; ".join(f"{texts[k]} ({sim[i, k]:.3f})" for k in top))
        for did in ("feels-walkable", "ground-pos-1", "materials-pos-1"):
            k = next(j for j, d in enumerate(descriptions) if d["id"] == did)
            top = np.argsort(-sim[:, k])[:3]
            print(f"  “{texts[k]}”: " + ", ".join(f"{result['photos'][i]} ({sim[i, k]:.3f})" for i in top))
        print("  correlations: " + "; ".join(f"{p}: measure {v['imageMeasure']['rho']}, graded panel {v['gradedPanel']['rho']}"
                                             for p, v in correlations[spec["id"]].items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
