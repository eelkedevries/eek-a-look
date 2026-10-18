# Task: Export UNISAL to ONNX

## Goal

Convert the pretrained UNISAL model to a verified ONNX fp16 file that the
browser can run, using a reproducible `uv` script.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- UNISAL: <https://github.com/rdroste/unisal> (Apache-2.0). Its pretrained
  weights live in the repository under `training_runs/pretrained_unisal`. Its
  demo covers the SALICON and MIT1003 image datasets.
- `specification.md`, *Domain rules* (UNISAL): static-image path, MIT1003
  domain if available, otherwise SALICON; verification thresholds.
- Pitfalls of an earlier conversion (strided slicing, Gaussian prior maps,
  replicate padding) are described in
  <https://huggingface.co/litert-community/UniSal-Saliency-LiteRT>.
- Machine: Ubuntu 26.04 with `uv`. A CPU export is enough. An RTX 4070 is
  available if useful.

## Required changes

1. Create `tools/unisal-export/` as a `uv` project: `pyproject.toml`,
   `uv.lock`, `export.py` and `README.md`. Pin the Python version that UNISAL
   supports. Dependencies: torch, onnx, onnxruntime, onnxconverter-common,
   numpy, pillow.
2. `export.py` clones `rdroste/unisal` at a pinned commit into
   `tools/unisal-export/.cache/` (git-ignored) and loads the pretrained model.
   Use the static-image path and the MIT1003 domain if the code provides it,
   otherwise SALICON. Print the choice.
3. Wrap the model:
   - input `image`: float32 [1, 3, H, W], ImageNet mean/std normalised;
   - output `saliency`: float32 [1, 1, H, W].
   Use the input size UNISAL uses for the chosen domain if it is landscape;
   otherwise use 288 × 384 (H × W). No square centre crop. Record whether the
   output is a log density or linear.
4. Export ONNX (opset 17, static shapes), then convert to fp16 weights with
   float32 inputs and outputs (`keep_io_types=True`).
5. Verify on at least five photos from `public/examples/`. Compute Pearson r
   between PyTorch and ONNX Runtime, for fp32 and fp16. Thresholds: ≥ 0.999
   (fp32) and ≥ 0.99 (fp16). Print a table; exit non-zero below the thresholds.
6. Write outputs:
   - `public/models/unisal/unisal-<domain>-fp16.onnx` (at most 10 MB);
   - `public/models/unisal/model.json`: input size, mean/std, output semantics,
     domain, source commit, licence;
   - `public/models/unisal/LICENSE` (the Apache-2.0 text from the UNISAL
     repository);
   - `public/models/unisal/NOTICE`: attribution and "Converted to ONNX fp16 by
     eek-a-look; no retraining";
   - `tools/unisal-export/reference/<example-id>.json`: the normalised fp16
     output for one example on the shared 128 grid, for prompt 009 to check
     against.
7. In `tools/unisal-export/README.md`, give the exact reproduce command
   (`uv run export.py`).

## Do not implement

Do not implement:
- browser inference (009);
- retraining or fine-tuning;
- committing PyTorch weights or the cloned repository.

If the export or verification still fails after reasonable attempts, **stop**.
Do not commit a model. Report what failed and propose `008b`, using the
community LiteRT conversion with LiteRT.js (see `docs-dev/plan.md`, *Risks*).

## Acceptance criteria

The task is complete when:
- `uv run export.py` reproduces the files from a clean checkout;
- the verification table meets both thresholds and is included in the report;
- the ONNX file is at most 10 MB;
- `npm run check` passes.

## Checks

`cd tools/unisal-export && uv run export.py`; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
