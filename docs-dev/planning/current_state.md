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

- v1 is live at https://eelkedevries.com/eek-a-look/ (prompts 001–011).
- About section (`src/views/about.ts`): models from the registry, MIT300 table
  (re-checked 2026-10-18), limitations, privacy and credits from the manifest.
- Page shell (`index.html`, `src/style.css`): site look, self-hosted fonts
  (`@fontsource`, Latin subsets), local-only upload (`src/image-input.ts`),
  app state (`src/state.ts`) and a stage frame for stacked layers (`src/stage.ts`).
- Five models: three in the browser, DeepGaze IIE and MSDB pre-computed for the
  examples (`src/models/deepgaze.ts`, `public/precomputed/`).
- Measured gaze (prompts 018–020): `tools/measured-gaze/` builds measured maps
  for 12 Zürich photos (Wilming et al. 2017, CC0) into
  `public/precomputed/measured/`. `src/models/measured.ts` is the "Measured
  gaze" layer, listed first and labelled "Measured" in blue. It exists only on
  photos with `measured` in the manifest (`ModelSpec.covers`, `modelsFor()` in
  `src/results.ts`), and stays out of `NEURAL_PREFERENCE` and the agreement
  matrix. The agreement view adds "Match with measured gaze".
- Maps and models: `src/maps/saliency-map.ts` (grid, normalise, resample,
  Pearson, difference), `src/render/` (magma and blue–orange tables, heatmap
  drawing), `src/models/` (types, registry, centre bias, classic salience in a Web Worker
  at `src/models/classic-salience/`), `src/results.ts` (runs
  every model per image) and `src/views/` (tabs; overlay with model selector and slider; side by side;
  "What AI adds" = UNISAL − centre bias; agreement = Pearson r per pair).
- UNISAL in the browser: `src/models/unisal/` (onnxruntime-web 1.30.0, CPU
  WASM in a Web Worker; about 0.1–0.35 s per photo on a desktop). Dev check
  `?check=unisal` compares with the export's reference output (r = 0.9937).
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

v1 and rounds two to four (prompts 012–020) are complete. The fifth round is
planned, not run: automatic areas in the image (OneFormer categories, a 4 m
ground-floor rule, façade elements from a measured model comparison),
attention ÷ size per area, checks against eTRIMS and CMP Facade, and a
simulated panel with Qwen3-VL (prompts 021–026; `docs-dev/plan.md`, sources in
`docs-dev/reference/secondary_background/areas_sources.md`). SAM 3 access is
pending Meta's manual review; it joins prompt 023's comparison once granted.
Later work is listed in `docs-dev/plan.md` (*Later*).

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
- `009_unisal_browser.md` (CPU WASM only, see spec 0.4). Follow-up fixes:
  `public/.htaccess` sets types for .mjs/.wasm/.onnx, and the live site loads a
  gzip copy of the 14 MB runtime (3.7 MB) because the host does not compress it.
- `010_comparison_views.md`
- `011_about_and_copy.md` (live checks on 2026-10-18: Lighthouse mobile
  performance 98, accessibility 100, best practices 100, CLS 0.003; no
  third-party requests; no console errors; UNISAL ready about 1.5 s after load)
- `012_warm_heatmap.md` (YlOrRd; overlay slider now defaults to 100 %)
- `013_deepgaze_precompute.md` (`tools/deepgaze-local/`; IIE about 0.4 s and MSDB
  about 1 s per photo on the RTX 4070, peak 3.1 GB; 24 maps, 0.69 MB)
- `014_deepgaze_in_app.md` (five models; MSDB is the default overlay, with a
  fallback to UNISAL for uploads; agreement is now a matrix)
- `015_local_live_helper.md` (`npm run local`: GPU helper plus preview server;
  DeepGaze runs live on any photo on the laptop; the public site never probes it).
  Live checks after round two: Lighthouse mobile 99 / 100 / 100, CLS 0.003, no
  third-party or local-api requests, no console errors.
- `016_method_explanations.md` (bottom section: per method, its heatmap and a
  ~100-word explanation from `src/content/methods.ts`, checked by
  `scripts/check-method-texts.mjs`; the helper probe now exists only in
  `npm run local` builds)
- `017_inferno_greyed_photo.md` (inferno over a greyed photo; each photo is
  greyed once and cached; the overlay's grey layer fades with the slider)
- `018_measured_gaze_data.md` (spec 0.8: measured eye tracking allowed from open
  datasets. `tools/measured-gaze/` adds 12 Zürich photos from Wilming et al.
  (2017, CC0) and their measured maps in `public/precomputed/measured/`; 48
  observers and 805–929 fixations per photo)
- `019_deepgaze_measured_photos.md` (`precompute.py --only-missing`; the 24
  Zürich maps were made on the CPU in 7 min 14 s, MSDB about 33 s per photo.
  Mean r with the measured maps: IIE 0.74, MSDB 0.81)
- `020_measured_gaze_in_app.md` (spec 0.9: the "Measured gaze" layer and "Match
  with measured gaze" on the Zürich photos; absent on the Dutch photos and on
  uploads)
- `021_area_categories.md` (spec 0.10; `tools/areas/`: OneFormer street
  categories and the 4 m ground floor for the 24 photos, 0.59 MB, peak 2 GB.
  The horizon came from façade lines on 17 photos; on photos looking up at
  towers the fallback makes the ground floor too tall, and where all bases are
  hidden it is empty)
- `021b_horizon_from_people.md` (spec 0.12: horizon from standing people when
  façade lines fail. Now 17 photos use façade lines, 2 people and 5 the middle
  row; weena-stationsplein's ground floor fell from 34.6% to 3.8% of the
  photo. eTRIMS door share unchanged at 0.914)
- `022_area_validation.md` (eTRIMS IoU: façade 0.96, sky 0.98, street surface
  0.92, vehicles 0.93, greenery 0.88; CMP façade 0.84. 91% of eTRIMS door
  pixels lie inside the computed ground floor. Area ratios match measured gaze
  on Zürich: MSDB ρ 0.91, IIE 0.82, centre bias 0.42. Report:
  `docs-dev/reference/secondary_background/areas_validation.md`)
- `023_element_models.md` (spec 0.11; `tools/areas/elements.py` compared
  Grounding DINO + SAM 2.1, OWLv2 + SAM 2.1, Florence-2 + SAM 2.1 and SAM 3 on
  CMP Facade and eTRIMS. SAM 3 won all four elements (mean test IoU: windows
  0.66, entrances 0.55, balconies 0.57, shopfronts 0.36) and its masks are in
  the area files. Glass curtain walls are not seen as windows; "storefront"
  sometimes covers a station hall or a shelter roof)
- `024_vlm_panel.md` (`tools/vlm-panel/`: Qwen3-VL-8B in 4-bit, peak 7.26 GB,
  42 s per photo for 8 members. Active ground floor: kappa 0.94, 97% stable,
  ρ 0.53 with the entrance + shopfront share of the ground floor (exploratory).
  Rhythm and materials were "present" on all 24 photos, so they do not
  discriminate)
