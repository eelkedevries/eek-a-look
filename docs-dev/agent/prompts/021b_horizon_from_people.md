# Task: Horizon from standing people when façade lines fail

## Goal

When no horizon can be found from façade lines, estimate it from the heads of
standing people before falling back to the middle row, so the ground floor is
no longer too tall on photos taken looking up at towers.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- 021 falls back to the middle row (`assumed-level`) on 7 of the 24 example
  photos. On five of them, the heads of standing people lie 14–44% of the
  image height below that row: the camera was tilted up, and the ground floor
  came out too tall (for example weena-stationsplein, 34.6%).
- For a camera at eye height over flat ground, objects of camera height lie on
  the horizon, whatever their distance (Hoiem, Efros & Hebert 2008; see
  `docs-dev/reference/secondary_background/areas_sources.md`). With head tops
  at about 1.75 m and the camera at 1.6 m, the horizon lies 0.15/1.75 ≈ 8.6%
  of a standing person's height below the top of the head.
- The validation (022) found 91% of eTRIMS door pixels inside the ground floor.
  This change must not make that worse.

## Required changes

1. In `tools/areas/groundfloor.py`, add a second method between
   `vanishing-lines` and `assumed-level`:
   - `standing-people`: when the vanishing lines fail, take the people
     components that are at least 5% of the image height tall and whose bottom
     row touches street surface. With at least 3 of them, the horizon row is
     the median of top row + 0.086 × component height;
   - keep the existing order and limits otherwise (the horizon must lie within
     the middle 80% of the image).
2. `build.py` keeps the façade elements already in an area file (from 023)
   and rewrites only the categories, the horizon and the ground floor.
3. Re-run `uv run build.py` and `uv run validate.py --all`. eTRIMS uses the same
   fallback.
4. Update the specification's ground-floor rule and the `horizon.method`
   values (`'vanishing-lines' | 'standing-people' | 'assumed-level'`), with a
   line in *Changes* (bump the version). Update `tools/areas/README.md`.

## Do not implement

Do not implement:
- a different horizon method for photos where vanishing lines already work;
- changes to the categories, the elements or the storey and camera heights;
- page changes (025).

## Acceptance criteria

The task is complete when:
- the build table shows which photos now use `standing-people`. On each of
  them, the head offset (as defined in 021) lies within ±10% of the image
  height;
- the eTRIMS door share inside the ground floor is at least as high as
  before (0.91 of pixels), as `validation.json` and the report show;
- the elements in all 24 area files are unchanged (the same run lengths as
  before the run);
- after viewing the overlays of weena-stationsplein and zurich-30, the final
  report states whether the ground-floor top now lies near the first-floor
  line;
- `npm run check` passes.

## Checks

`cd tools/areas && uv run build.py && uv run validate.py --all`; compare the
elements before and after; view the two overlays; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
