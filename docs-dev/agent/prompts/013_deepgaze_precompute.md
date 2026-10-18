# Task: Pre-compute DeepGaze IIE and MSDB maps on the local GPU

## Goal

Add a `uv` tool that runs DeepGaze IIE and DeepGaze MSDB on the owner's laptop
GPU and writes compact pre-computed maps for the example photos.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- DeepGaze: <https://github.com/matthias-k/DeepGaze>. **The repository has no
  licence file.** Install it from GitHub at a pinned commit when the tool runs.
  Never copy its code or weights into this repository; only the resulting maps
  are published.
- DeepGaze IIE (Linardos et al., ICCV 2021): MIT300 CC 0.8242, AUC 0.8829.
  DeepGaze MSDB (Kümmerer, Khanuja & Bethge, ICCV 2025): CC 0.8832, AUC
  0.8942. Source: <https://saliency.tuebingen.ai/results.html>, retrieved
  2026-10-18.
- Weights download once to the local caches: DeepGaze heads from GitHub
  releases, CLIP RN50x64 from OpenAI, DINOv2 ViT-B/14 through torch hub. No
  Hugging Face hosting is used.
- Machine: Ubuntu 26.04, RTX 4070 Laptop (8 GB), `uv`.

## Required changes

1. Create `tools/deepgaze-local/` as a `uv` project with CUDA torch,
   `deepgaze_pytorch` (git, pinned commit), `clip` (git, pinned), numpy,
   scipy and pillow. Pin the Python version.
2. Add `common.py` with the shared steps:
   - load both models on CUDA (CPU fallback);
   - use the MIT1003 centre-bias template from DeepGaze's v1.0.0 release,
     cached, not committed;
   - resize each photo to 1024 px on the long side, MIT1003's scale;
   - MSDB uses `pixel_per_dva = 35` and the MIT1003 dataset slot, the
     settings behind the quoted benchmark;
   - turn each log density into a probability map on the shared 128-cell grid
     (bilinear, cell centres aligned, as `src/maps/saliency-map.ts` does).
3. Add `precompute.py`, which writes
   `public/precomputed/<model-id>/<photo-id>.json` for every photo in
   `public/examples/examples.json`. Each file holds:
   - `{ model, photo, grid: {width, height}, encoding: "uint16-base64",
     data }`;
   - `data` is the map scaled to max 65535, stored as little-endian uint16 in
     base64.

   Model ids: `deepgaze-iie`, `deepgaze-msdb`.
4. Print a table: per photo, the run time per model, and the correlation
   between IIE and MSDB and between each of them and the UNISAL reference
   where one exists.
5. Write `tools/deepgaze-local/README.md`: what it does, the licence position
   (local use; only maps published), the commands, and the settings chosen.

## Do not implement

Do not implement:
- browser integration (014) or the live helper (015);
- any hosting of DeepGaze code or weights;
- fine-tuning or the MSDB adaptation to new datasets.

## Acceptance criteria

The task is complete when:
- `uv run precompute.py` writes 24 maps (12 photos × 2 models);
- each decoded map is valid (non-negative, sums to 1 after normalising);
- the maps total under 1 MB;
- `npm run check` passes.

## Checks

`cd tools/deepgaze-local && uv run precompute.py`; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
