# Task: UNISAL in the browser

## Goal

Run the exported UNISAL model in a Web Worker with onnxruntime-web, and
register it as the third model.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

`specification.md`: *Architecture* (UNISAL runtime, self-hosting, lazy
loading) and *Domain rules* (UNISAL, honesty). Use `public/models/unisal/`
and `tools/unisal-export/reference/` from prompt 008.

## Required changes

1. Add `onnxruntime-web` at an exact version. Copy the WASM/MJS files it needs
   into the build under `/eek-a-look/ort/`, and set `ort.env.wasm.wasmPaths`
   to match. Use execution providers `['webgpu', 'wasm']`. Set
   `numThreads = 1` unless `crossOriginIsolated` is true.
2. `src/models/unisal/worker.ts`:
   - load `model.json` and the ONNX file lazily, never before first paint;
   - report download progress (MB) and the backend in use ("GPU" or "CPU").
3. Pre-processing: letterbox the image into the model's input size, keeping the
   aspect ratio and padding so the normalised value is 0, then apply ImageNet
   normalisation.
   Post-processing: crop the padding, apply exp() if the output is a log
   density, resample to the shared grid, and normalise.
4. Register the model:
   - name "UNISAL", subtitle "small neural network", kind `neural`;
   - licence `Apache-2.0`, citation Droste, Jiao and Noble (2020);
   - MIT300 benchmark figures from the spec;
   - `downloadBytes` (model plus WASM).
5. In dev mode, compare the browser output for the reference example with
   `tools/unisal-export/reference/<id>.json` (Pearson r ≥ 0.98) and log the
   result.
6. After the deploy, check the live server: `.wasm` must be served as
   `application/wasm`, and the `.onnx` file must download. If the MIME type is
   wrong, add `public/.htaccess` with `AddType application/wasm .wasm`, confirm
   it reaches `dist/`, and redeploy.

## Do not implement

Do not implement:
- comparison views (010);
- a service worker or offline mode;
- remote or additional models.

## Acceptance criteria

The task is complete when:
- the UNISAL overlay appears for examples and uploads, in Chrome (WebGPU) and
  Firefox (WASM);
- the first paint is not delayed by the model download;
- the dev-mode reference check reports r ≥ 0.98;
- the live server serves the WASM with the correct MIME type;
- `npm run check` passes.

## Checks

`npm run check`; `curl -sI https://eelkedevries.com/eek-a-look/ort/<file>.wasm`;
manual check in two browsers.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
