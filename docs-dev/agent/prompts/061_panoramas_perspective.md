# Task: Panoramas measured in perspective views

## Goal

Owner's request of 2026-10-19, recommendation 3 of
`qualities_improvement_research.md`. SAM 3 finds no façade elements in the
15 360° panoramas, so their ground floors read as closed and their rhythm as
plain. SAM 3 is trained on ordinary photos. Search for elements in
perspective views cut from each panorama and map them back.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/areas/elements.py` runs SAM 3 for façade elements on the whole
  image. `groundfloor.py` has an exact ground-floor rule for level
  equirectangular panoramas (prompt 051). `imageKind` is `panorama` for the
  15 Guangzhou photos.
- `tools/qualities/rhythm.py` computes window and balcony instances on the
  whole image and measures their spacing in local cells.

## Required changes

1. A gnomonic projection helper: the four side faces of a cube map (yaw 0°,
   90°, 180°, 270°; pitch 0°; 90° × 90°; no overlap), sampled from the
   equirectangular image at the panorama's resolution, with the inverse
   mapping from face pixels back to the equirectangular mask grid.
2. Areas: for panoramas, SAM 3 element search on each face with the same
   phrases and thresholds; masks mapped back and merged with the
   whole-image result (union). Street categories and the ground floor are
   unchanged.
3. Rhythm: for panoramas, the façade categories are projected onto each
   face; window and balcony instances are found on the face; cells and
   periodicity are computed per face as now. Cells from all four faces are
   pooled for the indicators and the variety clustering, and the evidence is
   mapped back to the panorama grid.
4. Rebuild the areas and the quality files of the 15 panoramas only
   (`--only-missing`-style selection by kind). The other 34 files must not
   change. Re-run `checks.py` for the discrimination table.
5. Check the overlays of three panoramas by eye and report the outcome
   changes.
6. Specification (bump, *Changes*), `tools/areas/README.md`,
   `tools/qualities/README.md`, `current_state.md`.
7. Deploy and check the live page.

## Do not implement

Do not implement:
- changes to the rules or thresholds;
- perspective views for renderings or ordinary photos;
- materials in perspective views.

## Acceptance criteria

The task is complete when:
- the panoramas' area files contain the elements found in the faces;
- their quality files are rebuilt and the other 34 are unchanged;
- the report lists the outcome changes and the eye check;
- `npm run check` passes and the live page shows the new evidence on a
  panorama.

## Checks

`cd tools/areas && uv run build.py` (panoramas); `cd tools/qualities && uv
run build.py` (panoramas) `&& uv run checks.py`; `npm run check`; deploy and
check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
