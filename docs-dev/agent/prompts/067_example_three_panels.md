# Task: Example comparisons as three panels with the manipulated area

## Goal

Owner's request of 2026-10-19: show the images of condition A (original) and
B (manipulated) side by side with a third image of the contrast between them;
add a "Highlight manipulated area" checkbox and remove the other area choices
("Ground floor (automatic)" and the rest). For example 1, compare the
predicted gaze on the door: the area of interest is the door and its frame
with the changed colour.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `src/views/example.ts` showed A and B side by side, as a slider or as a
  difference, with buttons for several measures per comparison
  (`src/content/comparisons.ts`).
- The entrance region from `tools/comparisons/regions.py` was the bounding
  rectangle of the changed pixels: it missed the bottom of the frame, where
  the frame is in shadow, and took in wall to the right.

## Required changes

1. A, B and the difference B − A of the chosen map side by side (one column
   at phone width), replacing the side-by-side, slider and difference modes.
2. One manipulated area per comparison; the measure buttons, the automatic
   areas and the lower third are removed. A "Highlight manipulated area"
   checkbox, on by default, outlines it on all three images.
3. Entrance area: the door and its recoloured surround, from the change in
   blueness between A and B, down to the step; regenerate
   `public/precomputed/comparisons/entrance.json`.
4. Specification (0.42), `docs/usage.md`, `tools/comparisons/README.md`,
   `docs-dev/planning/current_state.md`.

## Do not implement

- Changes to the images, the maps, the greenery and glazing areas, or the
  overview cards.

## Acceptance criteria

- Each comparison shows three images with captions A, B and B − A; the
  difference shows a note for Photo and Measured.
- The checkbox toggles the outline on all three; no other area controls.
- The entrance area covers the door and its frame only.
- No console errors; no sideways scroll at phone width; `npm run check`
  passes.

## Checks

`npm run check`; the built page in headless Chromium at 1400 and 390 px for
all three comparisons, the checkbox, and the Photo and Measured maps.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
