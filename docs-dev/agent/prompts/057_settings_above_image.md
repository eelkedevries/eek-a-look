# Task: Display settings above the image

## Goal

Owner's request of 2026-10-19: "Move the settings (heatmap strength, gaze
transparency, checkboxes, etc), to just above the image (and just below the
tabs of "single maps" etc), make it a foldable section." Put the display
settings where the visitor looks at the map.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The inspector (`src/views/inspector.ts`) has a "Display" section (heatmap
  strength, "Fixation points (raw data)" slider, legend) and an "Eye
  tracking" section ("Show fixations (raw data)", "Also over the model maps",
  a note), prompts 028, 049, 054, 056.
- The two checkboxes are repeated under the image
  (`src/views/fixation-toggle.ts`, prompts 050, 056).
- The layer list, the contrast selectors and the match list are not
  settings of the display and stay in the inspector.

## Required changes

1. One foldable section "Display settings" (`<details>`, open by default)
   directly below the view tabs and above the image, with the heatmap
   strength and its legend (single map, side by side), and on photos with
   measured gaze the fixation points' slider, both checkboxes and the note
   (single map, side by side, contrast). Hidden in views where none of these
   apply.
2. Remove the "Display" and "Eye tracking" sections from the inspector and
   the checkboxes under the image.
3. Specification (bump the version, with a line in *Changes*),
   `docs/usage.md` and `docs-dev/planning/current_state.md`.
4. Deploy and check the live page.

## Do not implement

Do not implement:
- moving the layer list, the contrast selectors or the match list;
- remembering the settings or the folded state between visits.

## Acceptance criteria

The task is complete when:
- on a Zürich photo the section sits between the view tabs and the image,
  open, with both sliders, the legend and both checkboxes, and they act on
  the maps as before; folding it moves the image up;
- the inspector no longer shows these settings, and there is no checkbox row
  under the image;
- in contrast the section shows only the fixation settings; in Areas and
  Qualities it is hidden; on a Dutch photo and an upload it shows only the
  heatmap strength;
- at phone width the page does not scroll sideways;
- `npm run check` passes and the live page behaves as above.

## Checks

`npm run check`; `npm run preview` on a Zürich photo in all views, a Dutch
photo, an upload and at phone width; deploy and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
