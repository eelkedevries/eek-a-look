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
| Hosting | SiteGround, the same way as my-review-policy: this repository's `deploy-site.yml` rsyncs `dist/` to `/eek-a-look/`, and the website's deploy protects that folder. No GitHub Pages |
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
in the first days.

| # | Prompt | Notes |
|---|---|---|
| 001 | `001_setup.md`: make the repository public, complete the template scaffold, Vite + TS | |
| 002 | `002_website_protect_path.md`: protect `/eek-a-look/` in the eelkedevries.com deploy | Pushing to eelkedevries.com `main` deploys the site |
| 003 | `003_deploy_site.md`: `deploy-site.yml` to SiteGround, deploying the empty shell | **Human:** copy the deploy secrets first |
| 004 | `004_page_shell.md`: layout, site look, self-hosted fonts, photo upload | |
| 005 | `005_example_photos.md`: 12 Commons photos, credits manifest, picker | |
| 006 | `006_map_core.md`: map type, colour maps, overlay and slider, model registry, centre bias | |
| 007 | `007_classic_salience.md`: Itti–Koch model in a Web Worker | |
| 008 | `008_unisal_export.md`: PyTorch → ONNX fp16, verified against PyTorch | Runs locally with `uv` |
| 009 | `009_unisal_browser.md`: onnxruntime-web inference in a Web Worker | |
| 010 | `010_comparison_views.md`: side by side, "What AI adds", agreement | |
| 011 | `011_about_and_copy.md`: About section, model notes, privacy, credits, README | v1 done |

## Later (not v1)

- **v1.1 Areas of interest:** draw a region (ground floor, façade, sky) and show
  its share of predicted attention.
- **Large models via Hugging Face** (DeepGaze IIE / MSDB). Before hosting,
  settle the licence: the DeepGaze repository had no licence file on
  2026-10-18. Uploading a photo to a remote model is an explicit opt-in, per
  image. These models use the `remote` runtime in the registry.
- **Own photos** to replace the Commons examples (eye level, landscape, the same
  camera height throughout).
- Possibly MSI-Net (MIT licence, TF.js) as a second browser model.
- Not planned: comparison with real eye-tracking data, or a card on the Projects
  page (both can be revisited).

## Risks

- **UNISAL export to ONNX fails or is inexact.** Fallback: the existing
  community LiteRT conversion (`litert-community/UniSal-Saliency-LiteRT`,
  Apache-2.0; 256×256 square input, SALICON domain) through LiteRT.js. That would
  be a superseding prompt (`008b`).
- **onnxruntime-web WASM is large** (several MB) and needs the correct MIME
  type on SiteGround. It is lazy-loaded after first paint and checked in 003
  and 009.
- **SiteGround intermittently blocks GitHub runners.** A failed deploy is re-run
  (see the eelkedevries.com README, *Deploy reliability*).
- **Too few suitable eye-level Commons photos** for an area: use fewer and
  report it.
