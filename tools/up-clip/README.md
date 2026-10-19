# up-clip

A **reproduction** of UP-CLIP, made from the authors' own training script and
their public 1,000-pair sample, and its scores for the eek-a-look example
photos. It is not the published model: that model's weights have not been
released.

## What UP-CLIP is

Huang, G., Song, X. & Jiao, H. (2026). From pixels to perception: fine-tuning
vision-language models for semantic urban perception. *International Journal
of Digital Earth* 19(1), 2677402.
doi:[10.1080/17538947.2026.2677402](https://doi.org/10.1080/17538947.2026.2677402)
(CC BY 4.0).

The authors fine-tuned CLIP on 15,000 street-view image–text pairs from Wuhan,
built with a "lexicon-guided, human-AI collaborative" annotation, so that a
photo and a description of how a street feels end up close together. They
report Recall@5 above 70% in both directions (photo → description and
description → photo) on their test split. Their evaluation is retrieval of
perception descriptions; it says nothing about the three design principles of
Spanjar & Suurenbroek (2020), and CLIP does not locate anything in a photo.

## What is available (checked 2026-10-19)

Repository <https://github.com/19883120121i-afk/UP-CLIP> at commit
`ef1bb18` (2025-11-30):
- `train.py`: Hugging Face `Trainer`, full fine-tuning with CLIP's
  contrastive loss; learning rate 5e-6, cosine schedule, 200 warm-up steps,
  fp16, gradient accumulation 4, weight decay 0.01, early stopping on the
  validation loss, a random 80/20 split with seed 42;
- 1,000 sample pairs from Wuhan (`data/dataset-1k.csv`, `data/image/`);
- no trained checkpoint, no release, nothing on Hugging Face;
- no licence file (the README says MIT; GitHub reports none);
- the full 15,000 pairs on request by e-mail.

Details and sources: `docs-dev/reference/secondary_background/qualities_sources.md`.

## The reproduction (prompt 045)

- **Data check** (`datacheck.py`): 985 distinct images among the 1,000 pairs;
  15 images appear twice under different file names, 3 of them on both sides
  of the authors' 80/20 split (leakage, reported).
- **Training:** the authors' arguments (`openai/clip-vit-large-patch14`,
  batch 32, 50 epochs). Unchanged, it ran out of memory on the 8 GB GPU; with
  gradient checkpointing and 8-bit AdamW (`train_8gb.diff`) it fits at batch
  32 (peak 6.45 GB, 39 minutes). Early stopping did not trigger: the script
  adds the validation loss after the callback has looked for it, so all 50
  epochs ran and the best checkpoint by validation loss (epoch 8) was kept.
- **Retrieval** on the 200 held-out pairs (`retrieval.json`), Recall@5:
  plain CLIP 0.19 (photo → caption) and 0.16 (caption → photo); the
  reproduction 0.40 and 0.34. Not comparable with the paper's "over 70%",
  which used a larger pool and fifteen times the data.

Report and a draft note to the authors:
`docs-dev/reference/secondary_background/upclip_reproduction.md`.

Exact training command:

```sh
uv run patch.py
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True uv run python .cache/train_8gb.py \
  --model_name_or_path openai/clip-vit-large-patch14 \
  --csv_file .cache/repo/data/dataset-1k.csv --image_dir .cache/repo/data/image \
  --output_dir .cache/checkpoint --batch_size 32 --epochs 50 \
  --gradient_checkpointing --optim adamw_bnb_8bit
```

`evaluate.py` reads the training details from `.cache/training.json`, written
by hand from the training log (batch, epochs, time, peak memory).

## Scores for the example photos (prompt 046)

`scores.py` scores every example photo (34 after the Guangzhou panoramas were
removed on 2026-10-19) against the 28
sentences of `descriptions.json`, written for this project:
- **perception** (supported use): "A street that feels {word}." for the 16
  keywords of the authors' sample (Neat, Efficient, Walkable, Lively, …);
- **principle** (adaptation): two positive and two negative sentences per
  design principle, following the specification's operational definitions.

A photo's embedding is the mean of three square crops across its width, so
CLIP's centre crop does not cut off the sides (an adaptation). Scores are
cosine similarities: compare descriptions within one model only; they are not
probabilities and have no location in the photo. The principle score is the
mean similarity with the positive sentences minus the mean with the negative
ones.

Exploratory, automated against automated (Spearman ρ, reproduction / plain
CLIP; recomputed on 2026-10-19 over the 34 photos with image measures, 31 for
the ground floor, and the 24 photos the graded panel judged):

| Principle score against | Rhythm | Ground floor | Materials |
|---|---|---|---|
| the image measure's main indicator | 0.03 / −0.04 | 0.42 / 0.41 | 0.15 / 0.12 |
| the graded panel's median | 0.45 / 0.36 | 0.65 / 0.56 | 0.03 / 0.09 |

Only the ground floor shows some agreement between methods. None of this is a
check against experts.

## Commands

```sh
cd tools/up-clip
uv run fetch.py        # the authors' repository at the pinned commit, into .cache/repo/
uv run datacheck.py    # duplicate images and leakage across the authors' split
uv run patch.py        # .cache/train_8gb.py from their train.py (changes in train_8gb.diff)
uv run python .cache/train_8gb.py …   # see "Training" below for the exact arguments
uv run evaluate.py     # retrieval.json: plain CLIP against the reproduction
uv run scores.py       # public/precomputed/up-clip/scores.json (prompt 046)
```

Nothing from the authors' repository (code, images, captions) and no weights
are committed: the repository has no licence file, the README cites
"copyright restrictions" for the data, and the base model's card rules out
deployed use. Only the patch, the scripts, the retrieval figures and the
scores for the eek-a-look photos are in git.
