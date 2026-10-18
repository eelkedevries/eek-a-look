# Specification

**Version:** 0.10 · **Last updated:** 2026-10-18

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
on the owner's GPU for the example photos (prompts 013–014). 0.7 switches the
heatmaps to inferno over a greyed photo after the colour-map research (prompt 017).
0.8 adds twelve Zürich street photos with measured eye-tracking maps from the
openly licensed dataset of Wilming et al. (2017), reversing the decision not to
compare with measured eye-tracking data (owner's decision of 2026-10-18, prompt 018).
0.9 shows the measured maps as their own layer, "Measured gaze", with each
model's match against it (prompt 020). 0.10 adds automatic areas for the
example photos: nine street categories and the ground floor (prompt 021).

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
- twelve Zürich street photos from the eye-tracking dataset of Wilming et al.
  (2017, CC0 1.0), each with a **measured** eye-tracking map
  (`tools/measured-gaze/`);
- **upload** of the visitor's own photo (file picker only; no camera capture);
- four views: **overlay with opacity slider**, **side by side**,
  **"What AI adds"** map, **agreement scores**;
- a short About section covering the models, honesty, privacy and credits.

Out of scope for v1: drawing areas of interest, server-hosted models, languages
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
  to the best available neural model (MSDB, IIE, UNISAL). With `npm run local`
  on the owner's laptop, a GPU helper (`tools/deepgaze-local/serve.py`, bound
  to 127.0.0.1) runs both models live; the page reaches it only through
  `/eek-a-look/local-api/`, only in builds made by `npm run local`
  (`VITE_LOCAL_HELPER=1`) and only when served from localhost.
