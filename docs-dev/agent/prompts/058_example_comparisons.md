# Task: Example section with three design comparisons

## Goal

Owner's request of 2026-10-19 (package `eek-a-look-three-comparisons`): a
menu with Workspace, **Example**, About and the other sections. Example opens
an overview of three questions (entrance, greenery, glazing) with access to
each complete image comparison: the question, what changed, the expected
pattern and what the models actually predict, with the images and their
predicted gaze to compare. Every image fully processed in advance; measured
gaze kept apart from predictions for edited images. Illustrations, not
studies.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Supplied: the originals zurich-42, zurich-33 and zurich-53 (identical to
  the library's) with their fixations (identical to
  `public/precomputed/measured/*.points.json`), and four edited images at
  1448 × 1086 px: a blue-teal entrance surround (zurich-42), low planting
  (zurich-33), and opaque and transparent glazing of the same three window
  bays (zurich-53, both with the same unplanted containers).
- DeepGaze and the areas run in `tools/deepgaze-local/` and `tools/areas/`;
  Classic salience and UNISAL run in the browser.

## Required changes

1. Scale the edited images to 1280 × 960 (the originals' size), prepare
   them with `scripts/prepare-photos.mjs`, and list them in
   `public/examples/comparisons.json` with credits and the three
   comparisons; not in the library. Validate it in
   `scripts/validate-examples.mjs`.
2. Pre-compute DeepGaze IIE and MSDB and the automatic areas for the edited
   images; Classic salience and UNISAL for all seven images with the app's
   code in headless Chromium; and each comparison's changed region from the
   pixel difference (`tools/comparisons/`).
3. An "Example" section and menu item: three cards, and for the chosen
   comparison its text, a generated summary of what the models predict, the
   two images side by side, as a slider or as a difference, any layer,
   outlined areas, and a table of the share of attention per layer in A and
   B with B − A and r. Measured gaze only for untouched originals. Links open
   either image in the workspace.
4. Specification (0.38), `docs/usage.md`, tool READMEs,
   `docs-dev/planning/current_state.md`.
5. Deploy and check the live page.

## Do not implement

- Measured gaze, or anything presented as measured, for an edited image.
- New models, a visitor tool for drawing areas, or statistics beyond shares,
  differences and r.
- The edited images in the photo library or in the Qualities, panel or
  UP-CLIP files.

## Acceptance criteria

- The menu reads Workspace, Example, Agreement, Methods, About; Example shows
  three cards and opens each comparison without uploads or processing.
- Each comparison shows the question, what changed, the expected pattern (as
  a hypothesis) and a summary generated from the numbers, which match
  `tools/comparisons/regions.py`.
- A measured layer appears only on zurich-42 and zurich-33 as A; for
  glazing, only as a note on the untouched original.
- No console errors; no sideways scroll at phone width; `npm run check`
  passes.

## Checks

`npm run check`; the dev page in headless Chromium at 1400 and 390 px for all
three comparisons and modes; opening an edited image in the workspace.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
