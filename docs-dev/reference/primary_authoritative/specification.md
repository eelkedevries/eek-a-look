# Specification

**Version:** 0.6 · **Last updated:** 2026-10-18

The authoritative design canon for this project. **Only filled sections are
binding.** An empty or stubbed section means "not yet decided", not a
constraint. When a decision is made or changed, update the relevant section and
bump the version above.

When the codebase and this document conflict, this document is correct.

Changes: 0.2 records the v1 decisions from the owner Q&A of 2026-10-18
(see `docs-dev/plan.md`). 0.3 moves the deploy into the eelkedevries.com
repository, which already holds the SiteGround secrets, so the owner has no
secrets to add. 0.4 runs UNISAL on the CPU WebAssembly backend only (prompt 009):
it takes about 0.1–0.35 s per photo on a desktop CPU, while the WebGPU build would
add 14 MB (3 MB compressed) of runtime to download. 0.5 changes the heatmap colours to the warm YlOrRd map
the owner chose (prompt 012). 0.6 adds DeepGaze IIE and DeepGaze MSDB, pre-computed
on the owner's GPU for the example photos (prompts 013–014).

## Scope

v1 is a single public web page at `https://eelkedevries.com/eek-a-look/`. It
shows where people are **predicted** to look in a streetscape photo, using
five models side by side: three that run in the visitor's browser, and two
large models whose maps are pre-computed for the example photos.

In scope for v1:

- three models running in the visitor's browser: **centre bias**,
  **classic salience** (Itti–Koch style) and **UNISAL**;
- two large models, **DeepGaze IIE** and **DeepGaze MSDB**, run on the owner's
  laptop GPU (`tools/deepgaze-local/`); their maps are published for the
  example photos only;
- twelve example photos of Dutch high-rise streets (Zuidas, Weena,
  Wilhelminapier, Beatrixkwartier), openly licensed, with credits;
- **upload** of the visitor's own photo (file picker only; no camera capture);
- four views: **overlay with opacity slider**, **side by side**,
  **"What AI adds"** map, **agreement scores**;
- a short About section covering the models, honesty, privacy and credits.

Out of scope for v1: drawing areas of interest, server-hosted models, comparison with measured eye-tracking data (not planned), languages
other than English, analytics, accounts, saving or sharing results, and a card
on the eelkedevries.com Projects page.

## Architecture

- **Stack:** Vite + TypeScript, no UI framework. Static build in `dist/` with
  the Vite `base` set to `/eek-a-look/`. Scaffolded from `eek-a-template`
  v0.3.0 (`.copier-answers.yml`).
- **Hosting:** SiteGround.
  - The workflow `deploy-eek-a-look.yml` in `eelkedevries/eelkedevries.com`
    checks out this public repository, builds it, and rsyncs `dist/` to
    `<document root>/eek-a-look/`. It reuses that repository's existing
    secrets and its document-root checks.
  - It runs on a `look-updated` repository dispatch or `workflow_dispatch`,
    started by `npm run deploy` with the local `gh` login.
  - The eelkedevries.com deploy protects `/eek-a-look/***` from its
    `--delete-after`.
  - This repository stores no secrets. GitHub Pages is not used.
- **Model registry** (`src/models/registry.ts`): an array of `ModelSpec` (see
  *Data schemas*). Each model implements
  `predict(image: ImageBitmap, grid: GridSize) => Promise<SaliencyMap>`.
  `runtime: 'remote'` is reserved for later large models; v1 contains no remote
  code beyond the type.
- **Pre-computed models:** `runtime: 'precomputed'`. Maps live in
  `public/precomputed/<model-id>/<photo-id>.json` (see *Data schemas*). For an
  upload these models report the status `unavailable`, and the views fall back
  to the best available neural model (MSDB, IIE, UNISAL).
- **Workers:** classic salience and UNISAL each run in a Web Worker, so the page
  stays responsive. Centre bias runs on the main thread.
- **Shared grid:** every model's output is resampled to one grid per image. Its
  long side is 128 cells and its short side follows the image's aspect ratio
  (rounded). All comparisons use this grid. Display upsamples it to the image
  size with bilinear interpolation.
