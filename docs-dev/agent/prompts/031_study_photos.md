# Task: Add the stimulus photos of three published eye-tracking studies

## Goal

Add the openly licensed stimulus images of three published eye-tracking
studies to the photo library, with all five model predictions, so visitors can
set the predictions beside the heat maps those studies published.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The images were checked for the owner's v150 interview preparation on
  2026-10-19 (`eek-a-job`, `applications/AM8J-…/research/eye-tracking-examples.md`).
- Only images shown **without** a heat map, AOI tint or gaze marker can be
  used; a prediction on an overlaid image would be meaningless.
- The studies publish heat-map figures, not fixation data. Their heat maps are
  **not** turned into a "Measured gaze" layer: that would reconstruct gaze data
  from a picture (spec: measured gaze only from openly licensed datasets).
- `tools/deepgaze-local/precompute.py --only-missing` runs on the CPU (019).

| Study | Licence | Images used | Size per image | Published heat map |
|---|---|---|---|---|
| Zhang et al. (2026), *Front. Psychol.* 17, 1848298 | CC BY 4.0 | the 10 post-renovation renderings in Fig. 2 (the pre-renovation photos carry AOI tints) | about 340 × 190 px | Fig. 3 |
| Wang, Hu & Ma (2025), *Forests* 16, 1576 | CC BY 4.0 | the 15 street-tree panoramas in Fig. 4 (equirectangular 360°) | about 700 × 380 px | Fig. 17 |
| Rosas et al. (2023), *Appl. Sci.* 13, 12071 | CC BY 4.0 | the two buildings in Fig. 1A | about 900 × 640 px | Fig. 1B |

Not used: Kun et al. (2026, CC BY-NC-ND: no adaptations); the AUAS Toronto and
Amsterdam images (no open licence); Schneider et al. (2023, gaze marker burnt
into every frame).

## Required changes

1. Crop each image from the publisher's original figure file without other
   changes, save as JPEG in `public/examples/` with a thumbnail, and add it to
   `examples.json`: `area` = a new value `Published study`, `city` as the
   study states (Qinyang, Guangzhou, or the building's city), `author` = the
   article's authors, `sourceUrl` = the article DOI, `changes` = "Cropped from
   Figure N of the article; recompressed".
2. Add an optional `study` field to the manifest: citation, figure number of
   the published heat map, and its URL. Show it in the photo's credit line as
   "Published eye-tracking heat map: Figure N of <citation>" with a link,
   clearly separate from the model layers.
3. Group the 27 photos as their own section of the photo library, below the
   existing ones, labelled "From published studies (predictions only)".
4. Run `uv run precompute.py --only-missing` for DeepGaze IIE and MSDB; the
   three browser models run as for any photo.
5. Extend `scripts/validate-examples.mjs` for the new area and the `study`
   field; areas and qualities stay limited to the existing photos.
6. Specification: add the photos and the `study` field, state that the
   studies' heat maps are linked and never used as measured gaze, and bump the
   version. Update `current_state.md`.

## Do not implement

- any measured-gaze layer, digitised heat map or reconstructed fixation data;
- area, quality or VLM-panel results for the new photos;
- upscaling or any other change to the images beyond cropping and compression.

## Acceptance criteria

- 27 new photos with credits pass `scripts/validate-examples.mjs`;
- 54 new DeepGaze maps, and `git diff --stat` shows no change to existing maps;
- each new photo shows the five predictions and a working link to its
  published heat map, and none is labelled measured;
- `npm run check` passes; the deployed page shows the new section.

## Checks

`npm run check`; `cd tools/deepgaze-local && uv run precompute.py --only-missing`;
a Playwright screenshot of one photo per study at 1366 and 390 px.

## Commit and push

Commit to `main` as `031_study_photos.md`, push, then `npm run deploy` and
check the live page.
