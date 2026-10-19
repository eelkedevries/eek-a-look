# Task: Fixation points over the model maps

## Goal

Owner's request of 2026-10-19: "Add option to add raw gaze data points to all
images (so also those with model heatmaps)." Let visitors draw the measured
fixation points over the predicted maps too, so each prediction can be read
against where people actually looked.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The fixation points (`src/render/fixations.ts`, prompts 030, 049, 050, 054)
  are drawn only over the "Measured gaze" map, in the single map, side by
  side and contrast views. That rule came from prompt 030; this request
  replaces it as the owner's decision.
- The checkbox "Show fixations (raw data)" sits in the inspector's "Eye
  tracking" section and under the image (`src/views/fixation-toggle.ts`);
  both change `fixations` in `src/view-state.ts`.
- Predicted maps carry the label "Predicted" (spec, *Honesty*).

## Required changes

1. `src/view-state.ts`: `fixationsOnModels`, false by default.
2. A checkbox "Also over the model maps" beside "Show fixations (raw data)"
   in the inspector and under the image, both changing the same setting;
   inactive while the dots are off.
3. With it on, the dots are drawn over the predicted map in "Single map",
   over every model panel in "Side by side" and over both maps beneath the
   contrast; never over the contrast map itself or the plain photo.
4. A predicted map with the dots adds "with measured fixations" to its tag,
   so the dots are not read as part of the prediction.
5. Specification (bump the version, with a line in *Changes*, recording the
   reversal of prompt 030's rule), `docs/usage.md` and
   `docs-dev/planning/current_state.md`.
6. Deploy and check the live page.

## Do not implement

Do not implement:
- dots on photos without measured gaze, on uploads, or in the Areas and
  Qualities views;
- remembering the setting between visits.

## Acceptance criteria

The task is complete when:
- on a Zürich photo the option is off by default and a model map shows no
  dots; switched on, the model maps in all three views show the dots and say
  "with measured fixations", the contrast map shows none;
- with "Show fixations" off the option is inactive and no map shows dots;
- on a Dutch photo the checkboxes are absent; at phone width the page does
  not scroll sideways;
- `npm run check` passes and the live page behaves as above.

## Checks

`npm run check`; `npm run preview` on a Zürich photo in the three views, a
Dutch photo and at phone width; deploy and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