- **UNISAL runtime:** onnxruntime-web, CPU WebAssembly backend (`wasm`) only.
  Single-threaded unless `crossOriginIsolated` is true. The model and the ORT
  WASM files are self-hosted under the base path (Vite assets) and lazy-loaded
  after first paint. The input size follows UNISAL's own MIT1003 rule (32·(n1,
  n2), aspect-matched), not a letterbox; the Gaussian priors are built in the
  browser from `model.json`.
- **Fonts:** Lexend (body), Spectral (headings) and JetBrains Mono (numbers,
  labels), self-hosted through `@fontsource/*` packages. No Google Fonts
  request.
- **No third-party requests at run time.** No analytics, no cookies.
  `localStorage` may hold UI preferences only.

## Data schemas

```ts
// A probability map: non-negative values that sum to 1 (within 1e-6).
interface SaliencyMap {
  width: number;          // grid columns
  height: number;         // grid rows
  data: Float32Array;     // row-major, length width*height
}

interface GridSize { width: number; height: number; }

interface BenchmarkScore {
  dataset: 'MIT300';
  cc: number;             // Pearson correlation
  aucJudd: number;
  source: string;         // URL
  retrieved: string;      // ISO date
}

interface ModelSpec {
  id: 'centre-bias' | 'classic-salience' | 'unisal' | string;
  name: string;           // visitor-facing, e.g. "Centre bias"
  kind: 'baseline' | 'classic' | 'neural';
  runtime: 'browser' | 'remote';
  downloadBytes?: number; // weights + runtime the visitor downloads
  licence: string;        // SPDX id or "own implementation"
  citation: string;       // short reference
  oneLine: string;        // plain-language description, at most 20 words
  benchmark?: BenchmarkScore;
  predict(image: ImageBitmap, grid: GridSize): Promise<SaliencyMap>;
}
```

A pre-computed map, `public/precomputed/<model-id>/<photo-id>.json`:

```ts
interface PrecomputedMap {
  model: string;          // 'deepgaze-iie' | 'deepgaze-msdb'
  photo: string | null;   // example photo id
  grid: GridSize;         // the shared grid for that photo
  encoding: 'uint16-base64';
  data: string;           // little-endian uint16, scaled to the maximum
}
```

The example photo manifest is `public/examples/examples.json`, an array of:

```ts
interface ExamplePhoto {
  id: string;             // kebab-case, unique
  area: 'Zuidas' | 'Weena' | 'Wilhelminapier' | 'Beatrixkwartier';
  city: 'Amsterdam' | 'Rotterdam' | 'The Hague';
  title: string;          // short caption
  file: string;           // path relative to public/examples/
  width: number;
  height: number;
  author: string;
  licence: string;        // e.g. "CC BY-SA 4.0"
  licenceUrl: string;
  sourceUrl: string;      // Commons file page
  changes: string;        // e.g. "Resized and recompressed"
}
```

## Domain rules

**Model definitions**

- **Centre bias.** The anisotropic Gaussian baseline of Clarke and Tatler
  (2014, *Vision Research* 102, 41–51):
  - coordinates are normalised by half the image width, so the centre is
    (0, 0), x lies in [−1, 1] and y in [−a, a], where a = height / width;
  - the density is zero-mean with covariance diag(σ², ν·σ²), where σ² = 0.22
    and ν = 0.45;
  - evaluate it at cell centres, then normalise so the map sums to 1.
- **Classic salience.** Our own implementation of Itti, Koch and Niebur (1998):
  - features: intensity, red–green and blue–yellow opponency, and four
    orientations;
  - processing: Gaussian pyramids, centre–surround differences, the
    normalisation operator N(·), conspicuity maps, summed and blurred;
  - no centre bias is added;
  - it is labelled "our implementation"; its benchmark field stays empty.
- **UNISAL.** Droste, Jiao and Noble (2020, ECCV), weights from
  `rdroste/unisal` (Apache-2.0):
  - static-image path;
  - the MIT1003 domain if the code provides it, otherwise SALICON, with the
    choice recorded in the model notes;
  - exported once to ONNX fp16 and verified against PyTorch (Pearson r ≥ 0.99
    on at least five images).

