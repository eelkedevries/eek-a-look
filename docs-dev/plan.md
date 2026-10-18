# eek-a-look: plan for v1

**Agreed:** 2026-10-18 · **Target:** v1 live by 2026-10-25

The binding detail is in
[`reference/primary_authoritative/specification.md`](reference/primary_authoritative/specification.md).
This file is the short overview.

## Goal

A public page at <https://eelkedevries.com/eek-a-look/> that shows where people
are *predicted* to look in a streetscape photo. It shows three models side by
side, so visitors can see what a neural network adds over two simple baselines.
Everything runs in the visitor's browser.

## Decisions (Q&A of 2026-10-18)

| Topic | Decision |
|---|---|
| Repository | Public |
| Hosting | SiteGround. A small workflow in the eelkedevries.com repository, which already has the SSH secrets, builds this public repository and rsyncs it to `/eek-a-look/`. It is started with `npm run deploy`. No secrets to add, no GitHub Pages |
| Audience | General public: the tool comes first, with short explanations |
| Language | English (British) only |
| Deadline | v1 live within one week |
| Models | Centre bias · classic salience (Itti–Koch style) · UNISAL (small neural network) |
| Visitors' photos | Upload only, no camera capture. Processed on the device and never sent anywhere |
| Example photos | Openly licensed Wikimedia Commons photos with credits, replaced later by the owner's own photos |
| Views | Overlay with an opacity slider · side by side · a "What AI adds" map · agreement scores |
| Drawing areas of interest | Later (v1.1) |
| Real eye-tracking data | Not planned |
| Projects page on eelkedevries.com | Not listed |
| Look | Same as eelkedevries.com (dark theme; Lexend, Spectral, JetBrains Mono) |
| Prompt files | `docs-dev/agent/prompts/` (eek-a-template layout) |

## How v1 works

- **Stack:** Vite + TypeScript with no UI framework, built as a static site under
  the base path `/eek-a-look/`. The project is scaffolded with `eek-a-template`
  v0.3.0.
- **One model interface.** Each model returns a probability map (values sum
  to 1) on a grid matching the image's aspect ratio. A registry lists the models.
  Their runtime is `browser` in v1, and `remote` is reserved for large models
  later.
- **Centre bias:** an anisotropic Gaussian centred on the image (Clarke and
  Tatler, 2014).
- **Classic salience:** our own TypeScript implementation of Itti, Koch and
  Niebur (1998), running in a Web Worker.
- **UNISAL:** converted once to ONNX (fp16, about 7 MB) by a small `uv` script
  in `tools/`. It uses the MIT1003 eye-tracking domain where available and runs
  with onnxruntime-web (WebGPU, falling back to WASM) in a Web Worker. Weights
  are served from our own site.
- **Views** are computed from the three maps: overlay, side by side, the
  difference UNISAL − centre bias ("What AI adds"), and the Pearson correlation
  for each pair of models ("agreement").
- **Privacy:** no analytics, no cookies, no third-party requests. Fonts are
  self-hosted.

## Quality, stated honestly

Scores on MIT300 (a lab benchmark of everyday photos, free viewing), from
<https://saliency.tuebingen.ai/results.html>, retrieved 2026-10-18:

| Model | CC | AUC-Judd | In v1? |
|---|---|---|---|
| Centre bias | 0.45 | 0.78 | yes |
| Itti–Koch family (benchmarked versions) | 0.13–0.43 | 0.54–0.78 | yes (our own implementation, not benchmarked) |
| UNISAL | 0.79 | 0.877 | yes |
| DeepGaze IIE | 0.82 | 0.883 | later, via Hugging Face |
| DeepGaze MSDB (ICCV 2025) | 0.88 | 0.894 | later, via Hugging Face |

The message for visitors: the middle of the picture already explains a lot.
The small network explains clearly more, and the best large models a little
more again. None of these models were tested on Dutch street photos.

## Prompt sequence

The site is deployed early (prompts 002–003), so the SiteGround route is proven
in the first days. From prompt 003 onwards, each prompt that changes the page
ends with `npm run deploy`.

