# Task: Graded simulated panel with evidence boxes

## Goal

Run the simulated panel a second way, rating each principle from 0 to 4 and
marking the evidence with boxes, to see whether the model can tell the photos
apart where its present/absent verdicts could not.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/vlm-panel/` (024): Qwen3-VL-8B in 4-bit, eight members (four roles ×
  two seeds), `prompt.md`, `panel.json`. In that run rhythm and materials were
  "present" on all 24 photos (Fleiss' kappa `null`), so those verdicts do not
  discriminate.
- A graded scale is a change of measurement design, fixed here before the
  run. One probe photo may be used only to confirm the JSON and the box
  coordinates; the prompt is not tuned after seeing the 24 results.
- The image measures (040–042) define the regions the boxes are compared
  with. The specification forbids combining panel output with gaze
  statistics.

## Required changes

1. `tools/vlm-panel/prompt_graded.md`, with the same system message and the
   same definitions as `prompt.md`, asking per principle for:
   - a **rating** 0–4 with anchors: 0 = absent, 1 = a trace, 2 = partly
     present, 3 = clearly present, 4 = strongly present throughout;
   - one sentence of evidence;
   - up to three **boxes** around the visible elements that support the
     rating, each with a short label, in the coordinate convention the model
     card documents for Qwen3-VL grounding (confirm it on the probe photo and
     record it).
2. `panel.py --graded` (the v1 mode stays unchanged): the same model,
   members, sampling and retries as 024. Output
   `public/precomputed/vlm-panel/panel-graded.json` with the model, the
   prompt SHA-256, the date and, per photo and principle: the eight ratings,
   their median and interquartile range, one evidence sentence, and the boxes
   converted to the mask grid of the area file.
3. Figures, written into the file and printed:
   - **agreement among members:** Krippendorff's alpha (ordinal) per
     principle over the 24 photos;
   - **discrimination:** per principle, the number of distinct medians and
     their range over the 24 photos;
   - **stability:** a second run with seeds 37 and 41; the share of photo ×
     principle medians that change by at most 0.5;
   - **boxes against regions (exploratory, automated vs automated):** the
     share of box area inside the matching region: ground floor (dilated by
     2% of the width) for the ground floor; façade for rhythm; the eye-level
     zone of 042 for materials;
   - the Spearman correlation between the median rating and the image
     measure's main indicator per principle (`openShare`, `rhythmicShare`,
     `texturedShare`), labelled exploratory.
4. README: the graded mode, the anchors, the figures from the run, and that
   agreement among runs of one model is not agreement with experts.
5. Specification (bump the version, with a line in *Changes*): the graded
   panel, its scale and boxes, labelled "AI judgement", and the rule that
   neither its ratings nor its boxes are combined with gaze statistics.

## Do not implement

Do not implement:
- changes to the v1 prompt or `panel.json`;
- page changes (047);
- a different model, more members, or prompt changes after the 24-photo run.

## Acceptance criteria

The task is complete when:
- `uv run panel.py --graded` writes `panel-graded.json` with ratings and boxes
  for 24 photos × 3 principles, and the figures above;
- the final report quotes alpha, the discrimination per principle, the
  stability, the box shares and the peak GPU memory, and says plainly whether
  rhythm and materials now separate the photos;
- for two photos, the final report checks each box against the photo and
  lists boxes on nothing relevant;
- no weights in git, and `npm run check` passes.

## Checks

`cd tools/vlm-panel && uv run panel.py --graded`; view two photos with their
boxes; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
