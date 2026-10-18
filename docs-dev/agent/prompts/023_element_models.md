# Task: Compare façade-element models and add the best to the areas

## Goal

Compare text-prompted models for windows, entrances, balconies and shopfronts
on human-labelled façades, pick the best per element by a fixed rule, and add
its masks to the area files of the 24 example photos.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The owner chose SAM 3 on published evidence (`docs-dev/plan.md`, *Fifth
  round*). Meta's access review is manual and pending, so this prompt measures
  the ungated models now. SAM 3 joins the same comparison as soon as the
  download works.
- Sources and licences: `docs-dev/reference/secondary_background/areas_sources.md`.
  In the pilot, Grounding DINO with all phrases in one prompt let "shopfront"
  cover a whole building. Prompt **one phrase per call** (Zeng & Boehm 2024).
- Area files, categories and the ground floor: 021. Datasets and the scoring
  code: 022 (`tools/areas/validate.py`; eTRIMS for windows and doors; CMP
  Facade for windows, doors, balconies and shops, rectified).
- The RTX 4070 has 8 GB; run one model at a time.

## Required changes

1. `tools/areas/elements.py` with these candidates, all producing masks per
   phrase:
   - **A** Grounding DINO base (`IDEA-Research/grounding-dino-base`,
     Apache-2.0) boxes → SAM 2.1 large (`facebook/sam2.1-hiera-large`,
     Apache-2.0) masks;
   - **B** OWLv2 large (`google/owlv2-large-patch14-ensemble`, Apache-2.0)
     boxes → SAM 2.1 large masks;
   - **C** Florence-2 large (`microsoft/Florence-2-large`, MIT) open-vocabulary
     detection boxes → SAM 2.1 large masks, but only through the class built
     into `transformers`. Never use `trust_remote_code`; if the built-in class
     is missing, skip C and say so;
   - **D** SAM 3 (`facebook/sam3`) text prompts, included automatically when
     its download works. Otherwise record "access pending" and skip it.

   Pin every revision. Phrases, one call each: `windows` ← "window",
   `entrances` ← "door", `balconies` ← "balcony", `shopfronts` ←
   "storefront". Keep only pixels inside the `facade` category dilated by 1%
   of the image width.
2. **Calibration and test.**
   - Split CMP base by image number: even = calibration, odd = test.
   - Per candidate and element, choose the score threshold (0.05 to 0.70 in
     steps of 0.05) that gives the highest dataset-level IoU on the
     calibration split.
   - Report on the CMP test split and on all of eTRIMS (windows, doors):
     dataset-level IoU and instance precision and recall at IoU ≥ 0.5
     (connected components), plus seconds per image and peak GPU memory.
   - eTRIMS and the CMP test split are never used for choosing.
3. **Selection rule.** Per element, take the candidate with the highest mean
   test IoU over the datasets that label it:
   - windows and entrances: eTRIMS and CMP test;
   - balconies and shopfronts: CMP test.
   Within 0.01, prefer the Apache-2.0 or MIT candidate. If the winner's mean
   test IoU is below 0.20, still add the element, but mark it `low-confidence`
   in the area file. 025 will show that.
4. Add the four elements to `public/precomputed/areas/<photo-id>.json` for all
   24 photos with the chosen model and threshold. Record the model per area,
   and the repository and revision in `models`. Leave the categories and the
   ground floor unchanged. Write element overlays to `.cache/check/`.
5. Fill the `elements` section of `validation.json`: the full comparison
   table, the chosen thresholds and the winners. Add a section to
   `docs-dev/reference/secondary_background/areas_validation.md`.
6. Update `specification.md` (bump the version, with a line in *Changes*):
   the element phrases, the calibration split, the selection rule and the
   `low-confidence` flag. Extend `tools/areas/README.md`, including how to
   re-run the comparison once SAM 3 access is granted.

## Do not implement

Do not implement:
- phrase tuning, ensembles, or fine-tuning on any dataset;
- any page change (025);
- unofficial copies of SAM 3 or SAM 3.1 (only `facebook/sam3` after Meta's
  approval);
- changes to the categories or the ground-floor rule.

## Acceptance criteria

The task is complete when:
- `uv run elements.py --compare` prints the table for candidates A, B and C,
  or states why C was skipped, and D's status ("access pending" or its
  scores). The final report quotes the table;
- the thresholds were chosen on the CMP calibration split only, as the log
  shows;
- all 24 area files hold the four elements, with each element inside the
  dilated `facade`, run lengths summing to width × height, and files of at
  most 150 kB;
- for zuidas-gershwinplein, weena-stationsplein, zurich-18 and zurich-23, the
  final report states, after viewing the overlays, which windows, entrances,
  balconies and shopfronts were found or missed;
- peak GPU memory stays within 8 GB, no weights are in git, and
  `npm run check` passes.

## Checks

`cd tools/areas && uv run elements.py --compare && uv run elements.py --apply`;
view the four overlays; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
