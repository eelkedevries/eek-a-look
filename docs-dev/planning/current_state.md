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
- Page shell (`index.html`, `src/style.css`): since prompt 028 a workspace —
  top bar, photo library (`mountLibraryFilter()` in `src/examples.ts`),
  views, inspector (`src/views/inspector.ts`) and status bar; the shared
  choices (open view, single-map layer, heatmap strength) live in
  `src/view-state.ts`. Site look, self-hosted fonts
  (`@fontsource`, Latin subsets), local-only upload (`src/image-input.ts`),
  app state (`src/state.ts`) and a stage frame for stacked layers (`src/stage.ts`).
- Four models (the centre-bias layer was removed in prompt 032): two in the
  browser, DeepGaze IIE and MSDB pre-computed for the
  examples (`src/models/deepgaze.ts`, `public/precomputed/`).
- Areas (prompts 021–025): `tools/areas/` pre-computes, on the laptop GPU, nine
  street categories (OneFormer), the ground floor (a 4 m rule from the horizon)
  and windows, entrances, balconies and shopfronts (SAM 3, chosen in a measured
  comparison) into `public/precomputed/areas/`, with checks against eTRIMS and
  CMP Facade in `validation.json`. The "Areas" tab (`src/views/areas.ts`,
  `src/maps/areas.ts`) shows outlines and attention ÷ size per area and layer
  for the example photos only.
- Qualities (prompts 040–): `tools/qualities/` computes image measures for the
  three design principles of Spanjar & Suurenbroek (2020) from the area files,
  with this project's operational definitions and fixed rules (spec,
  *Architectural qualities*), into `public/precomputed/qualities/`. Each
  measure has an outcome, reasons, indicators and evidence masks.
- Measured gaze (prompts 018–020): `tools/measured-gaze/` builds measured maps
  for 12 Zürich photos (Wilming et al. 2017, CC0) into
  `public/precomputed/measured/`. `src/models/measured.ts` is the "Measured
  gaze" layer, listed first and labelled "Measured" in blue. It exists only on
  photos with `measured` in the manifest (`ModelSpec.covers`, `modelsFor()` in
  `src/results.ts`), and stays out of `NEURAL_PREFERENCE` and the agreement
  matrix. The agreement view adds "Match with measured gaze". Since prompt
  030 the inspector's "Show fixations (raw data)" draws the fixations
  (`<id>.points.json`, `src/render/fixations.ts`) over the measured map only.
  Since prompt 069 a second source, Andersson et al. (2017, GNU GPL 3.0): four
  photos (`andersson-*`, group "Andersson et al. (2017)", 2–5 people each)
  with fixations from hand labels (`fetch_andersson.py`,
  `build_andersson.py`). The layer's subtitle follows the photo's number of
  people; `city` is optional for this group; the rating page leaves it out.
  Their area files have SAM 3 façade elements and their quality files all
  three measures since prompt 072; no UP-CLIP scores or panel.
- Maps and models: `src/maps/saliency-map.ts` (grid, normalise, resample,
  Pearson, difference), `src/render/` (magma and blue–orange tables, heatmap
  drawing), `src/models/` (types, registry, classic salience in a Web Worker
  at `src/models/classic-salience/`), `src/results.ts` (runs
  every model per image) and `src/views/` (tabs; overlay with model selector and slider; side by side
  with r against the reference and a shared pointer ring; contrast = any two
  maps, by default against `bestModel()` in `src/results.ts`; agreement =
  Pearson r per pair). "What AI adds" was removed in prompt 027.
- UNISAL in the browser: `src/models/unisal/` (onnxruntime-web 1.30.0, CPU
  WASM in a Web Worker; about 0.1–0.35 s per photo on a desktop). Dev check
  `?check=unisal` compares with the export's reference output (r = 0.9937).
- UNISAL conversion: `tools/unisal-export/` (`uv run export.py`) writes
  `public/models/unisal/` (ONNX fp16, 6.4 MB, dynamic input size; the Gaussian
  priors are a second input built from `model.json`). Verified against PyTorch on
  all 12 photos: r = 1.00000 (fp32), ≥ 0.99999 (fp16).
- Study images (prompt 031): 25 CC BY images from two published eye-tracking
  studies, group "From published studies", with predictions only; the `study`
  field links each to its published heat map, which is never made a layer.
