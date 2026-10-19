# Task: Rhythm on rectified façades and from translational symmetry

## Goal

Owner's request of 2026-10-19, recommendation 6 of
`qualities_improvement_research.md`. The rhythm measure finds about twice as
much repetition as the labels (precision 0.41 bays, 0.19 floors on odd CMP).
Perspective and missed glass windows are likely causes. Test two variants
against held-out labels: spacing measured after rectifying the façade, and
repetition found from the image itself (translational symmetry), with no
window instances.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/qualities/compare_rhythm.py` (prompt 053) compares variants on the
  same cells and windows, calibrated on even CMP + LabelMeFacade train,
  tested on odd CMP, LabelMeFacade test and a glazed or banded subset; A was
  kept.
- `tools/areas/groundfloor.py` finds vanishing points of receding façade
  edges with LSD and RANSAC.
- Wenzel, Drauschke & Förstner (2008) detect repeated structure in rectified
  façades along horizontal and vertical translations.

## Required changes

1. Candidates on the same cells, windows and reference as 053:
   - **A** the current measure;
   - **R** A with the instance centres rectified: a homography from the
     façade's horizontal vanishing point (and the vertical one if found)
     maps the centres to a fronto-parallel plane before the periodicity;
     without a vanishing point, R is A;
   - **S** no instances: in each window, the rectified gradient image is
     projected onto the horizontal axis (for bays) and the vertical axis
     (for floors), and the periodicity is the normalised autocorrelation
     peak at lags of 5–100 px, with its own τ.
2. Calibrate τ on even CMP + LabelMeFacade train. Choose by mean balanced
   accuracy over odd CMP and LabelMeFacade test, among candidates whose
   balanced accuracy on odd CMP is at most 0.01 below A's and whose
   precision on odd CMP is not lower than A's; otherwise keep A. Report
   balanced accuracy and precision on every test set and the glazed or
   banded subset. Accept the result whatever it is.
3. If the choice is not A: re-run the rhythm measure on the 49 photos,
   re-run `checks.py`, report the outcome changes, check three overlays by
   eye, update the specification (bump, *Changes*) and deploy. If it is A,
   record the comparison and change nothing else.
4. Record in `rhythm_calibration.json` (`rectifiedComparison`),
   `qualities_validation.md`, `tools/qualities/README.md` and
   `current_state.md`.

## Do not implement

Do not implement:
- changes to the cells, windows, the reference or the variety measure;
- choosing or tuning on the example photos;
- publishing any LabelMeFacade image or label.

## Acceptance criteria

The task is complete when:
- the report has a table of A, R and S with balanced accuracy and precision
  on the three test sets, and names the choice and why;
- if the measure changed, the 49 quality files and the page show it; if not,
  no quality file changed;
- `npm run check` passes.

## Checks

`cd tools/qualities && uv run compare_rhythm.py --rectified`; if changed,
`uv run build.py --rhythm && uv run checks.py` and deploy; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
