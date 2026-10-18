# Task: Zürich street photos with measured eye-tracking maps

## Goal

Add 12 openly licensed street photos that come with measured eye-tracking
data, and publish one measured fixation map per photo in the pre-computed map
format.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- **Owner's decision of 2026-10-18:** compare the models with measured eye
  tracking. This reverses the locked decision "No comparison with measured
  eye-tracking data"; this prompt updates the specification accordingly.
- **Source:** Wilming et al. (2017), "An extensive dataset of eye movements
  during viewing of complex images", *Scientific Data* 4, 160126,
  doi:10.1038/sdata.2016.126. Data and stimuli are CC0 1.0. Zenodo record
  5017807 mirrors Dryad doi:10.5061/dryad.9pf75.
- **Files** (direct downloads, no login):
  - `https://zenodo.org/api/records/5017807/files/etdb_v1.0.hdf5/content`
    (33 MB, MD5 `473684bb542257e35cb1782a3d098079`);
  - `https://zenodo.org/api/records/5017807/files/Stimuli_8.zip/content`
    (125 MB, MD5 `1e87c119c4b96ca192719e3acd8866dc`): category 8 ("Urban"),
    64 PNGs of 1280 × 960 named `8/<n>.png`. Ignore `__MACOSX/` and
    `.DS_Store`.
- **Study:** use the HDF5 group `Baseline` (Onat, Açık, Schumann & König,
  2014, *PLoS ONE*): free viewing for 6 s, EyeLink II, 45.6 px per degree,
  image shown full-screen at (0, 0). Fields used: `category`, `filenumber`,
  `fix` (1-based order within the trial), `x` and `y` (1-based pixels),
  `SUBJECTINDEX`. Each observer–trial was recorded from one eye only, so no
  fixation is duplicated. The record's `fixmat.py` shows how to read it with
  `h5py`.
- **Photos:** the street scenes among the 64, by file number: 18, 19, 22, 23,
  24, 27, 30, 33, 42, 46, 51, 53. They show Zürich (23 is Paradeplatz, 30 the
  main station); the dataset itself does not name the places.
- **Checked on 2026-10-18:** each of the 12 has 48 observers and 805–929
  fixations once the first fixation of each trial is dropped; the fixations
  land on people, vehicles, signs and the end of the street, so the
  coordinates match the PNGs without any offset.

## Required changes

1. Update `specification.md` to version 0.8, with a line in *Changes*:
   - *Scope*: add the 12 Zürich photos with measured eye-tracking maps;
     remove "comparison with measured eye-tracking data (not planned)" from
     the out-of-scope list.
   - *Locked decisions*: replace "No comparison with measured eye-tracking
     data" with "Measured eye tracking comes only from openly licensed
     datasets, and is always labelled as measured, never mixed with
     predictions."
   - *Data schemas*: `ExamplePhoto.area` and `city` gain `'Zürich'`; add the
     optional field
     `measured?: { observers: number; fixations: number; viewingSeconds: number; citation: string }`;
     `PrecomputedMap.model` may be `'measured'`.
   - *Domain rules*: the measured-map recipe of step 3.
2. In `docs-dev/plan.md`, drop "comparison with real eye-tracking data" from
   the *Not planned* bullet under *Later*.
3. Create `tools/measured-gaze/` as a `uv` project with a pinned Python
   version and h5py, numpy, scipy and pillow.
   - `fetch.py` downloads both files into `tools/measured-gaze/.cache/`,
     checks their MD5 sums, and skips files that are already present and
     valid.
   - `build.py`, for each listed file number `n` (id `zurich-<n>`, two
     digits):
     - copies `8/<n>.png` to `.cache/photos/zurich-<n>.png`, then runs
       `node scripts/prepare-photos.mjs tools/measured-gaze/.cache/photos public/examples`
       from the repository root (the photos stay 1280 × 960);
     - builds the measured map: `Baseline` rows with `category == 8`,
       `filenumber == n` and `fix > 1` (the first fixation starts on the
       central fixation cross); convert to 0-based pixels and drop points
       outside the image; add one count per fixation, not weighted by
       duration, to a 960 × 1280 array; blur with a Gaussian of σ = 1° =
       45.6 px (`scipy.ndimage.gaussian_filter`, `mode='constant'`); sum
       into 10 × 10 px cells, which gives the shared 128 × 96 grid exactly;
       normalise to sum 1;
     - writes `public/precomputed/measured/zurich-<n>.json` in the
       `PrecomputedMap` format, with model `'measured'` and the same uint16
       encoding as the DeepGaze maps;
     - adds the 12 entries to `public/examples/examples.json`, after the
       Dutch ones: area and city `'Zürich'`; a short, neutral title written
       after looking at the photo (name a place only when certain); author
       "Wilming et al. (2017), Osnabrück–Hamburg eye-tracking database";
       licence "CC0 1.0"; licenceUrl
       `https://creativecommons.org/publicdomain/zero/1.0/`; sourceUrl
       `https://doi.org/10.5061/dryad.9pf75`; changes "Converted from PNG to
       JPEG"; and `measured` with the observer and fixation counts, 6 s and
       the citation;
     - writes a check overlay per photo to `.cache/check/` and prints a
       table: id, observers, fixations, map sum.
4. Extend `scripts/validate-examples.mjs` (area `Zürich` in city `Zürich`;
   validate `measured` when present) and the `ExamplePhoto` type in
   `src/examples.ts`.
5. Write `tools/measured-gaze/README.md`: source, licence, the recipe and the
   commands.
6. Add `tools/measured-gaze/.cache/` and `tools/measured-gaze/.venv/` to
   `.gitignore`.

## Do not implement

Do not implement:
- any change to how the page shows maps, or a registry entry for the
  measured maps (020);
- DeepGaze maps for the new photos (019);
- other eye-tracking datasets; CAT2000 and MIT1003 are excluded because their
  images have no open licence;
- a deploy (020 deploys).

## Acceptance criteria

The task is complete when:
- `uv run fetch.py && uv run build.py` in `tools/measured-gaze/` runs from a
  clean clone with no manual steps;
- `public/examples/` holds the 12 photos and thumbnails, and
  `public/precomputed/measured/` holds 12 maps, each 128 × 96, non-negative
  and summing to 1 after decoding;
- in at least three check overlays the heat lies on content (people,
  vehicles, signs, the end of the street), not shifted;
- `npm run check` passes.

## Checks

`cd tools/measured-gaze && uv run fetch.py && uv run build.py`; view three
overlays in `.cache/check/`; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
