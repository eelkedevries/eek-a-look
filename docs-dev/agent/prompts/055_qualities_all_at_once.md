# Task: The three principles at once in the Qualities view

## Goal

Owner's request of 2026-10-19: "Add all labels for the three Qualities under
the image and not in three separate tabs." Show the evidence, legend and
outcomes of all three design principles together instead of behind a switch.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The Qualities view (`src/views/qualities.ts`, prompts 047, 048, 052) has a
  switch between rhythm and variety, active ground floor and tactile
  materials; the photo, legend, outcome, methods, attention and all-photos
  table show the chosen principle only.
- The evidence uses the shared role colours (supports bluish green, against
  vermilion, context sky blue), so three principles on one photo need
  another cue to tell them apart.

## Required changes

1. Remove the principle switch. Draw the evidence of all three principles on
   the photo, each outlined in its own line style (rhythm solid, ground floor
   dashed, materials dotted) in the role colours; a region is filled while
   its legend item is hovered or focused, and context regions and lines are
   drawn only then.
2. One legend under the photo in three parts, each headed by the principle
   and its line style.
3. The AI judgement's boxes toggle shows the boxes of all three principles,
   each labelled with its principle.
4. The outcomes as three cards side by side (stacked on a phone), with the
   indicators and the note on the measure under "The numbers", collapsed.
5. "Definitions" lists all three; "Methods for this photo" gets one column
   per principle; the attention table is grouped by principle; the
   all-photos table gets one column per principle.
6. Keep the honesty labels, in the plural ("Image measures · not an expert
   judgement").
7. Specification (bump the version, with a line in *Changes*), `docs/usage.md`
   and `docs-dev/planning/current_state.md`.
8. Deploy and check the live page.

## Do not implement

Do not implement:
- changes to the image measures, the panel, UP-CLIP or the "Descriptions and
  photos" section;
- changes to other views.

## Acceptance criteria

The task is complete when:
- on a Zürich photo the Qualities view has no switch, shows the three legend
  parts and three outcome cards, and hovering a legend item fills its region;
- the boxes toggle, a 360° panorama's tag and the upload message still work;
- at phone width the page does not scroll sideways;
- `npm run check` passes and the live page behaves as above.

## Checks

`npm run check`; `npm run preview` on a Zürich photo, a panorama, an upload
and at phone width; deploy and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
