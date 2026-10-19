# Specification

**Version:** 0.43 · **Last updated:** 2026-10-19

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
0.11 adds windows, entrances, balconies and shopfronts, each from the model
that scored best on human-labelled façades (prompt 023). 0.12 takes the
horizon from standing people when façade lines fail (prompt 021b). 0.13 adds
the Areas view with attention ÷ size per area (prompt 025). 0.14 adds the
simulated panel's verdicts under the Areas table (prompt 026). 0.15 replaces
"What AI adds" with a Contrast view of any two maps, by default against the
best model, and adds match scores and a shared pointer ring to the side-by-side
view (prompt 027, owner's request of 2026-10-19). 0.16 lays the page out as a
workspace: a photo library, the views and an inspector with the layers, the
contrast selectors, the heatmap strength and each layer's match with the
reference (prompt 028, from the owner-approved mock-up of 2026-10-19). 0.17 shows street categories and façade elements
together in the Areas view instead of as two switchable groups (prompt 029,
owner's request of 2026-10-19). 0.18 adds image measures for the three design
principles, starting with the active ground floor: this project's operational
definition, frontage columns and a fixed rule, written to quality files
(prompt 040). 0.19 makes that measure Unclear when the horizon was assumed,
since the ground floor is then unreliable (prompt 040b). 0.20 adds the image
measure for horizontal–vertical rhythm and variety: the spacing of window and
balcony instances in local windows, calibrated on CMP Facade, and colour zones
for variety (prompt 041; the window size, the items and the reference were
corrected on the calibration images before the measure ran on the photos).
0.21 lets visitors show the measured fixations as points over the "Measured
gaze" layer, never over a model's map (prompt 030, owner's decision of
2026-10-19). 0.22 calibrates the SAM 3 score above which an instance counts
for rhythm together with τ; the calibration kept 0.65 (prompt 041b). 0.23
adds the image measure for tactile materials: visible texture near eye level
from the DMS46 material model (prompt 042). 0.24 adds 25 openly licensed
images from two published eye-tracking studies (Zhang et al. 2026; Wang, Hu &
Ma 2025) with all five predictions; each links to the heat map its study
measured, which is never turned into a layer (prompt 031, owner's request of
2026-10-19). 0.25 opens the single map on measured gaze
with its fixations where the photo has them (prompt 049, owner's request of
2026-10-19). 0.26 removes the centre-bias layer and every mention of it from
the site, the method texts and the offline area checks, leaving four
predictions (prompt 032, owner's request of 2026-10-19). 0.27 draws the fixation points at 65% opacity
and adds their checkbox under the image (prompt 050, owner's request of
2026-10-19).
0.28 adds a graded run of the simulated panel: ratings from 0 to 4 with boxes
around the evidence, never combined with gaze statistics (prompt 044). 0.29 adds UP-CLIP scores from a reproduction of the
model and plain CLIP, for every example photo (prompt 046). 0.30 adds the Qualities view and moves the simulated
panel there (prompt 047). 0.31 adds matching descriptions and photos with UP-CLIP
to the Qualities view (prompt 048). 0.32 names the study images' kind (rendering or 360°
panorama) and computes their areas, with a ground-floor rule for panoramas
(prompt 051). 0.33 computes the image measures for the study images too
and tags them on the page (prompt 052). 0.34 adds a slider for the fixation points' opacity below
the heatmap strength (prompt 054, owner's request of 2026-10-19). 0.35 shows
the three principles together in the Qualities view instead of behind a switch
(prompt 055, owner's request of 2026-10-19). 0.36 lets visitors draw the
fixation points over the predicted maps too, off by default, which reverses the
earlier rule of drawing them over the measured map only (prompt 056, owner's
request of 2026-10-19). 0.37 moves the heatmap strength, the fixation points'
slider and the fixation checkboxes from the inspector and from under the image
into one foldable "Display settings" section between the view tabs and the
image (prompt 057, owner's request of 2026-10-19). 0.38 adds an "Example"
section with three design comparisons on edited Zürich photos (entrance,
greenery, glazing): every map and the areas computed in advance, measured
gaze on untouched originals only (prompt 058, owner's request of 2026-10-19).
0.39 adds a rating page for human raters, with a rubric, and inter-rater
agreement in `agreement.py` (prompt 059, owner's request of 2026-10-19).
0.40 adds frontage density and a frontage grade adapted from the Urban Design
Compendium to the ground-floor measure, as indicators that change no outcome
(prompt 062, owner's request of 2026-10-19).
0.41 describes each example comparison as question, background, conditions
and two possible outcomes (prompt 066, owner's request of 2026-10-19).
0.42 shows A, B and their difference side by side, measures only the
manipulated area, with a "Highlight manipulated area" checkbox, and makes the
entrance area the door and its recoloured surround (prompt 067, owner's
request of 2026-10-19). 0.43 adds colour bars, draws A and B on one colour
scale, reports only the selected model as Σ A, Σ B and the contrast B − A
with its direction, and leaves measured gaze out of the Example section
(prompt 068, owner's request of 2026-10-19).

## Scope

v1 is a single public web page at `https://eelkedevries.com/eek-a-look/`. It
shows where people are **predicted** to look in a streetscape photo, using
five models side by side: three that run in the visitor's browser, and two
large models whose maps are pre-computed for the example photos.

In scope for v1:

- two models running in the visitor's browser: **classic salience**
  (Itti–Koch style) and **UNISAL**;
- two large models, **DeepGaze IIE** and **DeepGaze MSDB**, run on the owner's
  laptop GPU (`tools/deepgaze-local/`); their maps are published for the
  example photos only;
- twelve example photos of Dutch high-rise streets (Zuidas, Weena,
  Wilhelminapier, Beatrixkwartier), openly licensed, with credits;
- twelve Zürich street photos from the eye-tracking dataset of Wilming et al.
  (2017, CC0 1.0), each with a **measured** eye-tracking map
  (`tools/measured-gaze/`);
- 25 images from two published eye-tracking studies (CC BY 4.0), in a group
  "From published studies" with **predictions only**: each credit line links to
  the heat map the study published, which is not digitised, reconstructed or
  shown as a layer;
- **upload** of the visitor's own photo (file picker only; no camera capture);
- four views: **overlay with opacity slider**, **side by side**,
  **contrast** of two maps, **agreement scores**;
- an **Areas** view for the example photos: automatic areas and attention ÷
  size per area and layer;
- a **Qualities** view for the example photos: image
  measures for three design principles with their evidence on the photo, the
  definitions behind them, the other methods' judgements of the same photo,
  and attention ÷ size for the evidence regions;
- an **Example** section (prompt 058): three design comparisons, each of two
  images of the same Zürich scene, one or both edited with AI image editing
  (see *Example comparisons*);
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
  stays responsive.
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
  id: 'classic-salience' | 'unisal' | string;
  name: string;           // visitor-facing, e.g. "Classic salience"
  kind: 'classic' | 'neural' | 'measured';
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
  horizon: { row: number; method: 'vanishing-lines' | 'standing-people' | 'assumed-level' | 'equirectangular'; support: number };
  imageKind?: 'render' | 'panorama';   // copied from the manifest (prompt 051)
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
    lowConfidence?: boolean; // element whose model scored a mean test IoU below 0.20
  }>;
}
```

A quality file, `public/precomputed/qualities/<photo-id>.json`, on the mask
grid of the photo's area file:

```ts
interface QualityFile {
  photo: string;
  width: number;          // as the area file
  height: number;
  imageKind?: 'render' | 'panorama';   // study images (prompt 052)
  models: Record<string, string>;   // step → repository@revision or rule
  principles: Partial<Record<'groundFloor' | 'rhythm' | 'materials', PrincipleResult>>;
}

interface PrincipleResult {
  outcome: 'likely-present' | 'likely-absent' | 'unclear';
  reasons: string[];      // plain-language, from the rule
  indicators: Record<string, number | null>;
  evidence: Array<{
    id: string;
    label: string;        // visitor-facing
    role: 'supports' | 'against' | 'context';
    share: number;        // fraction of all mask pixels
    rle?: number[];       // a region, as in the area file
    lines?: number[][];   // or line segments [x1, y1, x2, y2] on the mask grid, drawn 1 px wide
  }>;
  grade?: {               // ground floor only, where a horizon was found (prompt 062)
    value: string | null; // "A"–"E", a range such as "D–E", or null under 20 m of counted frontage
    source: string;       // "adapted from the Urban Design Compendium, Table 5.3 …; not an expert grade"
    byFieldOfView: Record<string, string | null> | null;  // perspective photos: "45", "60", "75"; null for panoramas
  };
}
```

The example photo manifest is `public/examples/examples.json`, an array of:

```ts
interface ExamplePhoto {
  id: string;             // kebab-case, unique
  area: 'Zuidas' | 'Weena' | 'Wilhelminapier' | 'Beatrixkwartier' | 'Zürich' | 'From published studies';
  city: 'Amsterdam' | 'Rotterdam' | 'The Hague' | 'Zürich' | 'Qinyang' | 'Guangzhou';
  title: string;          // short caption
  file: string;           // path relative to public/examples/
  width: number;
  height: number;
  author: string;
  licence: string;        // e.g. "CC BY-SA 4.0"
  licenceUrl: string;
  sourceUrl: string;      // Commons file page, or the dataset's DOI
  changes: string;        // e.g. "Resized and recompressed"
  imageKind?: 'render' | 'panorama'; // study images only (required there): a design
                          // rendering, or a 360° panorama in equirectangular projection;
                          // absent for ordinary photos (prompt 051)
  measured?: {            // only for photos with measured eye tracking
    observers: number;
    fixations: number;    // fixations in the measured map
    viewingSeconds: number;
    citation: string;
  };
  study?: {              // only for images from a published study (area 'From published studies')
    citation: string;
    heatmapFigure: string; // e.g. "Figure 3"
    heatmapUrl: string;    // the publisher's figure file
    viewing: string;       // the study's viewing set-up, one line
  };
  editOf?: string;         // edited images only (comparisons.json): the photo it was edited from
  condition?: string;      // edited images only: what the edit made, e.g. "Added low planting"
}
```

The Example section's manifest is `public/examples/comparisons.json`:
`images`, the edited images as `ExamplePhoto` entries with `editOf` and
`condition` and without `measured` (same size as the photo they come from),
and `examples`, each `{ id, a, b, reference? }` naming the two images
compared and, where neither is the untouched photo, that photo. Edited images
are not in the library.

## Domain rules

**Model definitions**

- **Classic salience.** Our own implementation of Itti, Koch and Niebur (1998):
  - features: intensity, red–green and blue–yellow opponency, and four
    orientations;
  - processing: Gaussian pyramids, centre–surround differences, the
    normalisation operator N(·), conspicuity maps, summed and blurred;
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
- **Fixation points:** the fixations behind each map (after steps 1–2 of the
  recipe) are also written to `<photo-id>.points.json`. A checkbox
  "Show fixations (raw data)" in the display settings (prompt 057; before
  that in the inspector and under the image, prompt 050), on by default
  (prompt 049) and present only on photos with measured data, draws them as
  cyan dots over the "Measured gaze" map in
  "Single map", "Side by side" and "Contrast". A second checkbox "Also over
  the model maps", beside it, off by default and inactive while
  the dots are off, draws the same dots over the predicted maps too: in
  "Single map", in every panel of "Side by side" and on both maps beneath
  the contrast, never on the contrast map itself or the plain photo
  (prompt 056, owner's request of 2026-10-19, replacing the rule of
  prompt 030 that drew them over the measured map only). The
  heatmap strength does not dim them. Their opacity is set by a slider
  "Fixation points (raw data)" beside the heatmap strength in the display
  settings, 65% by default, present only on photos with measured data
  (prompt 054).

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
    horizontal façade edges (RANSAC, zero roll; `vanishing-lines`), accepted
    with at least 15 supporting segments and inside the middle 80% of the
    image;
  - failing that, from at least 3 people standing on street surface and at
    least 5% of the image height tall: the median of the head-top row plus
    0.086 of the person's height (head tops at about 1.75 m, camera at 1.6 m;
    `standing-people`), inside the middle 80%;
  - failing that, the middle row (`assumed-level`);
  - per column, the base *y<sub>0</sub>* is the bottom of the lowest façade run
    where it meets street surface; hidden bases are interpolated within the
    façade run;
  - the ground floor is the façade pixels from *y<sub>0</sub>* up to
    *y<sub>h</sub> − (H − c)/c · (y<sub>0</sub> − y<sub>h</sub>)*.
  - **360° panoramas** (`imageKind: 'panorama'`, equirectangular, assumed
    level): the horizon is the middle row (`equirectangular`); rows are
    elevation angles, π over the image height *R*. A base row *y<sub>0</sub>*
    below the horizon lies at depression *φ* = π (*y<sub>0</sub>* −
    *y<sub>h</sub>*) / *R*, so at distance *d* = *c* / tan *φ*; the ground
    floor reaches up to row *y<sub>h</sub>* − (*R* / π) atan((*H* − *c*) /
    *d*). Hidden bases are interpolated as above (prompt 051).
  - **Design renderings** (`imageKind: 'render'`) use the rule for ordinary
    photos; their virtual camera height is unknown, so 1.6 m is an
    assumption.
- **Façade elements:** one text phrase per model call: windows ← "window",
  entrances ← "door", balconies ← "balcony", shopfronts ← "storefront". Only
  pixels inside the façade category dilated by 1% of the width are kept.
  - Candidate models:
    - Grounding DINO base + SAM 2.1 large;
    - OWLv2 large + SAM 2.1 large;
    - Florence-2 large + SAM 2.1 large;
    - SAM 3, once Meta's access review allows it.
    Revisions are pinned in `tools/areas/elements.py`.
  - Per model and element, the score threshold (0.05–0.70 in steps of 0.05)
    with the highest IoU on CMP Facade base images with even numbers is
    used. Florence-2 has no scores and no threshold.
  - Per element, the model with the highest mean test IoU is used: test sets
    are the odd CMP images and, for windows and doors, eTRIMS. Within 0.01
    of the best, an Apache-2.0 or MIT model is preferred.
  - An element whose chosen model scores a mean test IoU below 0.20 is marked
    `lowConfidence`.
  - Elements may overlap each other and the ground floor.

**Architectural qualities**

The image measures cover every example photo. For the study images
(`imageKind`, prompt 052) the rules are the same; the reasons add "A design
rendering, not a photograph." or "A 360° panorama: straight lines curve and
distant surfaces are small, so repetition and texture are harder to see."
The simulated panel judged only the 24 earlier photos.

The three design principles come from Spanjar & Suurenbroek (2020), whose
panel of 14 experts judged whole photos as present, absent or ambiguous. The
paper names the principles but does not define them. The definitions below
are **this project's operational definitions**, not the panel's, and the
image measures are not expert judgements. Built by `tools/qualities/` for the
example photos only, from the area files; each rule was fixed here before it
was run on the photos.

- **Active ground floor** (operational definition): visible street-level
  frontage that offers openings to the street, namely entrances and
  shopfronts. Transparency (windows) is shown but does not by itself make a
  frontage active; blank, closed stretches count against it.
  - A **frontage column** is an image column with at least 3 ground-floor
    pixels. In each, the frontage is **open** if entrances ∪ shopfronts cover
    at least 30% of the column's ground-floor pixels; otherwise **transparent
    only** if windows cover at least 30%; otherwise **closed**.
  - Indicators: `frontageShare` (frontage columns ÷ image width);
    `openShare`, `transparentShare`, `closedShare` (each ÷ frontage columns);
    `entrances` (connected entrance components of at least 20 pixels that
    overlap the ground floor); `longestClosedRun` (the longest run of
    adjacent closed columns ÷ frontage columns); `useCues` (the share of a
    band below the ground floor, half the column's ground-floor height deep,
    covered by people, signage or street furniture; context only).
  - Rule: horizon method `assumed-level` → Unclear ("The horizon could not be
    found, so the ground floor may be far too tall or missing"); else
    `frontageShare` < 0.05 → Unclear ("Too little ground floor is
    visible"); else `openShare` ≥ 0.30 → Likely present; else `openShare` <
    0.10 and `closedShare` ≥ 0.60 → Likely absent; else Unclear, with the
    reason "Mostly windows: transparency alone does not show an active
    frontage" when `transparentShare` ≥ 0.30, otherwise "Open and closed
    stretches are mixed".
  - Evidence: "Open frontage" (supports), "Transparent only" (context),
    "Closed frontage" (against), each the ground-floor pixels of those
    columns; "Entrances" and "Shopfronts" clipped to the ground floor
    (supports).
  - Shares are of image columns, not metres: perspective compresses distant
    frontage, and people in front of the ground floor come and go. Glazing
    that the window model does not find counts as closed.
- **Horizontal–vertical rhythm and variety** (operational definition):
  façades articulated by horizontal layers (floor lines, bands, cornices,
  rows of windows or balconies) and vertical units (bays, columns of windows,
  pilasters) that repeat, with visible variation between façade zones, rather
  than a uniform or unarticulated surface. Rhythm is a relation between
  elements, so the measure looks at their spacing, not at single elements.
  - Items, on the mask grid: SAM 3 instances for "window" and "balcony" inside
    the façade category, scoring at least *s*. *s* is calibrated with τ (below)
    from {0.20, 0.30, 0.40, 0.50, 0.65}, one value for both phrases, for the
    highest mean balanced accuracy over the two families (a tie goes to the
    higher *s*); the calibration chose 0.65. LSD line segments on façade pixels (at least 2% of
    the image width long; **vertical** within 8° of vertical, **layer** within
    60° of horizontal) are drawn as evidence but do not enter the
    periodicity: on the calibration images they pulled the agreement with the
    human labels towards chance.
  - Cells: the façade is cut into 32 × 32 px cells; a cell with at least 60%
    façade pixels is classified from the 160 × 160 px window centred on it
    (about two to three periods of the windows in CMP Facade, whose median
    gaps on the mask grid are 54 px across and 80 px up). Per window and
    family, the instance centroids are projected on the image x-axis (the
    vertical family: bays) or the y-axis (the layer family: floors). A 1-px
    histogram of the positions, smoothed with a Gaussian of σ = 1.5 px, gives
    a normalised autocorrelation; the **periodicity** *p* is its highest
    local peak at lags of 5–100 px, or 0 with fewer than 3 items. The family
    **repeats** if *p* ≥ τ.
  - τ is calibrated per family on CMP Facade base images with even numbers,
    in 0.10–0.90 (steps of 0.05), for the highest balanced accuracy against a
    reference from the human labels: the vertical family repeats if any one
    of window, door, balcony, pillar or shop has at least 3 instances in the
    window with distinct x-centres (closer than 3 px count as one) whose gaps
    have a coefficient of variation ≤ 0.35; the layer family likewise for the
    y-centres of window, balcony, sill, cornice or moulding. τ is recorded in
    `tools/qualities/rhythm_calibration.json`. τ came out at the low end of
    the grid (vertical 0.20, layer 0.10; balanced accuracy 0.78 and 0.80):
    three or more regularly placed elements already carry most of the
    signal.
  - Cell classes: *rhythmic* (both families repeat), *layers only*, *bays
    only*, *plain* (fewer than 3 items in both families) or *irregular*.
  - Variety: the façade cells are clustered by the mean CIELAB colour of
    their façade pixels, with distances on (L/2, a, b), average linkage, cut
    at 12. A **zone** is a cluster with at least 10% of the façade cells.
  - Indicators: `facadeCells`; `rhythmicShare`, `layersOnlyShare`,
    `baysOnlyShare`, `plainShare`, `irregularShare` (each ÷ façade cells);
    `distinctZones`; `windowInstances`; `balconyInstances`.
  - Rule: `facadeCells` < 8 → Unclear ("Too little façade is visible"); else
    `rhythmicShare` ≥ 0.25 and `distinctZones` ≥ 2 → Likely present; else
    `rhythmicShare` ≥ 0.25 → Unclear ("Repetition without visible
    variety"); else `rhythmicShare` < 0.10 → Likely absent ("Few repeating
    layers or bays"); else Unclear ("Some repetition").
  - Evidence: "Repeating layers and bays" (supports); "Layers only", "Bays
    only" (context); "Plain or irregular" (against); "Floor lines and bands"
    and "Vertical divisions", stored as segments and drawn 1 px wide
    (context); "Façade zone 1…k" (context).
  - Limits: perspective changes spacing along a receding façade (hence local
    windows); glass curtain walls, where SAM 3 finds no windows, read as
    plain even when mullions divide them; sun and shade can split one façade
    into two colour zones.
- **Tactile materials** (operational definition): surfaces near eye level, on
  the street façade and in the street space, whose material shows visible
  texture or detail (brickwork, natural stone, wood, tiles and setts, wicker,
  planting), as opposed to smooth, uniform surfaces. This is **visible
  texture, not touch**: a photo cannot show how a surface feels.
  - Model: DMS46 (Upchurch & Niu, ECCV 2022; `apple/ml-dms-dataset`, Apple
    sample-code licence; trained on labels under CC BY-NC 4.0), run as its
    `inference.py` does (long side 512, ImageNet normalisation), labels
    resized to the mask grid (nearest). Weights stay on the laptop.
  - Groups: *textured* = Brickwork, Stone (natural), Wood, Wood (tree), Tile,
    Wicker, Foliage (also reported alone as "planting"); *smooth* = Glass,
    Mirror, Metal, Stone (polished), Paint/plaster/enamel, Plastic (clear),
    Plastic (non-clear), Ceramic; *neutral* = every other class, including
    Concrete and Asphalt, whose texture a photo cannot decide.
  - Eye-level zone: the ground floor (*façade part*) plus every pixel below
    the horizon row that is not sky, people, vehicles or ground floor
    (*street-space part*).
  - Indicators: `zoneShare` (zone ÷ photo); `texturedShare`, `smoothShare`,
    `neutralShare`, `plantingShare` (÷ zone); the same three shares for the
    façade part (`facade…`) and the street-space part (`street…`); the three
    most common materials in the zone (`material: <name>`); and
    `texturedFurniture` (textured share of all street-furniture pixels).
  - Rule: horizon method `assumed-level` → Unclear ("The horizon could not be
    found, so the eye-level zone is uncertain"); else `zoneShare` < 0.10 →
    Unclear ("Too little is visible near eye level"); else `texturedShare` ≥
    0.25 → Likely present; else `texturedShare` < 0.10 and `smoothShare` ≥ 2 ×
    `texturedShare` → Likely absent; else Unclear ("Some textured
    surfaces"). The reasons name the ground floor or the street space when
    one of them alone reaches 0.25 textured.
  - Evidence: "Textured surfaces" (without planting) and "Planting"
    (supports); "Smooth surfaces" (against); "Eye-level zone" (context).
  - Limits: distance hides texture; reflections in glass show other
    materials; wet or dark surfaces; DMS46 was trained on general photos, not
    street façades (its published test accuracy per class ranges from about
    0.38 for polished stone to 0.90 for foliage).

**UP-CLIP**

- UP-CLIP (Huang, Song & Jiao 2026, *International Journal of Digital Earth*
  19(1), 2677402) fine-tunes CLIP on 15,000 street-view image–text pairs from
  Wuhan so that photos and descriptions of how a street feels match. Its
  trained model is **not published**. eek-a-look uses a **reproduction**: the
  authors' training script (`19883120121i-afk/UP-CLIP@ef1bb18`, no licence
  file) re-run on their public 1,000-pair sample with gradient checkpointing
  and 8-bit AdamW to fit 8 GB (`tools/up-clip/`, prompt 045), next to plain
  CLIP ViT-L/14 (`openai/clip-vit-large-patch14@32bd642`). Nothing from the
  authors' repository and no weights are published; the base model's card
  rules out deployed use, so only pre-computed scores are.
- Descriptions (`tools/up-clip/descriptions.json`, this project's wording):
  one sentence per keyword of the authors' sample lexicon, "A street that
  feels {word}." (**supported** use: matching photos with perception
  descriptions, as the paper evaluates), and two positive and two negative
  sentences per design principle (**adaptation**: not evaluated by the
  authors).
- A photo's embedding is the mean of three square crops across its width
  (left, centre, right), so CLIP's centre crop does not cut off the sides (an
  adaptation). Scores are cosine similarities, comparable between
  descriptions within one model only, not probabilities, and without a
  location in the photo.
- Principle score = mean similarity with the positive sentences minus mean
  similarity with the negative ones.
- Every example photo is scored (`public/precomputed/up-clip/scores.json`).
  Comparisons with the image measures and the graded panel cover the photos
  that have them and are labelled exploratory. UP-CLIP scores are never
  combined with gaze statistics.

**Derived views**

- **Best model** = the best available neural model for the photo: MSDB, then
  IIE, then UNISAL.
- **Single map**: one layer at a time. By default it is "Measured gaze" with
  the fixation points where the photo has measured data; on other photos the
  view shows the best model instead, without an "unavailable" note. A layer
  the visitor chooses stays chosen across photos; where a photo lacks it or
  it cannot run (pre-computed models on uploads), the best model is shown,
  and the inspector marks the layer actually shown.
- **Side by side**: the photo and every layer that covers it. Each map shows
  its Pearson r with the reference (measured gaze where the photo has it,
  otherwise the best model), and the reference is marked as such. A ring
  follows the pointer at the same relative spot in every panel. A "Contrast"
  button opens that map against the reference in the Contrast view.
- **Contrast** = P_a − P_b on the shared grid for any two layers the visitor
  chooses (with a swap button). By default *b* is the best model and *a* is
  measured gaze where the photo has it, otherwise the next model below *b*
  in display order. It is drawn with a diverging colour map symmetric around
  zero, with both names in the legend and the caption, the selectors in the
  inspector ("Orange: *a* expects
  more looking here than *b*. Blue: less."), their Pearson r, and both
  heatmaps beneath. A difference involving measured gaze is labelled
  "Measured vs predicted".
- **Agreement** = the Pearson correlation of two maps on the shared grid, for
  every pair of models, shown as a lower-triangle matrix to two decimals with
  the plain-language scale "0 = unrelated · 1 = same pattern"; "n/a" where a
  model does not cover the photo.
- **Match with the reference** (in the inspector) = each layer's Pearson r
  with the reference map (measured gaze where the photo has it, otherwise the
  best model), to two decimals, sorted from high to low.
- **Layout**: a top bar (name, section links, "Runs on this device", "Use
  your own photo"), the honesty notice, then three panes that stack on a
  phone:
  - a photo library with search, the filters "All", "Measured gaze" and
    "Dutch high-rise", thumbnails grouped by area and a blue dot on photos
    with measured gaze (one scrolling row on a phone);
  - the workspace: the photo's title and place, and the views "Single map",
    "Side by side", "Contrast", "Areas" and "Qualities";
  - directly below the view tabs and above the image, a foldable section
    "Display settings", open by default (prompt 057): the heatmap strength
    with its legend (in "Single map" and "Side by side"), and on photos with
    measured gaze the "Fixation points (raw data)" slider and the "Show
    fixations (raw data)" and "Also over the model maps" checkboxes (in
    "Single map", "Side by side" and "Contrast"). It is hidden in views
    where none of these apply;
  - an inspector: the layers (choosing one opens it in "Single map"), the
    Contrast selectors with "Reset to the best model", the match with the
    reference, and a short note on the open view.
  The agreement matrix, About and the methods follow below; a status bar
  shows how many layers are ready.
- **Areas** (a tab after "Contrast"; example photos only, uploads get "Areas
  are computed in advance for the example photos only."):
  - the greyed photo with the outlines of all areas at once: street
    categories as solid lines, façade elements (with the ground floor) as
    dashed lines; no switch between the two groups;
  - colours from the Okabe–Ito palette without black, white for street
    furniture and grey for "Other"; one legend with % of the photo, in two
    labelled parts ("Street categories", "Façade elements · dashed"), where
    hovering or focusing an item fills that area;
  - one table, with a row heading for each of the two groups, with, per
    area and ready layer (measured gaze first), the
    **attention ÷ size**: the share of the layer's map inside the area (the
    map upsampled to the mask size with `resample()`), divided by the area's
    share of the photo, to one decimal. 1.0× is what the area's size alone
    predicts;
  - areas under 0.5% of the photo show "–";
  - the note "Ground floor estimated assuming a level camera." when the
    horizon method is `assumed-level`, and "(unreliable: low score in the
    check)" after a `lowConfidence` element.
- **Qualities** (a view after "Areas"; every example photo; uploads get
  "Qualities are computed in advance for the example photos only."):
  - study images carry a tag "Design rendering" or "360° panorama" above the
    outcome (prompt 052);
  - all three principles (rhythm and variety, active ground floor, tactile
    materials) at once, without a switch (prompt 055);
  - the greyed photo with the evidence of all three image measures: regions
    that support a principle in bluish green, against it in vermilion,
    context in sky blue (shown when its legend item is hovered or focused;
    line evidence is drawn as lines), outlined in the principle's line style
    (rhythm solid, ground floor dashed, materials dotted) and filled while
    its legend item is hovered or focused; one legend under the photo in
    three parts, each headed by the principle and its line style, gives each
    region's role and share;
  - a toggle "Show the AI judgement's boxes" for the graded panel's boxes of
    all three principles, drawn dashed in yellow, each labelled with its
    principle and as AI judgement;
  - the three outcomes side by side, one card per principle: the outcome as
    text ("Likely present", "Likely absent", "Unclear") and its reasons, with
    the indicators with plain names and a note on how the measure works and
    its main limits under "The numbers", collapsed;
  - on the ground-floor card, under the reasons, the frontage grade (prompt
    062): "Frontage grade D · adapted from the Urban Design Compendium (Table
    5.3), estimated from the photo …", with "the range depends on the assumed
    lens" for a range and the warning that doors are often missed; without
    enough frontage, "No frontage grade: less than 20 m of frontage within
    60 m of the camera."; nothing where no horizon was found. "The numbers"
    add the counted length, entrances and all openings per 100 m, the blind
    or passive share and the counts. Computed by
    `tools/qualities/frontage.py`:
    - frontage columns within 60 m of the camera, from the façade base row
      (smoothed) and the horizon: in a perspective photo a level pinhole
      camera at 1.6 m with an assumed horizontal field of view of 60° (45° and
      75° for the range), in a panorama the exact geometry of prompt 051;
      steps over 3 m between neighbouring columns break the length;
    - entrances and shopfronts as mask components of at least 20 cells on
      the ground floor; windows as SAM 3 instances scoring at least 0.65 with
      their centre on the ground floor and outside entrances and shopfronts;
    - per 100 m, with B/P the blind or passive share (closed or windows-only
      columns): A entrances > 15, openings > 25, B/P < 10%; B ≥ 10, > 15,
      < 25%; C entrances ≥ 6, B/P < 50%; D entrances ≥ 3; E otherwise.
      Entrances stand in for premises; depth, relief, materials and details
      are not measured;
  - "Definitions", collapsed: per principle "Our definition" (the
    operational definition), and "In the original study" (14 experts judged
    whole photos as present, absent or ambiguous; they named the principles
    without defining them and did not judge these photos);
  - "Methods for this photo": one row per method — the image measure, the
    simulated panel (present/absent and 0–4), the UP-CLIP reproduction and
    plain CLIP (principle score and rank, marked "adaptation") — with a
    column per principle and "Checked against experts? No" with what was
    checked instead, and the caption "These methods are compared with each
    other, not with experts.";
  - attention ÷ size of the image measures' evidence regions per ready
    layer, grouped by principle, with the Areas rules; never for the panel's
    boxes or UP-CLIP;
  - "All example photos": every example photo (the study images under their
    own heading) with, per principle, the image measure, the panel's
    two verdicts and the UP-CLIP reproduction's score, the outcome counts and
    the notes on principles that do not vary; choosing a photo's name
    selects it.
  - at the end, **"Descriptions and photos · UP-CLIP"** (prompt 048), on
    every example photo (also those without image measures), nothing on
    uploads: a switch between "UP-CLIP reproduction" and "Plain CLIP"; the
    five descriptions that best match the photo, with their similarity to
    three decimals and a badge "Perception word · as published" or
    "Principle description · adaptation"; a list of all descriptions,
    grouped by kind, and the eight example photos that best match the chosen
    one as thumbnails in order with their similarity (choosing one selects
    it); a caption saying that UP-CLIP's trained model is not published and
    this is the authors' script re-run on 1,000 of the 15,000 pairs, that
    scores compare descriptions within one model only, that the principle
    descriptions are an adaptation, and that CLIP cannot show where a match
    comes from; and the reproduction's retrieval figures behind "How well
    does the reproduction retrieve?".
- **Simulated panel** (in the Qualities view since prompt 047, at the end;
  example photos only, nothing on uploads), from `public/precomputed/vlm-panel/panel.json` (`tools/vlm-panel/`):
  - the verdict on each of the three principles of Spanjar & Suurenbroek
    (2020): horizontal–vertical rhythm and variety, active ground floor,
    tactile materials;
  - eight members (four designer roles × two seeds) of one local
    vision-language model (Qwen3-VL). A verdict is "Present" or "Absent" when
    at least 6 of 8 agree, otherwise "No consensus";
  - shown as text with the votes and one evidence sentence, not as colours;
  - a principle whose Fleiss' kappa is `null` (the same verdict on every
    photo) carries the note "The model gave this verdict for every example
    photo, so it does not tell the photos apart."
  - a **graded run** of the same eight members (`panel-graded.json`, prompt
    044; `tools/vlm-panel/prompt_graded.md`, fixed before the run) rates each
    principle from 0 to 4 (0 absent, 1 a trace, 2 partly present, 3 clearly
    present, 4 strongly present throughout), with one evidence sentence and up
    to three boxes around the supporting elements, converted from Qwen3-VL's
    relative 0–1000 `bbox_2d` to the mask grid. Shown as the median and range
    of the eight ratings. It is an AI judgement too, with Krippendorff's alpha
    (ordinal) for agreement among members and the share of medians within 0.5
    in a second run for stability. Neither its ratings nor its boxes are ever
    combined with gaze statistics.

**Example comparisons** (prompt 058)

- Three comparisons, A against B, from the owner's package of 2026-10-19:
  entrance (zurich-42 against a blue-teal surround around the doorway),
  greenery (zurich-33 against low planting along the building base) and
  glazing (opaque against transparent versions of the same three window
  bays of zurich-53, both edited, both with the same unplanted containers).
  The edited images were 1448 × 1086 px and are scaled to 1280 × 960 px, the
  size of the originals, so the two images share one grid and one set of
  masks (alignment within about 3 px).
- Every map is computed in advance, so nothing runs when the section opens:
  DeepGaze IIE and MSDB by `tools/deepgaze-local/`, Classic salience and
  UNISAL by the app's own code in headless Chromium
  (`tools/comparisons/browser-models.mjs`, into
  `public/precomputed/comparisons/<model-id>/`), and the automatic areas by
  `tools/areas/build.py` (categories and ground floor; SAM 3 façade elements
  only when `elements.py --apply --only-missing` runs on the laptop).
- **Manipulated area** (prompt 067): the one area of interest of each
  comparison, the same pixels in A and B (`tools/comparisons/regions.py`,
  masks at 640 × 480 in `public/precomputed/comparisons/<id>.json`).
  Entrance: the door and its recoloured surround, i.e. the bounding rectangle
  of the frame found from the change in blueness between A and B, extended
  down to the step, where the plants hide the frame's legs. Greenery and
  glazing: where the edit changed the image, from the pixel difference
  between A and B inside a search box set around the described change. No
  other area (automatic areas, the lower third) is measured in this section.
- Each comparison is described in a fixed format (prompt 066): **Question**
  (one short sentence), **Background** (only what the question needs),
  **Conditions** (A, B and what is manipulated) and **Possible outcomes**
  (two that can be contrasted), followed by "What the selected model
  predicts".
- **Effect** (prompt 068), for the selected model only: its predicted map is
  a gaze density summing to 1 over the image; summed over the manipulated
  area it gives one value per condition, Σ A and Σ B (the share of all
  predicted attention in the area). The contrast B − A, in percentage
  points, gives the direction of the effect: positive = more predicted
  attention in B, negative = less, below 0.05 points = no change. The page
  states this computation. A table lists Σ A, Σ B, B − A and the Pearson r
  between the two maps for every model, the selected one highlighted. The
  possible outcomes are labelled as hypotheses; a result that matches
  neither is shown as it is.
- No measured gaze in the Example section (prompt 068): it exists only for
  the untouched originals, so it cannot show an edit's effect; a note says
  so. An edited image never shows a measured layer or fixation points
  anywhere, and its place line reads "edited for the Example section,
  predictions only".
- View (prompt 067): A, B and the difference B − A of the chosen predicted
  map (blue–orange, as in Contrast, over B) side by side; one column at phone
  width. A "Highlight manipulated area" checkbox, on by default, outlines the
  manipulated area on all three. Each image opens in the workspace, where
  every view works on it.
- Colour bars (prompt 068) under each image. A and B are drawn on one scale,
  from the lower minimum of the two maps to the 99th percentile of both
  (values above it saturate), so their colours compare; the difference on a
  scale symmetric around zero to the 99th percentile of its magnitude. Ticks
  are densities as multiples of the image average (1 / number of grid
  cells).

**Rating page** (prompt 059)

- `/eek-a-look/rate.html` (`rate.html`, `src/rate.ts`, `src/rate.css`), built
  with the site, not linked from the main page, `noindex`. Raters judge each
  of the 49 example photos on the three principles on the 2020 panel's scale
  (present, ambiguous, absent), in their own professional judgement.
- It shows: an introduction, the scale, the rubric "What to look at"
  (collapsible; the wording of `rating_rubric.md` in the developer notes), a
  field for the rater's initials, one photo at a time with its place, its
  kind for study images (design rendering, 360° panorama) and its credit,
  the three questions and an optional note, "Previous", "Next", "Next
  unrated" and "Photo n of 49 · k of 49 rated".
- The order is shuffled per rater, seeded by the initials. Answers are kept
  in the browser (`localStorage`); the page works without it.
- "Download ratings (CSV)" (needs initials) gives the labels format of
  `agreement.py`: photo, principle, label, rater, note; one row per photo and
  principle. No ratings leave the browser otherwise.
- The page shows no photo title, outcome, measure, panel answer, UP-CLIP
  score, heatmap or gaze.
- `agreement.py --labels` takes one or more files and reports Krippendorff's
  alpha among raters per principle (nominal, and ordinal with absent <
  ambiguous < present) before each method's agreement with the majority
  label.

**Honesty** (binding on all visitor-facing text)

- Every predicted heatmap carries the label **"Predicted"**. The measured map
  carries **"Measured"**, in its own colour, and is never presented as a
  prediction. A predicted map with the measured fixation points over it adds
  **"with measured fixations"** to its label (prompt 056).
- The page states, near the top, that these are predictions, not measured gaze,
  except the "Measured gaze" layer on the Zürich photos.
- The Areas view carries the label **"Automatic areas · not an expert
  judgement"** and the caption "Areas are found automatically and can be
  wrong."
- The Qualities view carries the label **"Image measures · not an expert
  judgement"** (with the panel's boxes shown: "Image measures · boxes: AI
  judgement · neither is an expert judgement").
- The simulated panel is headed **"Simulated panel · AI judgement, not
  experts"**, and its caption says that no experts judged these photos, so it
  is not validated. Its verdicts are never combined with gaze statistics.
- Benchmark figures are quoted only with their source and retrieval date. v1
  uses MIT300 figures from <https://saliency.tuebingen.ai/results.html>,
  retrieved 2026-10-18:

  | Model | CC | AUC-Judd |
  |---|---|---|
  | UNISAL | 0.7851 | 0.8772 |
  | DeepGaze IIE | 0.8242 | 0.8829 |
  | DeepGaze MSDB | 0.8832 | 0.8942 |

  Display these to two decimals.
- The Example section says that its comparisons are illustrations, not
  studies, and that a change in predicted attention does not show a change in
  wellbeing, preference or actual use.
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
  (blue → neutral → orange). The pale middle of the table is skipped
  (indexed from 0.3 of each half) and alpha = 0.92·|t|^0.75, so small
  differences tint rather than veil the photo.
- No rainbow or "jet" colour maps.

## Naming and voice

- The product name is always lower case: **eek-a-look**.
- Visitor-facing model names: "Classic salience" and "UNISAL"
  (subtitle "small neural network"). The measured layer is "Measured gaze"
  (subtitle "48 people, eye tracking").
- A vision-language model's verdict is called an **"AI judgement"**, never an
  expert judgement or an assessment.
- The outcome of a rule in *Architectural qualities* is called an **"image
  measure"**, with the outcomes "Likely present", "Likely absent" and
  "Unclear"; never an assessment or an expert judgement.
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
  labelled as measured, never mixed with predictions. A heat map published as a
  figure is linked, never digitised into a map.
- Not listed on the eelkedevries.com Projects page.
- Prompt files live in `docs-dev/agent/prompts/`.
