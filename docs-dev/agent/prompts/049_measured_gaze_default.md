# Task: Show measured gaze and its fixations by default

## Goal

Owner's request of 2026-10-19: "Show raw gaze by default for images with gaze
measures." On photos with measured eye tracking, open the single-map view on
the "Measured gaze" layer with the fixation points on.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Prompt 030 added the fixation points ("Show fixations (raw data)"), off by
  default and drawn only over the "Measured gaze" map.
- The single-map layer defaults to DeepGaze MSDB (`src/view-state.ts`); a
  layer a photo does not have hands over to the best model that does
  (`src/views/overlay.ts`).
- The inspector marks the chosen layer; where the photo lacks it (uploads),
  no layer is marked today.

## Required changes

1. `src/view-state.ts`: default layer `measured`, fixations on by default.
2. `src/results.ts`: one helper for the layer the single-map view shows for
   a chosen layer (the chosen one if the photo has it and it can run here,
   otherwise the best neural model that can), used by `src/views/overlay.ts`
   and by the inspector to mark the layer actually shown.
3. Specification (bump the version, with a line in *Changes*): a *Single
   map* rule under *Derived views*, and "on by default" for the fixation
   points. Update `docs/usage.md` and `docs-dev/planning/current_state.md`.
4. Deploy with `npm run deploy` and check the live page.

## Do not implement

Do not implement:
- points over model maps, or any change to how points or maps are drawn;
- remembering choices between visits.

## Acceptance criteria

The task is complete when:
- a Zürich photo opens on "Measured gaze" with the fixation points shown,
  and the checkbox is ticked;
- a Dutch photo opens on DeepGaze MSDB and an upload on UNISAL, each marked
  in the inspector, as before;
- a layer the visitor chooses stays chosen when they move to another photo
  that has it;
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
