# Task: Map core, overlay view and centre bias

## Goal

Add the shared map type and maths, heatmap rendering with an opacity slider, the
model registry, and the centre-bias model.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

`specification.md`: *Architecture* (registry, shared grid), *Data schemas*
(`SaliencyMap`, `GridSize`, `ModelSpec`), *Domain rules* (centre-bias
definition, honesty, colour maps).

## Required changes

1. `src/maps/`:
   - `gridFor(width, height)`: long side 128 cells;
   - `normalise`, `resample` (bilinear), `pearson(a, b)` and `difference(a, b)`.
   In dev builds (`import.meta.env.DEV`), assert that every map a model returns
   sums to 1 within 1e-6.
2. `src/render/`:
   - a 256-entry magma lookup table;
   - a colour-blind-safe diverging blue → neutral → orange table (prepared now,
     used in 010);
   - drawing a map at image size with bilinear upsampling;
   - overlay alpha: the value scaled by its 99th percentile, clamped to [0, 1],
     times the slider value.
3. `src/models/registry.ts` with `ModelSpec` exactly as in the spec. The view
   is generated from the registry, so models added later appear without UI
   changes.
4. `src/models/centre-bias.ts`, implementing the Clarke and Tatler (2014)
   definition in the spec exactly: σ² = 0.22, ν = 0.45, coordinates normalised
   by half the image width. Fill in the registry entry, including the MIT300
   benchmark figures from the spec.
5. Overlay view:
   - a model selector (segmented buttons);
   - an opacity slider from 0 to 100, default 60;
   - a "Predicted" label on the stage;
   - a legend reading "less likely ← → more likely".

## Do not implement

Do not implement:
- classic salience (007) or UNISAL (008–009);
- side by side, "What AI adds" or agreement (010);
- remote models.

## Acceptance criteria

The task is complete when:
- choosing a photo shows the centre-bias overlay, and the slider fades it
  smoothly;
- on a 4:3 photo the map peaks at the centre and spreads further horizontally
  than vertically;
- the dev-mode sum check never fires;
- `npm run check` passes.

## Checks

`npm run check`; manual check with a landscape example and a portrait upload.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
