# Task: Check the image measures

## Goal

Test each image measure against human labels where public labels exist, test
how much the outcomes depend on the thresholds and whether they tell the 24
photos apart, and add the hook that scores the methods once expert labels
exist.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Quality files with `groundFloor`, `rhythm` and `materials` (040–042).
- No expert labels exist for the example photos, so the principles
  themselves cannot be validated. What can be checked is whether each measure
  reads its *components* as people labelled them.
- CMP Facade and eTRIMS are in `tools/areas/.cache/validation/`
  (`fetch_validation.py`); the CMP odd image numbers were kept out of the
  rhythm calibration (041).
- The simulated panel (024) said "present" for rhythm and materials on all 24
  photos; the same failure must be looked for here.

## Required changes

1. `tools/qualities/checks.py`:
   - **Rhythm, CMP odd images:** per window and family, the image measure's
     "repeats" against the reference from the human labels (041's rule):
     balanced accuracy, precision and recall per family; and per image the
     Spearman correlation between the share of rhythmic cells from the image
     and from the labels;
   - **Frontage, CMP odd images with doors or shops:** the bottom quarter of
     each labelled façade stands in for the ground floor (CMP has no horizon).
     Per image, `openShare` from the human door and shop labels against
     `openShare` from the SAM 3 masks, with the same column rule: Spearman ρ,
     mean absolute difference, and the agreement of the three outcomes;
   - **Materials:** quote the per-class DMS46 results for the material groups
     from Upchurch & Niu (2022). If the DMS validation labels
     (`dms_v1_labels.zip`, CC BY-NC 4.0) and their Open Images photos can be
     downloaded without a login, also score the textured / smooth / neutral
     grouping on up to 200 outdoor validation images (IoU per group); otherwise
     say so. Nothing from DMS is committed;
   - **Sensitivity:** for every rule threshold, re-run the rule at × 0.5 and
     × 1.5 (one threshold at a time) and count how many of the 24 outcomes
     change;
   - **Discrimination:** per principle, the number of photos per outcome and
     the range of the main indicator; a principle with the same outcome on
     all 24 photos is flagged, as the panel's was;
   - **Automated against automated (labelled as such):** per principle, the
     agreement between the image measure and the simulated panel's v1
     consensus (present ↔ likely present, absent ↔ likely absent, ambiguous ↔
     unclear), as a cross-table.
2. Write `public/precomputed/qualities/checks.json` (the figures above, the
   date and the tool versions) and the report
   `docs-dev/reference/secondary_background/qualities_validation.md`, which
   states plainly what was validated (components against human labels) and
   what was not (the principles themselves; agreement with experts).
3. **Expert labels later:** `tools/qualities/labels_template.csv` with the
   columns `photo, principle, label, rater, note` (labels `present`, `absent`,
   `ambiguous`, as the 2020 panel used) and one empty row per photo and
   principle; and `tools/qualities/agreement.py --labels FILE` that reports,
   per method (image measure; simulated panel v1; later methods if their
   files exist) and principle, the percentage agreement and Cohen's kappa with
   the labels, with *n*. Try it once on a copy of the panel's v1 labels to
   show it runs; do not commit that copy.
4. README: the checks, the commands and how an expert panel would use the
   template.

## Do not implement

Do not implement:
- changes to the measures or rules because of these results (a change would
  be a new prompt that supersedes 040–042);
- page changes (047);
- invented or simulated expert labels.

## Acceptance criteria

The task is complete when:
- `uv run checks.py` writes `checks.json` and the report;
- the final report quotes the rhythm balanced accuracy, the frontage ρ, the
  material figures (or why they are missing), the sensitivity counts and the
  outcome counts per principle, and names any principle that does not
  discriminate;
- `uv run agreement.py --labels <copy>` prints a table and the template is
  committed;
- `npm run check` passes.

## Checks

`cd tools/qualities && uv run checks.py && uv run agreement.py --labels <copy>`;
`npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
