# Task: Comparison views

## Goal

Add the side-by-side view, the "What AI adds" map and the agreement scores.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

`specification.md`: *Domain rules* ("What AI adds", agreement, honesty, colour
maps). The maths and colour tables come from prompt 006.

## Required changes

1. View tabs above the stage: **Overlay** (existing), **Side by side** and
   **What AI adds**. The tabs are usable by keyboard and follow the ARIA tabs
   pattern.
2. **Side by side:** the photo plus one panel per model, each overlaid at a
   fixed 60 % opacity and labelled with the model name and "Predicted". One
   column on mobile, 2 × 2 on desktop.
3. **What AI adds:**
   - P_unisal − P_centre on the shared grid;
   - drawn with the diverging table, on a scale symmetric around zero, over a
     desaturated copy of the photo;
   - legend: "AI expects less ← → AI expects more (than looking at the middle)";
   - a one-sentence caption.
4. **Agreement**, always shown under the stage once all three maps are ready:
   - Pearson r for each pair (centre bias–classic, centre bias–UNISAL,
     classic–UNISAL), to two decimals;
   - caption: "0 = unrelated · 1 = same pattern".
5. Recompute when the image changes. Show a waiting state while a map is still
   computing.

## Do not implement

Do not implement:
- drawing areas of interest (v1.1);
- downloading or sharing images or numbers;
- other metrics.

## Acceptance criteria

The task is complete when:
- all three views and the agreement scores render for every example and for an
  upload;
- the numbers are identical when the same image is reloaded;
- every heatmap shows "Predicted";
- `npm run check` passes.

## Checks

`npm run check`; manual check of all views at desktop and 360 px width.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
