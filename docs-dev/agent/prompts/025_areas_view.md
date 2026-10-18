# Task: Show the areas and attention per area

## Goal

Add an "Areas" tab that shows the automatic areas of an example photo and, for
each layer, how much attention each area receives relative to its size.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Area files: `public/precomputed/areas/<photo-id>.json` (categories and
  ground floor from 021, elements from 023; `AreaFile` in the specification).
  Validation numbers: `public/precomputed/areas/validation.json` (022, 023).
- Decisions: `docs-dev/plan.md`, *Fifth round*. Statistic: attention ÷ size,
  where 1.0× is what the area's size alone predicts.
- The host's proxy cache can serve stale copies of changed files (see commit
  `5c92d09`); version the area URLs by content hash in the same way.
- Existing views iterate the layers that cover a photo through `modelsFor()`
  in `src/results.ts`; measured gaze comes first on the Zürich photos.

## Required changes

1. Add a fourth tab, "Areas", after "What AI adds", with its panel in
   `index.html` and a view module `src/views/areas.ts`.
2. Load the area file for example photos, with `?v=<hash>`. The hash is set
   at build time from the content of `public/precomputed/areas/`. For uploads,
   show "Areas are computed in advance for the example photos only." with
   nothing else.
3. Show the greyed photo with area outlines:
   - a switch between "Street categories" and "Façade elements" (the latter
     includes the ground floor);
   - outline colours from the Okabe–Ito palette, without black, and neutral
     grey for "Other"; no rainbow maps;
   - a legend with colour, name and % of the photo; hovering or focusing a
     legend item fills that area;
   - a tag in the existing tag style: "Automatic areas · not an expert
     judgement".
4. Below it, a table with one row per area of the chosen group, sorted by size:
   - a "% of photo" column;
   - one column per layer that is ready, in display order (measured gaze
     first), showing attention ÷ size to one decimal ("2.3×"), with the
     attention share in the cell's title;
   - "–" for areas under 0.5% of the photo;
   - cell shading as in the agreement matrix, warmer above 1.0×;
   - the caption: "Attention ÷ size: 1.0× = as much as the area's size alone
     predicts. Areas are found automatically and can be wrong."
   Compute shares in `src/maps/areas.ts`: decode the run lengths, upsample each
   map to the mask size with `resample()`, and sum within the mask.
5. Under the table:
   - on a photo whose horizon method is `assumed-level`: "Ground floor
     estimated assuming a level camera.";
   - for an element marked `low-confidence`, a note after its name in the
     legend and the table: "(unreliable: low score in the check)".
6. About:
   - a paragraph "Automatic areas" (90–130 words) covering:
     - how the areas are made: OneFormer categories, the element models
       named in the area files, the 4 m ground-floor rule;
     - the main validation numbers, read from `validation.json`: façade IoU
       and the door share inside the ground floor on eTRIMS, and the element
       IoUs;
     - the limits: pixel share is not perceived share; elements can be
       missed; this is not an expert judgement;
   - credits:
     - OneFormer (MIT);
     - each element model used, with its licence, and the acknowledgement
       the SAM License requires if SAM 3 is used;
     - ADE20K;
     - eTRIMS and CMP Facade, used for checking.
7. Specification (bump the version, with a line in *Changes*):
   - the Areas view under *Derived views*;
   - the statistic and the 0.5% rule;
   - the honesty label;
   - areas cover the example photos only.
   Add the Areas view to `docs-dev/planning/current_state.md`.
8. Deploy with `npm run deploy` and check the live page.

## Do not implement

Do not implement:
- drawing or editing areas by visitors;
- areas for uploads, or a live route through `npm run local`;
- other statistics (dwell time, entropy, a centre-bias correction);
- the simulated panel (026).

## Acceptance criteria

The task is complete when:
- on zuidas-gershwinplein and zurich-23, the Areas tab shows outlines, a
  legend, the tag and the table with one column per ready layer (measured
  gaze first on zurich-23);
- the page's attention ÷ size for DeepGaze MSDB and measured gaze on zurich-23
  match the unaltered ratios in `validation.json` within 0.05;
- an upload shows only the "example photos only" note, and no console errors
  occur;
- `npm run check` passes, the change is deployed, and the live page shows the
  Areas tab on one Dutch and one Zürich photo, with screenshots described in
  the final report.

## Checks

`npm run check`; local preview of one Dutch photo, one Zürich photo and an
upload; `npm run deploy`; live check.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