- **Automatic areas:** pre-computed on the owner's laptop GPU by
  `tools/areas/` for the example photos only, in
  `public/precomputed/areas/<photo-id>.json` (see *Data schemas*). No
  segmentation model runs on the site and no weights are published.
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
  kind: 'baseline' | 'classic' | 'neural' | 'measured';
  runtime: 'browser' | 'remote';
  covers?(context): boolean; // layers for some photos only (measured gaze)
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
  model: string;          // 'deepgaze-iie' | 'deepgaze-msdb' | 'measured'
  photo: string | null;   // example photo id
  grid: GridSize;         // the shared grid for that photo
  encoding: 'uint16-base64';
  data: string;           // little-endian uint16, scaled to the maximum
}
```

An area file, `public/precomputed/areas/<photo-id>.json`:

```ts
interface AreaFile {
  photo: string;          // example photo id
  width: number;          // mask size: the photo scaled to 640 px on the long side
  height: number;
  horizon: { row: number; method: 'vanishing-lines' | 'assumed-level'; support: number };
  params: { cameraHeightM: number; storeyHeightM: number };
  models: Record<string, string>;   // step → repository@revision or rule
  areas: Array<{
    id: string;           // e.g. 'facade', 'sky', 'ground-floor'
    label: string;        // visitor-facing
    group: 'category' | 'element';
    share: number;        // fraction of all mask pixels
    rle: number[];        // row-major run lengths, starting outside the area
    model?: string;       // key in `models` for elements
    instances?: number;
    meanScore?: number;
  }>;
}
```

The example photo manifest is `public/examples/examples.json`, an array of:

```ts
interface ExamplePhoto {
  id: string;             // kebab-case, unique
  area: 'Zuidas' | 'Weena' | 'Wilhelminapier' | 'Beatrixkwartier' | 'Zürich';
  city: 'Amsterdam' | 'Rotterdam' | 'The Hague' | 'Zürich';
  title: string;          // short caption
  file: string;           // path relative to public/examples/
  width: number;
  height: number;
  author: string;
  licence: string;        // e.g. "CC BY-SA 4.0"
  licenceUrl: string;
  sourceUrl: string;      // Commons file page, or the dataset's DOI
  changes: string;        // e.g. "Resized and recompressed"
  measured?: {            // only for photos with measured eye tracking
    observers: number;
    fixations: number;    // fixations in the measured map
    viewingSeconds: number;
    citation: string;
  };
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

**Measured gaze**

- Source: Wilming et al. (2017, *Scientific Data* 4, 160126), CC0 1.0, study
  `Baseline` (Onat, Açık, Schumann & König, 2014, *PLoS ONE*): 48 observers,
  free viewing for 6 s, EyeLink II, 45.6 px per degree, photos of 1280 × 960
  shown full-screen. Built by `tools/measured-gaze/` into
  `public/precomputed/measured/<photo-id>.json` (model `'measured'`).
- Recipe, per photo:
  - the fixations of category 8 and that file number, without the first
    fixation of each trial (it starts on the central fixation cross);
  - 1-based pixels converted to 0-based; points outside the image dropped;
  - one count per fixation, not weighted by duration;
  - a Gaussian blur of σ = 1° = 45.6 px, zero outside the image;
  - summed into 10 × 10 px cells, which is the shared 128 × 96 grid, and
    normalised to sum 1.
- Shown as the layer **"Measured gaze"** (registry kind `'measured'`, runtime
  `'precomputed'`, licence CC0 1.0), listed first as the reference, only on
  photos with measured data. On other photos and on uploads it is left out of
  every view, with no "unavailable" note. It is never in the neural preference
  (MSDB, IIE, UNISAL) and never in the agreement matrix.

**Automatic areas**

- **Street categories:** OneFormer ADE20K Swin-L
  (`shi-labs/oneformer_ade20k_swin_large`, MIT, pinned revision), semantic
  task, ADE20K class indices grouped so that every pixel belongs to exactly one
  category:
  - façade: 0, 1, 25, 48, 84, 8, 14, 58, 42, 86, 79;
  - sky: 2;
  - greenery: 4, 9, 17, 72, 66, 29;
  - street surface: 3, 6, 11, 52, 13, 94, 91, 46, 53, 59, 121;
  - people: 12;
  - vehicles: 20, 80, 83, 102, 116, 127, 76, 103, 90;
  - signage: 43, 100, 123, 144, 149;
  - street furniture: 93, 87, 136, 69, 138, 32, 38, 95, 88, 106, 104, 132, 19,
    15, 114;
  - other: the rest.
- **Ground floor** (an element), with camera height *c* = 1.6 m and storey
  height *H* = 4.0 m:
  - the horizon row *y<sub>h</sub>* comes from vanishing points of receding
    horizontal façade edges (RANSAC, zero roll). With fewer than 15 supporting
    segments, or outside the middle 80% of the image, it falls back to the
    middle row (`assumed-level`);
  - per column, the base *y<sub>0</sub>* is the bottom of the lowest façade run
    where it meets street surface; hidden bases are interpolated within the
    façade run;
  - the ground floor is the façade pixels from *y<sub>0</sub>* up to
    *y<sub>h</sub> − (H − c)/c · (y<sub>0</sub> − y<sub>h</sub>)*.
- Other façade elements (windows, entrances, balconies, shopfronts) are added
  by prompt 023.

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
- **Match with measured gaze** (photos with measured data only) = each model's
  Pearson r with the measured map, to two decimals, sorted from high to low.

**Honesty** (binding on all visitor-facing text)

- Every predicted heatmap carries the label **"Predicted"**. The measured map
  carries **"Measured"**, in its own colour, and is never presented as a
  prediction.
- The page states, near the top, that these are predictions, not measured gaze,
  except the "Measured gaze" layer on the Zürich photos.
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

- Heatmaps use matplotlib's **inferno** (perceptually uniform, readable with
  colour blindness, brightest at the peaks), drawn over a **greyed copy of the
  photo** (Rec. 709 luminance × 0.75), so heatmap colours do not mix with the
  photo's own (for example red brick). The table is indexed from 0.35 and
  alpha = 0.9·t^0.8. In the overlay, the grey copy fades with the slider, so at
  0 % the photo shows in colour. Chosen by the owner on 2026-10-18 (option C),
  after research: Borland and Taylor (2007); Liu and Heer (CHI 2018); Crameri,
  Shephard and Heron (Nature Communications, 2020); Reda (IEEE TVCG, 2023).
- The difference map uses a colour-blind-safe diverging map
  (blue → neutral → orange).
- No rainbow or "jet" colour maps.

## Naming and voice

- The product name is always lower case: **eek-a-look**.
- Visitor-facing model names: "Centre bias", "Classic salience" and "UNISAL"
  (subtitle "small neural network"). The measured layer is "Measured gaze"
  (subtitle "48 people, eye tracking").
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
- Measured eye tracking comes only from openly licensed datasets, and is always
  labelled as measured, never mixed with predictions.
- Not listed on the eelkedevries.com Projects page.
- Prompt files live in `docs-dev/agent/prompts/`.