- **DeepGaze IIE** (Linardos et al., ICCV 2021) and **DeepGaze MSDB**
  (Kümmerer, Khanuja & Bethge, ICCV 2025):
  - from <https://github.com/matthias-k/DeepGaze> (pinned commit), which has no
    licence file, so their code and weights are never published, only maps;
  - photos resized to 1024 px on the long side, with the MIT1003 centre-bias
    template; MSDB at 35 px per degree with its MIT1003 parameters.

**Derived views**

- **What AI adds** = P_ai − P_centre on the shared grid, where *ai* is the
  best available neural model (MSDB, then IIE, then UNISAL) and is named in the
  view. It is drawn with a diverging colour map symmetric around zero and
  described to visitors as "where the AI expects more (or less) looking than
  *people look at the middle* alone".
- **Agreement** = the Pearson correlation of two maps on the shared grid, for
  every pair of models, shown as a lower-triangle matrix to two decimals with
  the plain-language scale "0 = unrelated · 1 = same pattern"; "n/a" where a
  model does not cover the photo.

**Honesty** (binding on all visitor-facing text)

- Every heatmap carries the label **"Predicted"**.
- The page states, near the top, that these are predictions, not measured gaze.
- Benchmark figures are quoted only with their source and retrieval date. v1
  uses MIT300 figures from <https://saliency.tuebingen.ai/results.html>,
  retrieved 2026-10-18:

  | Model | CC | AUC-Judd |
  |---|---|---|
  | Centre bias | 0.4455 | 0.7830 |
  | UNISAL | 0.7851 | 0.8772 |
  | DeepGaze IIE | 0.8242 | 0.8829 |
  | DeepGaze MSDB | 0.8832 | 0.8942 |

  Display these to two decimals.
- **No claim** that any model is valid for Dutch streetscapes, for real
  street walking (rather than viewing a photo on a screen), or for
  individuals.
- Light and large models are compared only by the figures above. No
  percentages of a human ceiling are used.

**Privacy**

- Uploaded photos never leave the device: no network request carries image
  data.
- Uploaded photos are not stored after the tab closes.
- EXIF metadata is ignored, apart from applying the orientation.

**Images**

- Example photos are at most 1600 px on the long side, JPEG quality about 82,
  with EXIF and GPS stripped.
- Uploaded images are downscaled in the browser to at most 1600 px on the long
  side before processing.

**Colour maps**

- Heatmaps use ColorBrewer YlOrRd, a warm sequential map (yellow → orange →
  red), chosen by the owner on 2026-10-18 from six rendered options. It is
  colour-blind safe and reads well over photos. The table is indexed from 15 %
  so faint areas still read as warm; alpha = 0.85·t^0.9.
- The difference map uses a colour-blind-safe diverging map
  (blue → neutral → orange).
- No rainbow or "jet" colour maps.

## Naming and voice

- The product name is always lower case: **eek-a-look**.
- Visitor-facing model names: "Centre bias", "Classic salience" and "UNISAL"
  (subtitle "small neural network").
- Visitor-facing text is British English, plain and short, for a general
  audience. The tool comes first and explanations are brief. Avoid jargon
  ("saliency", "fixation density"): say "where people are likely to look".
- The look matches eelkedevries.com:
  - background `#0a0a0f`, text `#eae7e1`, links `#7fb4ec` (hover `#a9cdf5`),
    borders `#2a2a35`, accent `#e8b43a`;
  - headings in Spectral, body in Lexend, numbers and labels in JetBrains Mono;
  - the image stage is neutral dark grey, so heatmaps read correctly.

## Locked decisions

- Public repository. Deployment to SiteGround by the eelkedevries.com workflow
  `deploy-eek-a-look.yml`. No secrets in this repository; no GitHub Pages.
- Five models: three in the browser (weights self-hosted), two pre-computed
  locally for the example photos. Nothing is processed on a server.
- Upload only; no camera capture; no remote processing in v1.
- English only.
- No comparison with measured eye-tracking data.
- Not listed on the eelkedevries.com Projects page.
- Prompt files live in `docs-dev/agent/prompts/`.
