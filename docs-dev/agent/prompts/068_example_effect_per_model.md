# Task: Example comparisons — colour bars and the effect per selected model

## Goal

Owner's request of 2026-10-19, for the three examples: add colour bars;
"What the models predict" shows only the selected model; omit the measured
option; sum the selected model's predicted gaze density over the area of
interest into one value for A and one for B, and let their contrast give the
direction of the effect, stated clearly on the page.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `src/views/example.ts` (prompt 067) shows A, B and B − A side by side,
  each heatmap scaled to its own map, a summary sentence over all models and
  a measured-gaze option on untouched originals.
- `attentionShares()` in `src/maps/areas.ts` already sums a map (normalised
  to 1) over a mask.

## Required changes

1. A colour bar under each image with ticks as multiples of the image
   average density. A and B on one colour scale (`sharedRange()` and an
   optional range in `drawHeatmap()`); the difference keeps its symmetric
   scale, whose end `drawDifference()` now returns.
2. "What the selected model predicts": Σ A, Σ B, B − A in percentage points,
   the direction (positive, negative, or no change below 0.05 points) and a
   sentence on how it is computed; the table keeps every model, with the
   selected one highlighted.
3. No measured option, row or note other than one sentence on why it is
   left out.
4. Specification (0.43), `docs/usage.md`,
   `docs-dev/planning/current_state.md`.

## Do not implement

- Changes to the images, the maps, the manipulated areas or the overview
  cards; statistics beyond the sums, their difference and r.

## Acceptance criteria

- Each image has a colour bar; A and B show identical scales.
- The result block changes with the selected model and shows Σ A, Σ B,
  B − A and the direction; Photo shows a prompt to choose a model.
- No Measured button or row; no console errors; no sideways scroll at phone
  width; `npm run check` passes.

## Checks

`npm run check`; the built page in headless Chromium at 1400 and 390 px for
all three comparisons and for UNISAL and Photo.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
