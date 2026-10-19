# Task: Show all areas together

## Goal

Owner's request of 2026-10-19: "Do not have façade elements and street
categories under separate tabs." Show both groups in the Areas view at once.

## Scope

Implement only the work described in this prompt.

## Required changes

1. Remove the "Street categories" / "Façade elements" switch from the Areas
   view.
2. Draw all areas at once: street categories as solid outlines, façade
   elements (with the ground floor) as dashed outlines.
3. One legend in two labelled parts ("Street categories", "Façade elements ·
   dashed"), with dashed swatches for the elements; hover and focus still
   fill an area.
4. One table, with a row heading per group; within a group, areas from large
   to small.
5. Update the specification (bump the version).

## Do not implement

- new colours, areas or statistics.

## Acceptance criteria

- no switch; both groups visible on the photo, in the legend and the table;
- `npm run check` passes; deployed and checked live.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
