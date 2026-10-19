# Task: Omit the centre-bias layer

## Goal

Remove everything about the centre bias: the layer, its scores and texts on
the site, its mentions in the other method texts, the docs, and the offline
checks (owner's request of 2026-10-19: "Remove everything about the centre
bias").

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
3. Remove the mentions of centre bias from the other method texts
   (classic salience, UNISAL, DeepGaze IIE, DeepGaze MSDB) and from the About
   section, keeping each method text accurate and within 90–115 words.
4. Remove the `centre-bias` layer from `tools/areas/validate.py` and its
   entries from `public/precomputed/areas/validation.json` and the generated
   report `docs-dev/reference/secondary_background/areas_validation.md`
   (removing a layer leaves the other layers' numbers unchanged, as each is
   computed on its own).
5. Update `README.md`, `docs/usage.md`, `docs/troubleshooting.md`, the
   specification (bump the version and record the change) and
   `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- any change to UNISAL, DeepGaze or their built-in centre priors;
- edits to earlier prompt files or `docs-dev/plan.md` (audit trail);
- removing the descriptions of the centre priors inside DeepGaze in the
  technical notes (`tools/deepgaze-local/`, the specification's DeepGaze
  pipeline), which document how those maps were made;
- any other change to the views' layout or wording.

## Acceptance criteria

The task is complete when:
- no centre-bias map, layer row, side-by-side panel, contrast option, match
  score, agreement row or column, method card, About table row or mention
  appears on any photo or on an upload;
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
