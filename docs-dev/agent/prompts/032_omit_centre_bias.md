# Task: Omit the centre-bias layer

## Goal

Remove the centre-bias map from the site, so it appears in no view, list,
score or method text (owner's request of 2026-10-19).

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The layer is `centreBias` in `src/models/centre-bias.ts`, listed in
  `models` in `src/models/registry.ts`; every view, the inspector, the
  agreement matrix, the method cards and the About benchmark table read that
  list.
- Centre bias *inside* other models (UNISAL's learned priors, DeepGaze's
  MIT1003 template) is part of how those models work and is not a layer.

## Required changes

1. Remove `centreBias` from `models` in `src/models/registry.ts` and delete
   `src/models/centre-bias.ts` if nothing else uses it. Remove the
   `'centre-bias'` id from the union in `src/models/types.ts`, and the
   `'baseline'` kind if no layer uses it any more (with its CSS).
2. Remove the centre-bias method text from `src/content/methods.ts` and the
   file from `scripts/check-method-texts.mjs`.
3. In the About section, rephrase "score at or below centre bias on the same
   test" so it no longer refers to a layer the page does not show (for
   example "score at or below a map that only favours the centre of the
   photo").
4. Update `docs/usage.md` (the models that run in the browser), the
   specification (bump the version and record the change) and
   `docs-dev/planning/current_state.md` (five models become four).

## Do not implement

Do not implement:
- any change to UNISAL, DeepGaze or their built-in centre priors;
- any change to `tools/areas/validate.py` or `validation.json` (offline
  checking numbers, not shown as a layer);
- any other change to the views' layout or wording.

## Acceptance criteria

The task is complete when:
- no centre-bias map, layer row, side-by-side panel, contrast option, match
  score, agreement row or column, method card or About table row appears on
  any photo or on an upload;
- the remaining layers and views work as before;
- `npm run check` passes.

## Checks

Run `npm run check`; check the single-map, side-by-side, contrast and
agreement views, the methods and About in a browser on one Zürich photo, one
Dutch photo and one upload; search the built output for "Centre bias".

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.
Then run `npm run deploy` and include the live check in the final report.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
