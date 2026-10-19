# Task: Image measure for horizontal–vertical rhythm and variety

## Goal

Find, for each example photo, the parts of the façades where horizontal layers
and vertical bays repeat, and how many visibly different façade zones there
are, and turn this into an image measure with a fixed rule.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/qualities/` and the `QualityFile` schema exist (040). Area files hold
  the façade category and the ground floor; `tools/areas/elements.py` pins
  SAM 3 and holds its chosen thresholds (`validation.json`, `elements`).
- Rhythm is a relationship between elements, not an element: one window says
  nothing about rhythm. The measure therefore looks at spacing.
- CMP Facade (rectified façades, human labels for windows, doors, balconies,
  cornices, sills, mouldings, pillars and shops) is downloaded by
  `tools/areas/fetch_validation.py` into `tools/areas/.cache/validation/`.
- Background: `docs-dev/reference/secondary_background/qualities_sources.md`
  (*Measuring repetition in façades*).

## Required changes

1. Add `torch`, `transformers` (≥ 5.20, locked) and `opencv-python-headless`
   to `tools/qualities/`. Reuse the SAM 3 repository and revision pinned in
   `tools/areas/elements.py` by import.
2. **Items** on the mask grid, per photo:
   - SAM 3 instances for "window" and "balcony" at the thresholds chosen in
     prompt 023, inside the façade category; keep each instance's centroid
     and box (in `.cache/`, not published);
   - LSD line segments on façade pixels, at least 2% of the image width long,
     in two families: **vertical** (within 8° of vertical) and **layer**
     (within 60° of horizontal, which includes receding floor lines).
3. **Cells and windows.** Cut the façade into 32 × 32 px cells; classify each
   cell with at least 60% façade pixels from the 64 × 64 px window centred on
   it. Per window and family:
   - positions along the family's normal: for the layer family, the normal
     of its length-weighted dominant direction in the window; for the
     vertical family, the image x-axis. Segments count with their length,
     instance centroids with weight equal to the median segment length;
   - a 1-px histogram, Gaussian-smoothed (σ = 1.5 px), and its normalised
     autocorrelation; the **periodicity** *p* is the highest peak at lags of
     5–40 px, or 0 with fewer than 3 items;
   - the family **repeats** if *p* ≥ τ.
4. **Calibrate τ on CMP, even image numbers.** Reference per window from the
   human labels: the vertical family repeats if at least 3 instances of
   window, door, balcony, pillar or shop have distinct x-centres whose gaps
   have a coefficient of variation ≤ 0.35; the layer family likewise for the
   y-centres of window, balcony, sill, cornice and moulding. Run the image
   measure on the same CMP images and choose τ in 0.10–0.90 (steps of 0.05)
   with the highest balanced accuracy, separately per family. Record τ and
   the calibration figures in `tools/qualities/rhythm_calibration.json`. The
   odd images are kept for 043.
5. **Cell classes:** *rhythmic* (both families repeat), *layers only*, *bays
   only*, *plain* (fewer than 3 items in both families) or *irregular*.
6. **Variety.** Cluster the façade cells by mean colour (CIELAB, distance on
   (L/2, a, b), average linkage, cut at 12). A **zone** is a cluster covering
   at least 10% of the façade cells. `distinctZones` = number of zones.
7. **Indicators:** `facadeCells`, `rhythmicShare`, `layersOnlyShare`,
   `baysOnlyShare`, `plainShare`, `irregularShare` (each ÷ façade cells),
   `distinctZones`, `windowInstances`, `balconyInstances`.
8. **Rule** (in the specification before running on the photos):
   - `facadeCells` < 8 → Unclear ("Too little façade is visible");
   - `rhythmicShare` ≥ 0.25 and `distinctZones` ≥ 2 → Likely present;
   - `rhythmicShare` ≥ 0.25 and `distinctZones` < 2 → Unclear ("Repetition
     without visible variety");
   - `rhythmicShare` < 0.10 → Likely absent ("Few repeating layers or bays");
   - otherwise Unclear ("Some repetition").
9. **Evidence:** "Repeating layers and bays" (supports), "Layers only" and
   "Bays only" (context), "Plain or irregular" (against), "Floor lines and
   bands" and "Vertical divisions" (the segments drawn 1 px wide; context),
   and "Façade zone 1…k" (context).
10. Overlays in `.cache/check/` (cell classes, segments, zones), a printed
    table per photo, and the README section with the definition, the rule
    and the limits (perspective; glass curtain walls, where SAM 3 finds no
    windows but mullions give lines; sun and shade can split a colour zone).
11. Specification (bump the version, with a line in *Changes*): the
    operational definition of rhythm and variety, labelled as this project's,
    the items, cells, periodicity, calibration, variety and the rule.

## Do not implement

Do not implement:
- materials (042) or the checks on the odd CMP images (043);
- page changes (047);
- tuning τ, the zone cut or the rule on the 24 example photos.

## Acceptance criteria

The task is complete when:
- `uv run build.py` adds a `rhythm` result to all 24 quality files and keeps
  the `groundFloor` results unchanged;
- `rhythm_calibration.json` records τ per family with its balanced accuracy
  on the even CMP images;
- the final report gives the number of photos per outcome, and checks by eye
  the overlays of four photos, including one with a glass curtain wall;
- `npm run check` passes.

## Checks

`cd tools/qualities && uv run build.py --rhythm` (with the calibration step);
view four overlays; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
