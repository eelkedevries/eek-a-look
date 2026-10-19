# Task: A surface-detail indicator for tactile materials

## Goal

Owner's request of 2026-10-19, recommendation 5 of
`qualities_improvement_research.md`. Dark brick can read as plaster, and the
material measure is "unclear" on 20 of 25 study images. Stamps (1999) found
surface complexity the strongest predictor of façade preference. Measure
visible surface detail directly, check it against human material labels, and
use it in the rule only if it improves the check.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/qualities/materials.py` groups DMS46 classes near eye level into
  textured, smooth and neutral.
- `checks.py` checks the grouping on 149 outdoor DMS test images: 80% pixel
  accuracy; IoU textured 0.66, smooth 0.64, neutral 0.71.

## Required changes

1. Surface detail per pixel:
   - band-pass energy at the image's own resolution: the absolute difference
     of Gaussian blurs at σ = 1 and σ = 3 px of the grey image, divided by
     the local mean brightness (σ = 8 px) + 1%;
   - averaged per region, and shown as `surfaceDetail` for the eye-level
     zone.
2. Check on the 149 DMS test images:
   - per labelled region, surface detail for textured against smooth
     classes;
   - AUC on the odd-numbered images, and brickwork against
     paint/plaster/enamel alone.
3. A candidate rule change, fixed here. Pixels that DMS46 calls
   "Paint/plaster/enamel" or "Concrete" and whose surface detail is above
   threshold t count as textured. t is chosen on the even images to maximise
   the grouping's pixel accuracy. Adopt it only if, on the odd images, the
   pixel accuracy rises by at least one point and textured IoU does not fall.
   Otherwise show the indicator only.
4. If adopted, re-run the materials measure on the 49 photos and report the
   outcome changes. Either way, the materials card's numbers show "Surface
   detail".
5. `qualities_validation.md` (AUCs, t, the decision), specification (bump,
   *Changes*), `tools/qualities/README.md`, `current_state.md`.
6. Deploy and check the live page.

## Do not implement

Do not implement:
- a new material model or dataset;
- tuning on the example photos;
- changes to the other principles.

## Acceptance criteria

The task is complete when:
- the report gives both AUCs, t and the decision by the rule above;
- the quality files carry `surfaceDetail`;
- if adopted, the outcome changes are listed;
- `npm run check` passes and the live page shows the indicator.

## Checks

`cd tools/qualities && uv run checks.py` (the DMS part) and `uv run build.py
--materials`; `npm run check`; deploy and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
