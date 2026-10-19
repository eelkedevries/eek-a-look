# Task: Rhythm on glass and ribbon-window façades

## Goal

Test whether other ways of finding repeating elements let the rhythm measure
see floors and bays on glass and ribbon-window façades, where SAM 3 finds no
windows, and adopt one only if it does better on held-out human labels
without losing accuracy on ordinary façades.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The rhythm measure (041, 041b) counts SAM 3 window and balcony instances
  scoring at least 0.65 and looks for regular spacing in 160 px windows. On
  weena-millenniumtoren SAM 3 finds 0 windows at 0.65 (53 at 0.30), so its
  banded office façades read as plain; glass towers (Weena) and the arcaded
  station (zurich-30) come out "Likely absent". 041b's calibration on CMP
  Facade kept 0.65, but CMP has almost no modern glazing.
- In 041 the LSD line segments, used everywhere, pulled agreement with the
  human labels towards chance on CMP; here they may only fill in where
  instances are missing.
- **LabelMeFacade** (Fröhlich, Rodner & Denzler, ICPR 2010;
  <https://github.com/cvjena/labelmefacade>): 945 street-level façade photos
  (100 train, 845 test) with window and door labels, from LabelMe;
  "non-commercial and research experiments" only, no licence file. Unlike
  CMP, the photos are not rectified, like the example photos.
- The odd CMP images and the LabelMeFacade test split are held out; the
  example photos are never used to choose.

## Required changes

1. `tools/qualities/fetch_labelmefacade.py`: the repository at a pinned
   commit into `.cache/` (never committed), with a file-level SHA-256 check,
   and a mapping of its colour labels (window 0:0:128, door 128:128:0,
   building 128:0:0) for the reference. Check ten label images by eye and
   report how complete the window labels are.
2. Reference on LabelMeFacade as in 041b: a family repeats in a window if the
   labelled windows have at least 3 regularly spaced centres across (bays)
   or up (floors). Mark a **glazed or banded** subset of the test split:
   images whose labelled windows cover at least 40% of the building, or
   whose median window component is at least three times as wide as it is
   tall (ribbon windows).
3. Compare, on the same cells, windows and periodicity:
   - **A** the current measure (SAM 3 "window" and "balcony", score ≥ 0.65);
   - **B** A plus SAM 3 instances for "ribbon window" and "curtain wall
     panel";
   - **C** A plus LSD segments as items only in windows with fewer than 3
     instances (a fallback), with its own threshold;
   - **D** A with the instance score *s* in {0.20 … 0.65} calibrated
     jointly with τ on the combined calibration data.
   Calibrate τ (and *s* for D, the line threshold for C) on the even CMP
   images plus the LabelMeFacade train split, as in 041b.
4. Choose by mean balanced accuracy over the two test sets (odd CMP,
   LabelMeFacade test), but only a candidate whose balanced accuracy on odd
   CMP is at most 0.01 below A's; otherwise keep A. Report every candidate on
   both test sets and on the glazed or banded subset. Accept the result
   whatever it is.
5. If the choice is not A: re-run the rhythm measure on all example photos,
   re-run `checks.py`, report the outcome changes (including
   weena-millenniumtoren, weena-stationsplein and zurich-30), check three
   overlays by eye, and deploy with `npm run deploy`. If it is A, record the
   comparison and change nothing else.
6. Record the comparison in `rhythm_calibration.json` and
   `qualities_validation.md`; specification (bump the version, with a line in
   *Changes*) if the measure changes; README and
   `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- changes to the rule thresholds, the cell or window sizes, or the variety
  measure;
- choosing or tuning on the example photos;
- publishing any LabelMeFacade image or label.

## Acceptance criteria

The task is complete when:
- the final report has a table of candidates A–D with balanced accuracy on
  odd CMP, on the LabelMeFacade test split and on its glazed or banded
  subset, and names the choice and why;
- if the measure changed, the 49 quality files carry the new rhythm results
  and the page shows them after deploy; if not, no quality file changed;
- nothing from LabelMeFacade is in git, and `npm run check` passes.

## Checks

`cd tools/qualities && uv run fetch_labelmefacade.py && uv run build.py
--calibrate` (with the comparison); if changed, `uv run build.py --rhythm &&
uv run checks.py` and `npm run deploy`; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
