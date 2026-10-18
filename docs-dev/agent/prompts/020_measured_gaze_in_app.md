# Task: Show measured gaze next to the models

## Goal

On the Zürich photos, show the measured eye-tracking map as its own layer and
report how closely each model matches it.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Photos and measured maps come from 018; DeepGaze maps for these photos
  from 019.
- Specification 0.8: measured maps are always labelled as measured, never
  mixed with predictions.
- The near-top statement that the maps are predictions, not measured gaze,
  is a domain rule in the specification.

## Required changes

1. Add a `measured` entry to the registry, listed first as the reference:
   - kind `'measured'` (extend the union in `src/models/types.ts` and the
     specification), runtime `'precomputed'`, licence `'CC0 1.0'`;
   - name "Measured gaze", subtitle "48 people, eye tracking";
   - citation "Wilming et al. (2017); Onat et al. (2014)";
   - `predict` loads `precomputed/measured/<exampleId>.json`. On any other
     photo, the layer is hidden entirely, with no "unavailable" card.
2. Keep it out of `NEURAL_PREFERENCE`, so "What AI adds" is unchanged.
3. In the agreement view, on a photo with measured data, add "Match with
   measured gaze": each model's Pearson r with the measured map, sorted from
   high to low.
4. Write a method paragraph for `measured` in `src/content/methods.ts`
   (90–115 words). Cover what was measured and how the map was made (first
   fixation dropped, 1° blur). Also cover the limits: Swiss streets, not
   Dutch high-rise; students in a lab, on a monitor, for 6 s. Add the new
   source file to `scripts/check-method-texts.mjs`.
5. In the example picker, the Zürich group comes after the Dutch areas, with
   the heading "Zürich · measured eye tracking" (the city is not repeated).
6. Extend the near-top statement: the maps are predictions, except the
   "Measured gaze" layer on the Zürich photos. Add the dataset, its CC0
   licence and both citations to the About section's credits.
7. Update the specification's domain rules for the new kind, and add the
   measured-gaze system to `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- other metrics (AUC, NSS); Pearson r only, as in the agreement view;
- upload of a visitor's own eye-tracking data;
- other datasets, or recomputing any map.

## Acceptance criteria

The task is complete when:
- on a Zürich photo, "Measured gaze" appears in the overlay selector and side
  by side, labelled as measured, with the "Match with measured gaze" list;
- on the Dutch photos and on uploads it does not appear;
- `npm run check` passes, the change is deployed, and the live page shows
  the layer on one Zürich photo.

## Checks

`npm run check`; screenshots of one Zürich and one Dutch photo;
`npm run deploy`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
