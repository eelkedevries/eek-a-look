# Task: Make the maps easier to compare

## Goal

Make the models easier to compare visually: remove "What AI adds", add a
Contrast view of any two maps (by default against the best model), and give
the side-by-side view scores and a shared pointer.

Owner's request of 2026-10-19: "The various models must be easier to visually
compare; omit 'What AI adds'; add option to contrast 2 models, by default
contrast gaze heatmaps with that of the best model; improve user interface."

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Views: `src/views/` (overlay, side by side, "What AI adds", areas).
- The best model is the first available in `NEURAL_PREFERENCE`.
- The diverging colour map is drawn by `drawDifference()`.

## Required changes

1. Remove the "What AI adds" tab, its view and its styles; the About limit
   that mentions it is reworded for Contrast.
2. Add `bestModel()` to `src/results.ts` and use it in the new views.
3. Add a "Contrast" tab (after "Side by side"): two selectors ("Map",
   "Against") and a swap button; the difference *a* − *b* on the greyed photo
   with a legend naming both maps, a caption, the Pearson r, and both heatmaps
   beneath. Default: *b* = best model; *a* = measured gaze where the photo has
   it, otherwise the next model below *b*. A pair the visitor chooses is kept
   across photos while both maps cover the photo.
4. Side by side: per map, its r with the reference (measured gaze, otherwise
   the best model), a "Reference" or "Best available" mark on the reference,
   a "Contrast" button that opens that map against the reference, and a ring
   at the same spot in every panel while the pointer is over one.
5. Skip the pale middle of the diverging map, so small differences no longer
   veil the photo in white (which drew dark rings at the zero lines).
6. Update the specification (bump the version), `docs/usage.md`, `README.md`
   and `current_state.md`.

## Do not implement

- changes to the overlay, Areas or agreement views;
- new models or statistics.

## Acceptance criteria

- "What AI adds" is gone from the page and the code;
- on a Dutch example, Contrast defaults to DeepGaze IIE against MSDB; on a
  Zürich photo, to measured gaze against MSDB; on an upload, to classic
  salience against UNISAL;
- side by side shows r per map and the pointer ring; "Contrast" opens the
  pair;
- `npm run check` passes, the change is deployed and checked live.

## Checks

`npm run check`; local preview of a Dutch photo, a Zürich photo and a phone
width; `npm run deploy`; live check.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
