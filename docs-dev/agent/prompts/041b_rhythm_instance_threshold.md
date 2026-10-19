# Task: Calibrate which SAM 3 instances count for rhythm

Supersedes: `041_rhythm_evidence.md` (the instance threshold only)

## Goal

Choose the SAM 3 score above which a window or balcony instance counts for
the rhythm measure by the same calibration as τ, instead of reusing the
thresholds that prompt 023 chose for mask overlap.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- 041 counts instances at 0.65 (windows) and 0.50 (balconies): the thresholds
  with the best mask IoU on CMP Facade (023). Counting distant windows is a
  different task. On weena-millenniumtoren SAM 3 returns 0 windows at 0.65,
  2 at 0.50, 29 at 0.40 and 53 at 0.30, so its banded office façades read as
  plain.
- This was noticed on an example photo, so the choice must be made on the
  calibration images only and accepted whatever it is, including 0.65. The
  odd CMP images stay untouched for 043.

## Required changes

1. Compute SAM 3 instances for "window" and "balcony" once at a score of 0.05,
   keeping each instance's score, for the CMP base images and the example
   photos (cached, not published).
2. Calibrate the instance threshold *s* in {0.20, 0.30, 0.40, 0.50, 0.65}
   (one value for both phrases) jointly with τ on the even CMP images: for
   each *s*, the best τ per family as before; choose the *s* with the highest
   mean balanced accuracy over the two families (a tie goes to the higher
   *s*). Record the whole grid in `rhythm_calibration.json`.
3. Re-run the rhythm measure on the 24 photos with the chosen *s* and τ.
4. Specification (bump the version, with a line in *Changes*), README and the
   041 line in `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- other changes to the measure, the reference, the rule or the windows;
- looking at the photo outcomes before *s* is chosen.

## Acceptance criteria

The task is complete when:
- `rhythm_calibration.json` records the balanced accuracy for every *s* and
  the chosen *s* and τ;
- the 24 quality files carry the re-run rhythm results, with the other
  principles unchanged;
- the final report states the chosen *s*, the change in outcomes, and
  weena-millenniumtoren's outcome;
- `npm run check` passes.

## Checks

`cd tools/qualities && uv run build.py --calibrate && uv run build.py --rhythm`;
`npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
