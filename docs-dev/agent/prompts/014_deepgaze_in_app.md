# Task: Show the DeepGaze models on the page

## Goal

Add DeepGaze IIE and DeepGaze MSDB as models whose maps are pre-computed for
the example photos, and make every view handle a model that is not available
for the current photo.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

The maps from prompt 013 are in `public/precomputed/`. Read `src/models/`,
`src/results.ts`, `src/views/` and `specification.md`.

## Required changes

1. Extend `ModelSpec.runtime` with `'precomputed'`. Add a model status
   `{ state: 'unavailable'; message }`.
2. Add `src/models/deepgaze.ts` with the two models. For an example photo,
   fetch and decode its pre-computed map. For an upload, report
   `unavailable`: "Computed in advance for the example photos only." The
   registry entries hold:
   - names, subtitles ("large model, computed in advance");
   - MIT300 benchmark figures;
   - licence "maps only; code not redistributed";
   - citations.
3. Pass the example id to models (for example as an optional argument to
   `predict`), without breaking the browser models.
4. Make all views handle `unavailable`:
   - the overlay status line;
   - side-by-side cells, with a short note;
   - agreement shown as "n/a".
5. Agreement for five models: replace the list with a compact lower-triangle
   matrix (model × model, r to two decimals) that stays readable at 360 px.
6. "What AI adds" uses the best available neural model (MSDB, then IIE, then
   UNISAL) and names it in its tag and caption.
7. Update the About section:
   - the quality table marks which models are on this page and how they run;
   - one sentence explains that the large models ran on the author's laptop
     GPU in advance, so they cover only the example photos;
   - credits for DeepGaze.
8. Update the spec (scope, architecture, locked decisions: large models are
   pre-computed locally, not hosted) and the plan. Bump the spec version.

## Do not implement

Do not implement:
- the live helper (015);
- remote or Hugging Face processing.

## Acceptance criteria

The task is complete when:
- on every example photo, all five models show maps in all views;
- on an upload, the DeepGaze models say clearly that they cover examples only,
  and nothing breaks;
- there are still no third-party requests and no console errors;
- `npm run check` passes and the change is live.

## Checks

`npm run check`; browser checks of an example and an upload at desktop and
360 px; `npm run deploy`; live check.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
