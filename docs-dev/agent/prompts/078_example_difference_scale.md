# Task: One fixed colour scale for the Example difference

## Goal

Make the difference B − A in the Example section show small changes as
small: one fixed scale for all three examples instead of one per example.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Owner's request of 2026-10-25, after a check of the Example section's
  colour scales for DeepGaze MSDB: the difference plots show small
  differences as large contrasts.
- The check found: `drawDifference()` in `src/render/heatmap.ts` scales each
  difference to its own 99th percentile of magnitude (±2.0×, ±0.8× and
  ±7.0× the image average for entrance, greenery and glazing), so a change
  nine times smaller looks as strong; every non-zero value starts at 30 % of
  the colour range; opacity rises as |t|^0.75; and the colour bar shows a
  pale centre the drawing never uses.
- A and B share one inferno scale to the 99th percentile of both; the peaks
  above it (1 % of cells, 9–23 % of the predicted gaze) saturate. The owner
  accepted keeping this, with a note naming the value of the brightest
  colour.

## Required changes

1. The Example difference is drawn on one fixed scale symmetric around zero,
   ±4× the image average density, for all three examples; colour and
   opacity rise linearly with the magnitude, with no colour floor; values
   beyond the scale saturate. The colour bar's ticks show the fixed scale.
2. The caption names the value of the brightest colour on A and B (the top
   of their shared scale, as a multiple of the image average) and says the
   difference scale is the same for all three examples.
3. `specification.md` (version bump) and `docs/usage.md` describe the
   scales.

## Do not implement

Do not implement:
- changes to the Contrast view or to other views using `drawDifference()`;
- a colour bar for A and B, or a change to their scale;
- changes to the maps, sums or scanpath measures.

## Acceptance criteria

The task is complete when:
- the three examples' differences use the same scale (±4.0×) and the
  greenery difference no longer looks as strong as the glazing one;
- the Contrast view is unchanged;
- `npm run check` passes.
