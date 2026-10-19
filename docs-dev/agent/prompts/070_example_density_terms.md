# Task: Example comparisons — "predicted gaze density" and one colour bar

## Goal

Owner's request of 2026-10-19, for the three examples: use the term
"predicted gaze density"; remove the colour bars under images A and B and
keep one for the difference image only, stating clearly which colour means
higher in which image.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Prompt 068 added colour bars under all three images and called the
  measure "predicted attention".

## Required changes

1. "Predicted gaze density" in the Example section's result, captions, table
   notes, possible outcomes and caveat.
2. No colour bar under A or B (they keep their shared colour scale). Under
   the difference: the bar, its ticks, and a key "Blue: higher in A · …" and
   "Orange: higher in B · …" with the condition labels.
3. Specification (0.47), `docs/usage.md`,
   `docs-dev/planning/current_state.md`.

## Do not implement

- Changes to the images, maps, areas or the computation; the larger
  manipulations are prompt 071.

## Acceptance criteria

- One colour bar, under the difference image, with the key naming both
  conditions; none under A or B.
- No "predicted attention" left in the section.
- No console errors; no sideways scroll at phone width; `npm run check`
  passes.

## Checks

`npm run check`; the built page in headless Chromium at 1400 and 390 px.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
