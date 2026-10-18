# Task: Check the categories and ground floor against human labels

## Goal

Measure how well the automatic street categories from 021 match human-drawn
labels in two public datasets, test the ground-floor rule against
human-labelled doors, and measure how sensitive the attention numbers are to
the masks and the rule's assumptions.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The owner draws nothing: validation uses existing human labels only.
  Sources and terms: `docs-dev/reference/secondary_background/areas_sources.md`.
- **eTRIMS** 8-class set: 60 street-level photos with building, car, door,
  pavement, road, sky, vegetation and window. "May be used for research
  purposes"; cite Korč & Förstner (2009). `etrims-db_v1.zip` (78 MB) from
  <https://www.ipb.uni-bonn.de/projects/etrims_db/>, no login.
- **CMP Facade** base set: 378 **rectified** façades with 12 classes. CC BY-SA;
  cite Tyleček & Šára (2013). `CMP_facade_DB_base.zip` (36.5 MB) from
  <https://cmp.felk.cvut.cz/~tylecr1/facade/>, no login. Here only the façade
  outline is scored; its windows, doors, balconies and shops are used in 023.
- The pipeline is `tools/areas/` (021). Use the same code path and
  parameters; do not tune them on these datasets.
- Measured maps exist for the 12 Zürich photos (`public/precomputed/measured/`).
  In that study 1° was 45.6 px on 1280 px photos, so a photo spans about 28°.

## Required changes

1. `tools/areas/fetch_validation.py`: download both zips into
   `tools/areas/.cache/validation/`, skip them when present, and check their
   SHA-256 sums (record the sums in the script on the first run).
2. `tools/areas/validate.py`, scoring the pipeline's output against label
   masks through a class mapping:
   - `--labels <dir> --mapping <json>` scores any folder of PNG label masks,
     so an expert panel can add its own annotations later. eTRIMS and CMP are
     scored through this same path, with mapping files committed in
     `tools/areas/mappings/`;
   - eTRIMS: building + window + door ↔ `facade` (the categories include a
     façade's windows and doors), sky ↔ `sky`, vegetation ↔ `greenery`,
     road + pavement ↔ `street-surface`, car ↔ `vehicles`;
   - CMP: every class except background ↔ `facade`. Read the class indices
     from the label list shipped with the dataset.
3. Metrics per class pair: dataset-level IoU (summed intersections over summed
   unions) and the mean per-image IoU, with pixel accuracy over the mapped
   classes as a secondary figure.
4. Ground-floor checks:
   - **eTRIMS doors:** the share of human-labelled door pixels that falls
     inside the computed ground floor, and the share of door instances
     (connected components) that are at least half inside. Doors belong to
     the ground floor, so a good rule scores high;
   - **sensitivity:** the change in ground-floor share on the 24 example
     photos for camera heights 1.5 and 1.7 m and storey heights 3.5, 4.5 and
     5.0 m, and the door shares under the same settings;
   - the horizon method and head offset per example photo.
5. Attention robustness on the 24 example photos:
   - attention ÷ size per category and for the ground floor, for DeepGaze
     MSDB (and measured gaze on the Zürich photos), with the masks as they
     are, eroded and dilated by 1° (photo width / 28). Report the range of
     each ratio;
   - on the Zürich photos: per photo, the Spearman correlation between each
     layer's ratios and the measured ratios across areas covering ≥ 0.5% of
     the photo; then the mean over the 12 photos per layer. Use DeepGaze MSDB
     and IIE (pre-computed maps) and centre bias (the formula in the
     specification). Add UNISAL through its ONNX model in Python if that is
     straightforward, otherwise list it as not computed. Classic salience
     exists only in the browser and is not included here.
6. Write `public/precomputed/areas/validation.json`:
   - date, tool and model versions;
   - per-class IoU per dataset and the ground-floor checks;
   - the robustness summary;
   - the unaltered attention ÷ size ratios per photo and area for DeepGaze
     MSDB (and measured gaze on the Zürich photos). The page's numbers are
     checked against these in 025.
   Compute the attention share by upsampling each map bilinearly to the mask
   size with cell centres aligned, as `resample()` in
   `src/maps/saliency-map.ts` does. Leave room for an `elements` section,
   which 023 fills.
7. Write a readable report with tables to
   `docs-dev/reference/secondary_background/areas_validation.md`. Extend
   `tools/areas/README.md` with the validation commands and the route for
   future expert annotations.

## Do not implement

Do not implement:
- any change to the area pipeline or its parameters (a finding becomes a
  later prompt);
- element scoring (023) or page changes (025);
- committing any dataset image or label;
- other datasets that need a login (Cityscapes, Mapillary, ADE20K full).

## Acceptance criteria

The task is complete when:
- `uv run fetch_validation.py && uv run validate.py --all` runs from a clean
  clone with no manual steps;
- `validation.json` and the report hold:
  - IoU for every listed class pair on both datasets;
  - the eTRIMS door shares and the sensitivity table;
  - the robustness ranges and the Zürich correlations;
- the final report quotes the main table;
- re-running `validate.py` against eTRIMS through `--labels` and its mapping
  file reproduces the same numbers;
- no dataset files are tracked by git, and `npm run check` passes.

## Checks

`cd tools/areas && uv run fetch_validation.py && uv run validate.py --all`;
`git status` shows no dataset files; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
