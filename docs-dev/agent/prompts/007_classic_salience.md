# Task: Classic salience model (Itti–Koch)

## Goal

Add the classic low-level salience model, after Itti, Koch and Niebur (1998),
running in a Web Worker, and register it.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

`specification.md`: *Domain rules* (classic salience definition: no centre
bias, own implementation, no benchmark figures). Itti, L., Koch, C. and
Niebur, E. (1998). A model of saliency-based visual attention for rapid scene
analysis. *IEEE TPAMI* 20(11), 1254–1259.

## Required changes

1. `src/models/classic-salience/worker.ts`. Receive the image as a transferred
   `ImageBitmap`, downscaled to 512 px on the long side, and compute:
   - intensity I = (r + g + b) / 3;
   - broadly tuned R, G, B and Y channels, normalised by I, and set to 0 where
     I < max(I) / 10, as in the paper;
   - Gabor orientation channels at 0°, 45°, 90° and 135°;
   - a dyadic Gaussian pyramid with levels 0–8;
   - centre–surround differences with c ∈ {2, 3, 4} and s = c + δ,
     δ ∈ {3, 4}, giving 42 feature maps;
   - the normalisation operator N(·): scale to [0, M], then multiply by
     (M − m̄)², where m̄ is the mean of the other local maxima;
   - across-scale addition at level 4 into conspicuity maps for intensity,
     colour and orientation;
   - S = (N(Ī) + N(C̄) + N(Ō)) / 3;
   - a Gaussian blur (σ ≈ 3 % of the image width), resampled to the shared
     grid and normalised.
2. A comment block at the top of the worker records the parameters and every
   deviation from the paper.
3. Register the model:
   - name "Classic salience", kind `classic`;
   - licence "own implementation";
   - citation Itti, Koch and Niebur (1998);
   - no `benchmark` entry;
   - `oneLine`: "Spots that stand out in brightness, colour or edge direction."
4. While the worker runs, show a "Computing…" state on that model's button.

## Do not implement

Do not implement:
- GBVS, the image signature or other variants;
- mixing in centre bias;
- UNISAL or comparison views.

## Acceptance criteria

The task is complete when:
- on the example photos the map picks out high-contrast details (signs, bright
  façades, skyline edges) rather than only the centre;
- the page stays responsive while it computes (it runs off the main thread);
- one 1600 px photo takes under about 1 s on a mid-range laptop (report the
  timing);
- `npm run check` passes.

## Checks

`npm run check`; manual comparison across at least four examples, with the
timing logged in dev mode.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
