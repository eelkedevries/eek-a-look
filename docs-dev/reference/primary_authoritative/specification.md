# Specification

**Version:** 0.22 · **Last updated:** 2026-10-19

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
for rhythm together with τ; the calibration kept 0.65 (prompt 041b).

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
  **contrast** of two maps, **agreement scores**;
- an **Areas** view for the example photos: automatic areas and attention ÷
  size per area and layer;
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
  horizon: { row: number; method: 'vanishing-lines' | 'standing-people' | 'assumed-level'; support: number };
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
- **Fixation points:** the fixations behind each map (after steps 1–2 of the
  recipe) are also written to `<photo-id>.points.json`. An inspector checkbox
  "Show fixations (raw data)", off by default and present only on photos with
  measured data, draws them as cyan dots over the "Measured gaze" map in
  "Single map", "Side by side" and "Contrast", and over no other map. The
  heatmap strength does not dim them.

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

**Derived views**

- **Best model** = the best available neural model for the photo: MSDB, then
  IIE, then UNISAL.
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
    "Side by side", "Contrast" and "Areas";
  - an inspector: the layers (choosing one opens it in "Single map"), the
    Contrast selectors with "Reset to the best model", the heatmap strength
    (also applied in "Side by side") with its legend, on photos with measured
    gaze the "Show fixations (raw data)" checkbox, the match with the
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
- **Simulated panel** (under the Areas table; example photos only, nothing on
  uploads), from `public/precomputed/vlm-panel/panel.json` (`tools/vlm-panel/`):
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

**Honesty** (binding on all visitor-facing text)

- Every predicted heatmap carries the label **"Predicted"**. The measured map
  carries **"Measured"**, in its own colour, and is never presented as a
  prediction.
- The page states, near the top, that these are predictions, not measured gaze,
  except the "Measured gaze" layer on the Zürich photos.
- The Areas view carries the label **"Automatic areas · not an expert
  judgement"** and the caption "Areas are found automatically and can be
  wrong."
- The simulated panel is headed **"Simulated panel · AI judgement, not
  experts"**, and its caption says that no experts judged these photos, so it
  is not validated. Its verdicts are never combined with gaze statistics.
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
  (blue → neutral → orange). The pale middle of the table is skipped
  (indexed from 0.3 of each half) and alpha = 0.92·|t|^0.75, so small
  differences tint rather than veil the photo.
- No rainbow or "jet" colour maps.

## Naming and voice

- The product name is always lower case: **eek-a-look**.
- Visitor-facing model names: "Centre bias", "Classic salience" and "UNISAL"
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
  labelled as measured, never mixed with predictions.
- Not listed on the eelkedevries.com Projects page.
- Prompt files live in `docs-dev/agent/prompts/`.
