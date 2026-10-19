# Task: Softer fixation dots and a toggle by the image

## Goal

Owner's request of 2026-10-19: "Reduce the transparency of the raw gaze dots
to 65%, add checkbox as toggle close to image." Draw the fixation points at
65% opacity, and add a "Show fixations" checkbox directly under the image,
in step with the inspector's.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Fixation points: `src/render/fixations.ts` (prompt 030), on by default
  since prompt 049. The checkbox is in the inspector (`src/views/inspector.ts`)
  and the choice is `fixations` in `src/view-state.ts`.
- "65%" is read as the dots' opacity: they are drawn fully opaque today, and
  65% lets the heat map show through them.

## Required changes

1. Draw the dots (fill and edge) at 65% opacity, in every view that shows
   them.
2. A checkbox "Show fixations (raw data)" directly under the image area,
   above the photo credit, with the fixation and observer counts; shown only
   on photos with measured data and in the views that draw dots (single map,
   side by side, contrast). It and the inspector's checkbox change the same
   setting and always show the same state.
3. Specification (bump the version, with a line in *Changes*), `docs/usage.md`
   and `docs-dev/planning/current_state.md`.
4. Deploy with `npm run deploy` and check the live page.

## Do not implement

Do not implement:
- other changes to the dots (colour, size) or to where they are drawn;
- removing the inspector's checkbox.

## Acceptance criteria

The task is complete when:
- on a Zürich photo the dots are drawn at 65% opacity and the checkbox under
  the image is ticked; unticking it hides the dots and unticks the
  inspector's checkbox, and the other way round;
- on a Dutch photo, an upload and the Areas view the checkbox under the image
  is absent;
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
