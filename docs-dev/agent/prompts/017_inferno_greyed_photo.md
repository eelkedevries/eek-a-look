# Task: Inferno heatmap on a greyed photo

## Goal

Draw heatmaps with matplotlib's inferno map over a greyed copy of the photo,
the style the owner chose (option C) after the colour-map research of
2026-10-18.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

Research summary:
- **Avoid rainbow maps.** Rainbow-like maps distort gradients (Borland and
  Taylor, 2007).
- **Viridis-family maps are the most accurate.** Viridis had the lowest error
  in Liu and Heer (CHI 2018).
- **Colour-blind readers.** Crameri, Shephard and Heron (Nature Communications,
  2020) ask for perceptually uniform maps that colour-blind people can read.
- **Peaks need a smooth map.** Smooth, less colourful maps help people find
  local features such as peaks (Reda, IEEE TVCG 2023).
- **Grey the photo.** Eye-tracking tools commonly grey or darken the image so
  the heatmap does not clash with its colours. With the warm map, red-brick
  façades blended into the heatmap.

## Required changes

1. Add an `INFERNO` lookup table (matplotlib, 256 entries, generated exactly).
   Set `drawHeatmap` defaults to index 0.35 + 0.65·t and alpha = 0.9·t^0.8.
   Remove the warm table if it is no longer used.
2. Add a shared helper that draws a greyed photo (Rec. 709 luminance × 0.75).
   Use it:
   - under every heatmap in the side-by-side and method cards; the photo
     cell itself stays in colour;
   - in the overlay, as a grey layer above the colour photo whose opacity
     follows the slider, so at 0 % the photo is in full colour.
3. Update:
   - the legend gradient;
   - the About credits (inferno, matplotlib, CC0);
   - the spec's *Colour maps* rule (bump the version);
   - the plan.

## Do not implement

Do not implement:
- a style switcher;
- changes to the "What AI adds" diverging map.

## Acceptance criteria

The task is complete when:
- all heatmaps use inferno over a greyed photo, and the slider at 0 % shows
  the photo in colour;
- red-brick photos no longer blend into the heatmap;
- `npm run check` passes and the change is live.

## Checks

`npm run check`; screenshots on a red-brick and a glass photo;
`npm run deploy`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
