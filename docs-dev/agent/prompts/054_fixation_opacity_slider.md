# Task: A slider for the fixation points

## Goal

Owner's request of 2026-10-19: "Add a raw gaze data points transparency
slider below the heatmap strength slider." Let visitors set how strongly the
fixation points are drawn.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The fixation points (`src/render/fixations.ts`, prompts 030, 049, 050) are
  drawn at a fixed 65% opacity over the "Measured gaze" map in the single
  map, side by side and contrast views; all three re-sync their dots when the
  view state changes.
- The inspector's "Display" section has the "Heatmap strength" slider
  (`src/views/inspector.ts`); the choices live in `src/view-state.ts`.

## Required changes

1. `src/view-state.ts`: `fixationOpacity` (0–100), 65 by default.
2. In the "Display" section, directly below the heatmap strength slider, a
   slider "Fixation points (raw data)" with its value in %, styled like the
   strength slider (100% = fully drawn, as for the heat map). Shown only on
   photos with measured data.
3. The dots in every view use this opacity; the heatmap strength still does
   not dim them.
4. Specification (bump the version, with a line in *Changes*), `docs/usage.md`
   and `docs-dev/planning/current_state.md`.
5. Deploy with `npm run deploy` and check the live page.

## Do not implement

Do not implement:
- other changes to the dots or to the fixation checkboxes;
- remembering the setting between visits.

## Acceptance criteria

The task is complete when:
- on a Zürich photo the slider sits below the heatmap strength slider at
  65%, and moving it changes the dots' opacity in the single map and side by
  side views;
- on a Dutch photo and an upload the slider is absent;
- `npm run check` passes and the live page behaves as above.

## Checks

`npm run check`; `npm run preview` on a Zürich photo, a Dutch photo and an
upload; `npm run deploy` and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
