"""Retrieval on the authors' held-out 200 pairs (prompt 045): plain CLIP
ViT-L/14 against the reproduction, Recall@1/5/10 in both directions, on the
full test pool and with duplicate images removed. Writes retrieval.json.

The paper's Recall@5 ("over 70%") was measured on its own test split of the
15,000 pairs, so these figures cannot be compared with it directly: a smaller
pool makes retrieval easier, and the reproduction saw one fifteenth of the
training data.
"""

import json
import sys
import time

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from split import HERE, IMAGES, image_hash, split

BASE = ("openai/clip-vit-large-patch14", "32bd64288804d66eefd0ccbe215aa642df71cc41")
CHECKPOINT = HERE / ".cache" / "checkpoint"
OUT = HERE / "retrieval.json"
KS = (1, 5, 10)


def projected(output) -> torch.Tensor:
    """The projected embedding: transformers 5 returns an output object whose pooler_output holds it."""
    return output if torch.is_tensor(output) else output.pooler_output


@torch.no_grad()
def embed(model, processor, names: list[str], texts: list[str], dev) -> tuple[np.ndarray, np.ndarray]:
    img, txt = [], []
    for start in range(0, len(names), 16):
        images = [Image.open(IMAGES / n).convert("RGB") for n in names[start:start + 16]]
        pixel = processor(images=images, return_tensors="pt")["pixel_values"].to(dev)
        img.append(torch.nn.functional.normalize(projected(model.get_image_features(pixel_values=pixel)), dim=-1).cpu())
        tokens = processor(text=texts[start:start + 16], return_tensors="pt", padding="max_length", truncation=True).to(dev)
        txt.append(torch.nn.functional.normalize(projected(model.get_text_features(**tokens)), dim=-1).cpu())
    return torch.cat(img).numpy(), torch.cat(txt).numpy()


def recall(sim: np.ndarray) -> dict[str, float]:
    """Row i's correct column is i."""
    ranks = (sim > sim[np.arange(len(sim)), np.arange(len(sim))][:, None]).sum(1)
    return {f"R@{k}": float((ranks < k).mean()) for k in KS}


def main() -> int:
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train, test = split()
    train_hashes = {image_hash(n) for n in train["filename"]}
    seen, keep = set(), []
    for name in test["filename"]:
        h = image_hash(name)
        keep.append(h not in train_hashes and h not in seen)
        seen.add(h)
    keep = np.array(keep)

    models = {"plain CLIP ViT-L/14": (BASE[0], BASE[1]), "UP-CLIP reproduction (1k pairs)": (str(CHECKPOINT), None)}
    result = {"date": time.strftime("%Y-%m-%d"), "testPool": int(len(test)), "dedupedPool": int(keep.sum()),
              "dedupeRule": "drop test pairs whose image also occurs in the training part, and later copies within the test part",
              "models": {}}
    processor = CLIPProcessor.from_pretrained(BASE[0], revision=BASE[1])
    lengths = [len(ids) for ids in processor.tokenizer(test["text"].tolist())["input_ids"]]
    result["captionsTruncatedAt77Tokens"] = int(sum(n > 77 for n in lengths))
    for label, (repo, rev) in models.items():
        model = CLIPModel.from_pretrained(repo, revision=rev).to(dev).eval()
        img, txt = embed(model, processor, test["filename"].tolist(), test["text"].tolist(), dev)
        sim = img @ txt.T
        entry = {}
        for pool, sel in (("full", np.ones(len(test), bool)), ("deduplicated", keep)):
            s = sim[np.ix_(sel, sel)]
            entry[pool] = {"imageToText": recall(s), "textToImage": recall(s.T)}
        result["models"][label] = {"source": f"{repo}@{rev}" if rev else "tools/up-clip/.cache/checkpoint (not published)", **entry}
        del model
        torch.cuda.empty_cache()
        for pool in ("full", "deduplicated"):
            i2t, t2i = entry[pool]["imageToText"], entry[pool]["textToImage"]
            print(f"{label:34} {pool:12} image→text " + " ".join(f"{k} {v:.3f}" for k, v in i2t.items())
                  + "   text→image " + " ".join(f"{k} {v:.3f}" for k, v in t2i.items()))
    datacheck = HERE / ".cache" / "datacheck.json"
    if datacheck.exists():
        result["dataCheck"] = json.loads(datacheck.read_text())
    training = HERE / ".cache" / "training.json"
    if training.exists():
        result["training"] = json.loads(training.read_text())
    OUT.write_text(json.dumps(result, indent=1))
    print(f"{result['captionsTruncatedAt77Tokens']} of {len(test)} test captions are longer than CLIP's 77 tokens and are cut off")
    print(f"wrote {OUT.relative_to(HERE)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
