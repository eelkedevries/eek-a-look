# Task: Show the measured fixations as points

## Goal

On the photos with eye tracking, let visitors show the individual fixations
that the measured map was built from as points over any heat map.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The measured maps come from `tools/measured-gaze/build.py` (018); the
  layer is `src/models/measured.ts` (020). Only photos with `measured` in
  `public/examples/examples.json` have them.
- The shared display choices live in `src/view-state.ts`; the controls are
  in `src/views/inspector.ts`.

## Required changes

1. In `tools/measured-gaze/build.py`, also write
   `public/precomputed/measured/<id>.points.json` per photo: the photo id,
   the image size and the fixations used for the map (after the first of each
   trial dropped), as 0-based pixel pairs `[[x, y], …]`. Leave the map files
   and their format unchanged. Update the tool's README.
2. Add a `fixations: boolean` display choice to `src/view-state.ts`,
   off by default.
3. In the inspector, on a photo with measured data only, add a checkbox
   "Show fixations (raw data)" with the note "<n> fixations from <observers>
   people". It stays available whichever layer or view is chosen.
4. When it is on, draw the points over every heat map shown on the photo:
   the single-map view, each panel side by side, and the maps in the
   contrast view (including the difference). Use small filled dots in one
   colour that stays visible on both the greyed photo and the inferno scale
   (for example cyan with a thin dark edge), sized relative to the displayed
   photo, on their own layer above the heat map. The heatmap strength slider
   does not dim them.
5. Load the points once per photo and only when the checkbox is first
   switched on.

## Do not implement

Do not implement:
- points on uploads or on photos without measured data;
- per-observer selection, fixation order, durations or scanpaths;
- any change to how the maps themselves are computed or drawn;
- points in the areas view or the method thumbnails.

## Acceptance criteria

The task is complete when:
- on a Zürich photo the checkbox appears, is off by default, and when
  switched on shows the points over the heat map in the single-map, side by
  side and contrast views, for any chosen layer;
- the points coincide with the fixations in the tool's check overlays
  (`tools/measured-gaze/.cache/check/`);
- on the Dutch photos and on uploads the checkbox does not appear;
- rerunning `build.py` leaves every existing `<id>.json` map byte-identical;
- `npm run check` passes.

## Checks

Run `npm run check`, rerun `uv run build.py` and confirm with `git diff` that
only the new `.points.json` files and intended sources changed, and check the
three views in a browser on one Zürich and one Dutch photo.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.
Then run `npm run deploy` and include the live check in the final report.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
