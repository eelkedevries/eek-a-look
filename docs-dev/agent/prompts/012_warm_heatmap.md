# Task: Warm heatmap colour map

## Goal

Replace the magma overlay with the warm yellow → orange → red heatmap the owner
chose (option C of the comparison of 2026-10-18).

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

`src/render/colormaps.ts`, `src/render/heatmap.ts`, `src/views/overlay.ts`,
`src/views/about.ts`; `specification.md`, *Domain rules* (Colour maps).

## Required changes

1. Add a `WARM` lookup table: ColorBrewer YlOrRd, 256 entries, generated
   exactly (as magma was).
2. `drawHeatmap` uses `WARM` by default. Index the table at 0.15 + 0.85·t and
   set alpha = 0.85·t^0.9, where t is the value scaled from the map's minimum
   to its 99th percentile.
3. Update the overlay legend gradient and the credits line in the About
   section (YlOrRd, ColorBrewer, Apache-2.0). Remove magma if nothing else
   uses it.
4. Update the spec's *Colour maps* rule: heatmaps use YlOrRd (warm,
   sequential, colour-blind safe) chosen by the owner; still no rainbow. Bump
   the spec version.

## Do not implement

Do not implement:
- a style switcher or other styles (spotlight, contours);
- changes to the "What AI adds" diverging map.

## Acceptance criteria

The task is complete when:
- the overlay and side-by-side views show the warm heatmap, and low areas
  leave the photo visible;
- the legend matches the new colours;
- `npm run check` passes and the deploy shows the change live.

## Checks

`npm run check`; screenshot of two examples; `npm run deploy`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