| # | Prompt | Notes |
|---|---|---|
| 001 | `001_setup.md`: make the repository public, complete the template scaffold, Vite + TS | |
| 002 | `002_website_deploy_workflow.md`: in eelkedevries.com, protect `/eek-a-look/` and add `deploy-eek-a-look.yml` | Pushing to eelkedevries.com `main` deploys the site |
| 003 | `003_deploy_command.md`: `npm run deploy` (start, watch, re-run, live check); first deploy | |
| 004 | `004_page_shell.md`: layout, site look, self-hosted fonts, photo upload | |
| 005 | `005_example_photos.md`: 12 Commons photos, credits manifest, picker | |
| 006 | `006_map_core.md`: map type, colour maps, overlay and slider, model registry, centre bias | |
| 007 | `007_classic_salience.md`: Itti–Koch model in a Web Worker | |
| 008 | `008_unisal_export.md`: PyTorch → ONNX fp16, verified against PyTorch | Runs locally with `uv` |
| 009 | `009_unisal_browser.md`: onnxruntime-web inference in a Web Worker | |
| 010 | `010_comparison_views.md`: side by side, "What AI adds", agreement | |
| 011 | `011_about_and_copy.md`: About section, model notes, privacy, credits, README | v1 done |

## Second round (owner's Q&A, 2026-10-18)

| Topic | Decision |
|---|---|
| Overlay colours | Warm heatmap, yellow → orange → red (ColorBrewer YlOrRd), chosen from six rendered options |
| Better models | DeepGaze IIE and DeepGaze MSDB, run on the owner's laptop GPU (RTX 4070), not on Hugging Face |
| How they reach visitors | Maps pre-computed for the example photos are published with the site; uploads keep the browser models |
| Live use | `npm run local` on the laptop runs both models live on any photo, for demos |
| Licence | DeepGaze has no licence file, so its code and weights are never published; only the resulting maps are |

| # | Prompt | Notes |
|---|---|---|
| 012 | `012_warm_heatmap.md`: YlOrRd overlay | |
| 013 | `013_deepgaze_precompute.md`: `uv` tool, GPU, maps for the examples | Runs on the laptop |
| 014 | `014_deepgaze_in_app.md`: two more models, "unavailable" state, agreement matrix | |
| 015 | `015_local_live_helper.md`: `npm run local` with a GPU helper | Laptop only |

## Third round (2026-10-18)

| Topic | Decision |
|---|---|
| Method explanations | One ~100-word paragraph per method under its heatmap, at the bottom of the page (016) |
| Colour map | Inferno over a greyed photo (option C), chosen after a short literature review; replaces the warm map (017) |

## Fourth round: measured eye tracking (2026-10-18)

| Topic | Decision |
|---|---|
| Aim | Compare the models with gaze measured in people, on photos the page can show |
| Source | Wilming et al. (2017), CC0: 12 Zürich street photos, 48 observers each, 6 s free viewing (study "Baseline") |
| Rejected | CAT2000 and MIT1003 (no open image licence); HvA high-rise study (data not public) |
| Automation | Every step downloads and runs without manual work, so a cloud session can do it all |

| # | Prompt | Notes |
|---|---|---|
| 018 | `018_measured_gaze_data.md`: photos, measured maps, specification 0.8 | Done |
| 019 | `019_deepgaze_measured_photos.md`: DeepGaze maps for the Zürich photos | Done (CPU, 7 min) |
| 020 | `020_measured_gaze_in_app.md`: "Measured gaze" layer and match scores; deploy | Done |

## Fifth round: areas in the image (2026-10-18)

**Aim.** Show which parts of a street scene receive attention, in the terms the
HvA *Building for Wellbeing* panels use: before an experiment they classify
photos on three design principles (horizontal–vertical rhythm and variety,
active ground floor, tactile materials; Spanjar & Suurenbroek 2020); after it
they name the elements that draw attention in heatmaps, such as entrances,
balconies, windows and contrasts in light and colour (Spanjar et al. 2024).
The panels never drew regions; eek-a-look adds them automatically and says so.
All sources, licences and the pilot are in
[`reference/secondary_background/areas_sources.md`](reference/secondary_background/areas_sources.md).

| Topic | Decision |
|---|---|
| Street categories | OneFormer ADE20K Swin-L (MIT): the 150 classes grouped into façade, sky, greenery, street surface, people, vehicles, signage, street furniture and other. Every pixel belongs to exactly one category |
| Façade elements | SAM 3, one short noun phrase per call: windows, entrances (doors), balconies, shopfronts. Chosen on published evidence ("the one that should be theoretically better"): mask cgF1 54.1 against 3.3 for Grounding DINO-T on SA-Co/Gold. Gated; its licence asks for an acknowledgement |
| Ground floor | Façade pixels from where each façade meets the ground up to 4 m, computed from the horizon and an eye-height camera (1.6 m). A stated rule, tested for sensitivity |
| Processing | On the laptop GPU, like DeepGaze. Masks are published for the 24 example photos only; uploads say "example photos only". No model weights on the site |
| Display | A new "Areas" tab: outlines on the greyed photo, a legend and a table, tagged "Automatic areas · not an expert judgement" |
| Statistic | Attention ÷ size per area and layer: 1.0× is what the area's size alone predicts. Raw shares alongside; areas under 0.5% of the photo show "–" |
| Validation | Automatic; the owner draws nothing. Scored against public human labels (eTRIMS: 60 street photos; CMP Facade: 378 rectified façades), plus robustness and ground-floor checks. The scoring script takes any folder of label masks, so an expert panel can add its own later |
| Mobile scene video | Designed for (the tool is frame-based and the ground-floor rule suits a head-mounted camera), not built; see *Later* |
| Simulated panel | In this round: Qwen3-VL (Apache-2.0) run locally as eight simulated members on the 2020 panel's three principles and present/absent/ambiguous scale; shown as "AI judgement, not experts" |

