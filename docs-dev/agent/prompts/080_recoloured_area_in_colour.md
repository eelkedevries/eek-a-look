# Task: Show the recoloured entrance block on its heatmaps

## Goal

Make the edit of example 1 (the stone block around the entrance in
blue-teal) visible on the heatmaps of the edited image, on eek-a-look, on
eek-a-predict and in presi-slides.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Owner's report of 2026-10-25: the predicted-manipulated image of the
  example "Street corner with parked bicycles" looks exactly like the
  original; the blue entrance area is missing.
- Heatmaps are drawn over a greyed copy of the photo (Rec. 709 luminance ×
  0.75). `tools/comparisons/recolour.py` recoloured the block keeping the
  stone's lightness, so in grey the edit vanishes: inside the edited area the
  grey level changes by 2.2 of 255 on average, against 47 for the hedge and
  73 for the glazing.

## Required changes

1. `drawGreyed()` in `src/render/heatmap.ts` can keep the colour inside a
   mask, dimmed alike.
2. `public/examples/comparisons.json` marks the recoloured image with
   `"recolour": true`; the Example section keeps the edited area in colour on
   that image's heatmap panel. Its difference panel stays grey, so the
   block's blue cannot be read as the difference's blue.
3. `tools/eek-a-predict/` does the same for the predicted-manipulated figure;
   regenerate it. Regenerate the matching presi-slides panels (slides 11 and
   12) on the `presi-assets` branch and replace them in the deck.
4. Texts: `specification.md` (version bump), `docs/usage.md`,
   `docs-dev/planning/current_state.md`, eek-a-predict's method note.

## Do not implement

Do not implement:
- colour in the edited areas of the hedge and glazing examples, whose edits
  already show in grey;
- any change to the maps, numbers or colour scales.

## Acceptance criteria

The task is complete when:
- the blue-teal block is visible on the edited image's heatmaps on
  eek-a-look, eek-a-predict and slides 11 and 12;
- no other figure changes;
- `npm run check` passes, and both pages are live without console errors.