- Example section (prompt 058, `src/views/example.ts`, `example.css`, text in
  `src/content/comparisons.ts`): three design comparisons (entrance,
  greenery, glazing) on four edited Zürich images listed in
  `public/examples/comparisons.json`, outside the library. All maps and
  areas are pre-computed; Classic salience and UNISAL by the app's code in
  headless Chromium and the manipulated areas by `tools/comparisons/`. Since
  prompt 067 each comparison shows A, B and the difference B − A side by side
  and measures one manipulated area only (entrance: the door and its
  recoloured surround; since prompt 071 the whole stone block, recoloured by
  rule in `tools/comparisons/recolour.py`). Since prompt 071b examples 2 and
  3 are FLUX.1 Kontext edits (a tall hedge; the whole frontage opaque or
  transparent), registered and pasted over the originals only where they
  change them by `tools/comparisons/composite.py`. Since prompt 068: colour bars, A and B on one
  colour scale (`sharedRange()` in `src/render/heatmap.ts`), the selected
  model's Σ A, Σ B and B − A with its direction, and no measured gaze in the
  section. The edited images have SAM 3 façade elements since prompt 072.
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

Seventh round run (2026-10-19, prompts 051–057). Eighth round run
(2026-10-19, prompts 059–065, `docs-dev/plan.md`), from
`qualities_improvement_research.md`. What it changed: a rating page for human
raters (`rate.html`), the panel as observer, an adapted frontage grade, an
outcome scale with method disagreement, and panoramas in cube faces. What it
did not: rectified spacing, translational symmetry and surface detail did not
beat the current measures on held-out labels, so those rules are unchanged.
On 2026-10-19 the 15 Guangzhou panoramas and all panorama rules and code were
removed at the owner's request (spec 0.52–0.53); the example set is now 38
images (34 rated and measured on all three principles), and the summaries in
`checks.json`, `scores.json` and `panel-observed.json` were recomputed from the
stored per-photo results.
Next: ratings from at least three raters through `rate.html`, then
`uv run agreement.py --labels …`; no outcome has been checked against people
yet.

Sixth round (2026-10-19, prompts 040–048, all run, `docs-dev/plan.md`): image measures
with spatial evidence for the three design principles (`tools/qualities/`),
checks against human labels, a graded simulated panel, and a reproduction of
UP-CLIP from the authors' public 1k sample, since no trained checkpoint is
published (`docs-dev/reference/secondary_background/qualities_sources.md`).
All shown in a new "Qualities" view.

