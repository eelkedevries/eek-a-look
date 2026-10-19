# Task: Reproduce UP-CLIP from the authors' public sample

## Goal

Re-train UP-CLIP with the authors' own script on their public 1,000-pair
sample, measure its retrieval against plain CLIP, and record exactly how this
reproduction differs from the published model.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Huang, Song & Jiao (2026), *International Journal of Digital Earth* 19(1),
  2677402: CLIP fine-tuned on 15,000 street-view image–text pairs; Recall@5
  over 70% in both retrieval directions.
- The repository <https://github.com/19883120121i-afk/UP-CLIP> has
  `train.py`, a README and a 1k sample from Wuhan, but **no checkpoint** and
  no licence file; the full data is on request. Details and the supported
  and adapted uses: `docs-dev/reference/secondary_background/qualities_sources.md`.
- Base model, from the README's example: `openai/clip-vit-large-patch14`. Its
  model card puts deployed use out of scope; the weights stay on the laptop.
- The RTX 4070 has 8 GB.

## Required changes

1. Create `tools/up-clip/` as a `uv` project (Python 3.12, `torch`,
   `transformers` ≥ 5.20 locked, `datasets`, `pandas`, `pillow`, `accelerate`,
   `bitsandbytes`). `.cache/` and `.venv/` are ignored by git.
2. `fetch.py`: download the repository at a pinned commit (the archive of
   that commit) into `.cache/repo/`, check its SHA-256, and never commit it,
   its sample images or its captions.
3. **Data check** before training: hash every sample image and report exact
   duplicates (the same picture under two file names) and how many of them
   fall on both sides of the script's own 80/20 split (seed 42). This is
   leakage and is reported, not hidden.
4. **Training:** run the authors' `train.py` with the README's arguments
   (`--model_name_or_path openai/clip-vit-large-patch14`, batch 32, 50 epochs,
   their defaults otherwise). Change it only where it cannot run here, as a
   copy `train_8gb.py` with a saved diff `train_8gb.diff`; candidates are the
   `compute_loss` signature of current `transformers`, and, if batch 32 does
   not fit in 8 GB, gradient checkpointing and an 8-bit AdamW before any
   smaller batch. Record every change, the batch size actually used, the
   epochs run, the time and the peak GPU memory. The checkpoint goes to
   `.cache/checkpoint/`.
5. `evaluate.py`: Recall@1, @5 and @10 for image → text and text → image on
   the script's held-out 200 pairs, for plain CLIP ViT-L/14 and for the
   reproduction; and again with exact duplicate images removed from the test
   pool. Write `tools/up-clip/retrieval.json`.
6. `tools/up-clip/README.md` and the report
   `docs-dev/reference/secondary_background/upclip_reproduction.md`: what is
   and is not available from the authors, what this reproduction is (one
   fifteenth of the data, a different test pool, any changes to the script),
   the results, and why they cannot be compared with the paper's Recall@5.
   Include a short draft e-mail to the authors asking for the checkpoint, for
   the owner to send if they wish.

## Do not implement

Do not implement:
- scores for the eek-a-look photos (046) or page changes (048);
- training on other data, prompt engineering, or hyperparameter searches;
- publishing weights, sample images or captions.

## Acceptance criteria

The task is complete when:
- the training run finishes or stops early on validation loss, with the
  changes, batch size, time and peak GPU memory recorded;
- `retrieval.json` holds Recall@1/5/10 in both directions for both models,
  with and without duplicates;
- the final report quotes these figures, the duplicate and leakage counts,
  and says plainly that this is a reproduction on 1k pairs, not the published
  model;
- nothing from the authors' repository and no weights are in git, and
  `npm run check` passes.

## Checks

`cd tools/up-clip && uv run fetch.py && uv run train_8gb.py … && uv run evaluate.py`;
`npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
