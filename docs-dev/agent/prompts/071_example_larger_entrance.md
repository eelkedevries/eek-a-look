# Task: A much larger manipulation for example 1

## Goal

Owner's request of 2026-10-19: make the manipulations much larger,
especially for example 1, whose blue-teal door frame covered about 1% of the
image.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The edited images came from the owner's package (AI image editing). No
  image-editing model is available without credentials: the FLUX.1 Kontext
  Space refuses anonymous calls (ZeroGPU quota) and the Hugging Face
  connector does not invoke Spaces. Examples 2 and 3 need generated content
  (planting, interiors) and wait for a Hugging Face token.
- Example 1 is a colour change, which can be made by rule.

## Required changes

1. `tools/comparisons/recolour.py`: recolour the whole rusticated stone block
   around the entrance of zurich-42 in the first edit's blue-teal hue at a
   clearly visible chroma, keeping CIELAB lightness; cut out the door, steps,
   sign and coloured pixels; change nothing outside the block. Prepare the
   result as `zurich-42-entrance-block` and replace
   `zurich-42-entrance-surround` (image, thumbnail, maps, areas).
2. Recompute its DeepGaze IIE and MSDB maps, Classic salience and UNISAL
   maps and automatic areas; rerun `regions.py` with a search box that holds
   the whole block.
3. Example 1's texts (conditions, label, outcomes, area note), the intro and
   caveat; specification (0.50), `docs/usage.md`, `tools/comparisons/README.md`,
   `docs-dev/planning/current_state.md`.

## Do not implement

- New images for examples 2 and 3; changes to the page's layout or
  computation.

## Acceptance criteria

- Image B differs from A only inside the stone block, apart from JPEG
  re-encoding noise.
- The manipulated area covers the door and the whole recoloured block.
- Unchanged images reproduce their maps exactly.
- No console errors; `npm run check` passes.

## Checks

`npm run check`; `node scripts/validate-examples.mjs`; the built page in
headless Chromium at 1400 and 390 px.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