**Pilot (2026-10-18).** OneFormer separates sky, façade, pavement, people,
posters and signs cleanly, but never windows or doors at street distance.
Grounding DINO + SAM 2.1 found windows and a glass entrance, yet its
"shopfront" covered a whole building, the multi-category confusion Zeng and
Boehm (2024) describe. Hence SAM 3 with one concept per call. Balconies are the
expected weak spot: no published benchmark covers them.

| # | Prompt | Notes |
|---|---|---|
| 021 | `021_area_segmentation.md`: `tools/areas/`, categories, elements, ground floor; masks for the 24 photos | Needs SAM 3 access first (owner) |
| 022 | `022_area_validation.md`: scores against eTRIMS and CMP Facade; ground-floor and robustness checks | Downloads two public datasets |
| 023 | `023_areas_view.md`: "Areas" tab, attention ÷ size table, credits; deploy | |
| 024 | `024_vlm_panel.md`: `tools/vlm-panel/`, eight simulated members, consensus, stability | Laptop GPU |
| 025 | `025_vlm_panel_in_app.md`: panel judgement on the page; deploy | |

## Later

- **Mobile scene video.** Run the same area tool on scene-camera frames. Assign
  each fixation to the area under the gaze point (or a 1° disc, after Orquin et
  al. 2016). Take the horizon from the headset's IMU (pitch and roll) and the
  camera height from the wearer's eye height, so the ground-floor rule needs no
  estimation. Use SAM 3's tracker to keep areas stable across frames. Precedent:
  MYFix (Alinaghi et al. 2024; Mask2Former on scene video). Check against a few
  hand-labelled frames.
- **Expert-panel annotation.** The group's panel draws the same areas on the
  example photos in any tool that exports label masks; `validate.py --labels`
  then reports their overlap with the automatic areas and how much the
  attention ratios change.
- **Live areas for uploads** through `npm run local` (not chosen now).
- **Visitors drawing their own areas** (the old v1.1 idea).
- **Own photos** to replace the Commons examples (eye level, landscape, the same
  camera height throughout).
- Possibly MSI-Net (MIT licence, TF.js) as a second browser model.
- Not planned: a card on the Projects page (can be revisited).

## Risks

- **UNISAL export to ONNX fails or is inexact.** Fallback: the existing
  community LiteRT conversion (`litert-community/UniSal-Saliency-LiteRT`,
  Apache-2.0; 256×256 square input, SALICON domain) through LiteRT.js. That would
  be a superseding prompt (`008b`).
- **onnxruntime-web WASM is large** (several MB) and needs the correct MIME
  type on SiteGround. It is lazy-loaded after first paint and checked in 009.
- **SiteGround intermittently blocks GitHub runners.** `npm run deploy` re-runs
  a timed-out deploy itself, up to three times (see the eelkedevries.com
  README, *Deploy reliability*).
- **Deploys use the private website repository's Actions minutes**, about 1–2
  minutes per eek-a-look deploy. Builds in this public repository are free.
- **A push alone does not deploy.** Deploys come from `npm run deploy` or the
  *Run workflow* button.
- **Too few suitable eye-level Commons photos** for an area: use fewer and
  report it.
- **SAM 3 access is refused or slow.** Fallback: Grounding DINO base + SAM 2.1
  (Apache-2.0, no sign-up) with one phrase per call, as a superseding prompt
  `021b`.
- **The horizon cannot be found** on a photo taken looking up at towers: the
  tool falls back to the image's middle row and flags the photo, and the page
  says so.
- **Qwen3-VL-8B does not fit in 8 GB** even in 4-bit: use Qwen3-VL-4B and record
  it.

## What the owner needs to do

Nothing for v1 except giving the go-ahead and approving any permission prompts.
Optional: take your own photos to replace the Commons examples.

Before prompt 021: request access to SAM 3 at
<https://huggingface.co/facebook/sam3> (one click, with the eelkedevries
account), create a read token at <https://huggingface.co/settings/tokens>, and
log in on the laptop with `! uvx --from huggingface_hub hf auth login`.
