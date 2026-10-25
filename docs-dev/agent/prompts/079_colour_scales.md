# Task: Colour scales chosen by measurement, site-wide

## Goal

Choose the heatmap and difference colour scales that show the stored maps
most faithfully, by measurement and blind review, and use them in every view
of eek-a-look and in the figures of eek-a-predict.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Owner's request of 2026-10-25: analyse the images of the three examples
  extensively, make variations, compare them with all other versions and
  choose the settings that give the best overall set, with very high
  confidence. Then update all the remaining images on eek-a-look and all
  related stats, and finally everything on
  https://eelkedevries.com/eek-a-predict/.
- Before this prompt, heatmaps were scaled to the 99th percentile. Every peak
  above it rendered as one flat yellow: the higher of two peaks looked
  brighter in 17 % of peak pairs on the Example's A/B maps, and 6.3 % of the
  predicted gaze lay above the top. Prompt 078 drew the Example difference
  linearly to a fixed ±4× the image average. The Contrast view and
  eek-a-predict still scaled each difference to its own 99th percentile.

## Required changes

1. Evaluate heatmap scales (top percentile, transfer curve, alpha, table
   offset, log and mass-quantile scales) on the Example pairs and on every
   stored map. Evaluate difference scales (fixed ends, linear and curved,
   per-image, signed log, log ratio, other diverging tables) on the Example
   pairs and the site's other comparisons. Measure visual strength in CIEDE2000
   over the greyed photo, with visibility thresholds. Confirm by independent
   blind review.
2. Use the chosen scales in `src/render/heatmap.ts` for every heatmap and
   difference on the site. Colour bars show what the image shows: linear in
   value, with the image's colours and alpha over the photo's grey.
3. Record the evaluation (`tools/colour-scales/`) and its results
   (`docs-dev/reference/secondary_background/colour_scales_evaluation.md`).
4. `tools/eek-a-predict/` renders the heatmap and contrast figures of
   eek-a-predict with the site's own drawing code. Regenerate them, and update
   that page's text where it describes the scales, and its source commit.
5. Texts: `specification.md` (version bump), `docs/usage.md`,
   `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- changes to the stored maps, the sums over areas or the scanpath measures;
- a change of the colour tables' hues (inferno, chosen by the owner on
  2026-10-18; blue and orange), beyond balancing the two halves of the
  blue–orange table if the measurements call for it;
- changes to eek-a-predict's numbers, photographs or scanpath figures.

## Acceptance criteria

The task is complete when:
- every heatmap and difference on eek-a-look uses the chosen scales, with
  matching colour bars;
- the fifteen heatmap and contrast figures of eek-a-predict are regenerated
  with the same code, and its numbers are unchanged;
- `npm run check` passes, and both pages are live without console errors.
