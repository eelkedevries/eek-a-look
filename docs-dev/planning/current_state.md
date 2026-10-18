# Current state

Living, high-level orientation for the project: what exists now, key
architectural decisions, and what is in progress. Read it at the start of a
session to orient quickly.

Update it only for genuinely useful orientation (a new system, an
architectural decision), not after routine commits. A stale or bloated state
file is worse than none.

This file records what *is* (current reality). The binding design canon is
`docs-dev/reference/primary_authoritative/`; when the two conflict, the canon
wins and the gap is work still to be done.

## Systems

- Page shell (`index.html`, `src/style.css`): site look, self-hosted fonts
  (`@fontsource`, Latin subsets), local-only upload (`src/image-input.ts`),
  app state (`src/state.ts`) and a stage frame for stacked layers (`src/stage.ts`).
- Maps and models: `src/maps/saliency-map.ts` (grid, normalise, resample,
  Pearson, difference), `src/render/` (magma and blue–orange tables, heatmap
  drawing), `src/models/` (types, registry, centre bias, classic salience in a Web Worker
  at `src/models/classic-salience/`), `src/results.ts` (runs
  every model per image) and `src/views/overlay.ts` (model selector, slider).
- UNISAL conversion: `tools/unisal-export/` (`uv run export.py`) writes
  `public/models/unisal/` (ONNX fp16, 6.4 MB, dynamic input size; the Gaussian
  priors are a second input built from `model.json`). Verified against PyTorch on
  all 12 photos: r = 1.00000 (fp32), ≥ 0.99999 (fp16).
- Example photos: 12 Commons photos in `public/examples/` with `examples.json`
  (credits), prepared by `scripts/prepare-photos.mjs`, checked by
  `scripts/validate-examples.mjs`; picker and credit line in `src/examples.ts`.
- Vite + TypeScript scaffold under base `/eek-a-look/`,
  completed from `eek-a-template` v0.3.0. CI: `check-build.yml`.
- Deploy: `deploy-eek-a-look.yml` in `eelkedevries/eelkedevries.com` builds this
  repository and rsyncs it to `/eek-a-look/`. The site deploy protects that folder.
  Started with `npm run deploy` (`scripts/deploy.sh`).

## Key decisions

The v1 decisions of 2026-10-18 are recorded in `docs-dev/plan.md` and
`specification.md` (version 0.3).

- `deploy-eek-a-look.yml` uses its own concurrency group (`eek-a-look-deploy`),
  not `eelkedevries-site-deploy`. A shared group would let a queued eek-a-look
  run cancel a pending site deploy, and the two never write to the same folder.

## In progress / next

Next: `009_unisal_browser.md`.

## Prompts run

- `001_setup.md`
- `002_website_deploy_workflow.md` (eelkedevries.com commit `52007f8`)
- `003_deploy_command.md`
- `004_page_shell.md`
- `005_example_photos.md`
- `006_map_core.md`
- `007_classic_salience.md` (about 50–70 ms per photo in Chrome; it favours
  large contrasts such as sky gaps and foliage over small signs)
- `008_unisal_export.md` (MIT1003 fine-tuned weights, SALICON domain, as UNISAL
  uses for MIT300)