v1 and rounds two to four (prompts 012–020) are complete. The fifth round
(021–027) is complete; its original plan was: automatic areas in the image (OneFormer categories, a 4 m
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
  on Zürich: MSDB ρ 0.91, IIE 0.82. Report:
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
- `025_areas_view.md` (spec 0.13: the Areas tab; its ratios match
  `validation.json` exactly on zurich-23)
- `026_vlm_panel_in_app.md` (spec 0.14: the simulated panel's verdicts under
  the Areas table, with notes on rhythm and materials, which did not vary)
- `040_frontage_evidence.md` (spec 0.18: active ground floor from frontage
  columns. Three photos with an assumed horizon got a ground floor covering
  the whole façade, so their outcomes were artefacts)
- `040b_frontage_assumed_horizon.md` (spec 0.19: assumed horizon → Unclear.
  Ground floor now 1 likely present, 13 likely absent, 10 unclear)
- `041_rhythm_evidence.md` (spec 0.20: rhythm from the spacing of SAM 3
  window and balcony instances in 160 px windows, τ calibrated on even CMP
  images (bays 0.15, floors 0.10; balanced accuracy 0.78 and 0.80), colour
  zones for variety. The prompt's 64 px windows and line segments failed on
  the calibration images and were replaced there; glass façades and
  arcades read as plain)
- `041b_rhythm_instance_threshold.md` (spec 0.22: the SAM 3 score for
  counting instances calibrated with τ; CMP kept 0.65. Rhythm: 11 likely
  present, 7 unclear, 6 likely absent)
- `042_material_evidence.md` (spec 0.23: DMS46 materials near eye level,
  textured / smooth / neutral groups. 6 likely present, 10 unclear, 8 likely
  absent; dark brick façades can read as plaster)
- `043_quality_checks.md` (`checks.json`, `qualities_validation.md`: rhythm
  on odd CMP balanced accuracy 0.79 / 0.78; frontage open share ρ 0.64 with
  labels, 65% same outcome, SAM 3 leans to closed; DMS grouping 77% of
  pixels on 85 DMS test photos; at most 5 of 24 outcomes change per
  threshold; every measure separates the photos. Expert-label template and
  `agreement.py`)
- `049_measured_gaze_default.md` (spec 0.25: the single map opens on
  measured gaze with its fixations on the Zürich photos; elsewhere the best
  model, which the inspector now marks as shown)
- `050_fixation_toggle.md` (spec 0.27: fixation dots at 65% opacity; the
  checkbox also sits under the image, in step with the inspector's)
- `044_vlm_panel_graded.md` (spec 0.28: the panel rated 0–4 with evidence
  boxes, `panel-graded.json`. Alpha 0.95 / 0.81 / 0.67; rhythm still 3–4 on
  every photo, ground floor 1–3, materials 2–3; 70/72 medians stable; boxes
  64–83% inside the matching region)
- `045_upclip_reproduction.md` (`tools/up-clip/`: no UP-CLIP checkpoint is
  published, so the authors' script was re-run on their 1k sample, batch 32
  with gradient checkpointing and 8-bit AdamW; best epoch 8. Recall@5 on 200
  held-out pairs 0.40 / 0.34 against plain CLIP 0.19 / 0.16; report
  `upclip_reproduction.md`. Nothing from the authors' repository is in git)
- `046_upclip_scores.md` (spec 0.29: `scores.json` for all 49 example photos,
  both models, 28 descriptions; principle scores agree moderately with the
  other methods on the ground floor (ρ 0.52 with the image measure, 0.65 with
  the graded panel), not on rhythm or materials)
- `047_qualities_view.md` (spec 0.30: the Qualities view, `src/views/qualities.ts`
  and `qualities.css`; the simulated panel moved there from Areas. Attention ÷
  size checked by hand on zurich-23: 0.8465 on the page and by hand)
- `048_upclip_view.md` (spec 0.31: "Descriptions and photos · UP-CLIP" at the end
  of the Qualities view, on all 49 example photos, `src/views/upclip.ts`)
- `051_study_photo_areas.md` (spec 0.32: `imageKind` on the 25 study images;
  areas for them with `--only-missing`, the 24 earlier files unchanged; a
  spherical ground-floor rule for the 15 360° panoramas, checked by hand.
  SAM 3 finds no façade elements in the panoramas)
- `052_study_photo_qualities.md` (spec 0.33: the image measures for all 49 example
  photos, the 24 earlier files unchanged; study images tagged on the page and
  grouped in the all-photos table. Panoramas: no façade elements found, so their
  ground floors read as closed)
- `053_rhythm_glass_facades.md` (no spec change: four ways of finding repeating
  elements compared on odd CMP and LabelMeFacade; mean balanced accuracy A
  0.781 / 0.797, glazed or banded subset 0.825; B lower there (0.755), C and D
  end at A's settings, so A is kept and no quality file changed. The glazed
  subset is only 4 images, so glass façades remain a known limit.
  LabelMeFacade stays in `.cache/`)
- `054_fixation_opacity_slider.md` (spec 0.34: a "Fixation points (raw data)" slider
  below the heatmap strength, 65% by default, on photos with measured gaze)
- `055_qualities_all_at_once.md` (spec 0.35: the Qualities view shows the three
  principles together, no switch: evidence outlined solid / dashed / dotted per
  principle, one legend in three parts, three outcome cards, a column per
  principle in the methods and all-photos tables)
- `056_fixations_on_model_maps.md` (spec 0.36: "Also over the model maps", off by
  default, draws the fixation points over the predicted maps too, which then say
  "with measured fixations"; reverses the measured-map-only rule of prompt 030)
- `057_settings_above_image.md` (spec 0.37: heatmap strength, fixation slider and
  checkboxes in one foldable "Display settings" section between the view tabs and
  the image, `src/views/display-settings.ts`; gone from the inspector and from
  under the image, `fixation-toggle.ts` removed)
- `058_example_comparisons.md` (spec 0.38: the Example section, from the
  owner's package of 2026-10-19; computed on a CPU in a cloud session, which
  reproduced committed DeepGaze maps and OneFormer categories exactly)
- `059_rating_page.md` (spec 0.39: `rate.html`, a rating page for human raters with
  the rubric of `rating_rubric.md`, ratings downloaded as CSV; `agreement.py`
  takes several files and reports Krippendorff's alpha among raters; template
  for 49 photos. No ratings collected yet)
- `062_frontage_grade.md` (spec 0.40: frontage length within 60 m, entrances and
  openings per 100 m, and a grade adapted from the Urban Design Compendium's
  Table 5.3; outcomes unchanged. E 26, D 3, D–E 2, none 18; a check by eye found
  doors missed and first-floor windows counted, so the grade leans low)
- `066_example_study_format.md` (spec 0.41: each comparison as question,
  background, conditions and two possible outcomes)
- `067_example_three_panels.md` (spec 0.42: A, B and the difference side by
  side, the manipulated area only, a "Highlight manipulated area" checkbox;
  the entrance area is now the door and its recoloured surround, 1.0% of the
  image instead of 1.4%)
- `068_example_effect_per_model.md` (spec 0.43: colour bars, one colour scale
  for A and B, the selected model's sums over the manipulated area and their
  contrast, measured gaze left out of the section)
- `070_example_density_terms.md` (spec 0.47: "predicted gaze density"
  throughout the section; a colour bar with a blue/orange key for the
  difference image only)
- `071_example_larger_entrance.md` (spec 0.50: example 1's B recoloured by
  rule, the whole stone entrance block in blue-teal, 3.4% of the image; all
  four models now predict a higher gaze density on it in B, +0.7 to +4.4
  points. Examples 2 and 3 not enlarged: the FLUX Kontext Space needs a
  Hugging Face token)
- `071b_example_larger_edits.md` (spec 0.51: examples 2 and 3 enlarged with
  FLUX.1 Kontext once a Hugging Face token was added as a network secret for
  `*.hf.space`: hedge 17.8% and frontage 21.1% of the image)
- `072_sam3_cloud_elements.md` (spec 0.54: SAM 3 façade elements for the four
  Andersson photos and the four Example edits, run in a cloud session on a
  CPU (39 min) with a Hugging Face network secret for `huggingface.co`; then
  the Andersson ground-floor and rhythm measures: ground floor unclear ×4,
  rhythm present (Colosseum), absent (planted façade), unclear ×2)
- `065_rhythm_rectified.md` (no spec change: rectified spacing R and translational
  symmetry S against held-out labels; balanced accuracy on odd CMP A 0.781, R 0.776,
  S 0.613, and R's precision lower, so A is kept and no quality file changed. A
  first run rectified almost no windows because of a scale bug in the stretch
  check; fixed before the recorded run)
- `064_outcome_scale.md` (spec 0.49: each card shows its main indicator on a scale
  with the rule's bands, the other methods' labels and "Methods disagree"; ≠ in
  the all-photos table)
- `060_panel_observations.md` (spec 0.44: `panel-observed.json`, the panel answers
  visible questions and a fixed rule rates them; probability-weighted graded ratings.
  Ratings now span 0–4 and weighted ones 21–37 values; on ordinary photos rhythm is
  still 4 on 21 of 24. ρ with the image measure: ground floor 0.68, rhythm 0.56,
  materials 0.08)
- `063_surface_detail.md` (spec 0.45: `surfaceDetail` in the materials indicators;
  on DMS labels it did not separate textured from smooth (AUC 0.44, brick
  against plaster 0.27) and the rule change lowered accuracy, so it was not
  adopted; outcomes unchanged)
- `069_andersson_measured_gaze.md` (spec 0.46: four photos of Andersson et al.
  (2017, GNU GPL 3.0) with measured gaze from coder MN's hand labels, 2–5
  people and 64–144 fixations each; RA's labels give maps with r 0.98–1.00.
  DeepGaze, areas and materials computed on a cloud CPU with `--only-missing`,
  no existing file changed; MSDB r with measured gaze 0.43–0.80. No horizon
  was found on any of the four, so materials read Unclear; SAM 3 elements,
  ground floor and rhythm, the panel and UP-CLIP are left for the laptop)
- `061_panoramas_perspective.md` (spec 0.48: elements and rhythm of the 360°
  panoramas in four cube faces, `tools/areas/panorama.py`. Few elements found (4
  of 15 panoramas; two of three checked by eye wrong); rhythm unclear → likely
  absent on 7 panoramas because more façade cells now count; ground floors
  unchanged)
