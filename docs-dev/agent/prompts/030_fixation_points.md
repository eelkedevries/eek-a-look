# Task: Show the measured fixations as points

## Goal

On the photos with eye tracking, let visitors show the individual fixations
that the measured map was built from as points over the "Measured gaze"
layer.

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
   people · on the Measured gaze layer". It is shown in the single-map, side
   by side and contrast views (owner's decision of 2026-10-19: the points
   go over the measured layer only, never over a model's map).
4. When it is on, draw the points over the "Measured gaze" map wherever it
   is shown: the single-map view when that layer is chosen, its panel side
   by side, and its map under the contrast view when it is one of the two.
   Not over model maps or the difference. Use small filled dots in one
   colour that stays visible on both the greyed photo and the inferno scale
   (for example cyan with a thin dark edge), sized relative to the displayed
   photo, on their own layer above the heat map. The heatmap strength slider
   does not dim them.
5. Load the points once per photo and only when the checkbox is first
   switched on.

## Do not implement

Do not implement:
- points over model maps or the difference map;
- points on uploads or on photos without measured data;
- per-observer selection, fixation order, durations or scanpaths;
- any change to how the maps themselves are computed or drawn;
- points in the areas view or the method thumbnails.

## Acceptance criteria

The task is complete when:
- on a Zürich photo the checkbox appears, is off by default, and when
  switched on shows the points over the "Measured gaze" map in the
  single-map, side by side and contrast views, and over no other map;
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
