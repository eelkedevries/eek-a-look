# Task: Correct the text of example 3 (glazing)

## Goal

Owner's request of 2026-10-25 ("Update text for 3"), after the check of
examples 1 and 3: the numbers and images of example 3 are correct, but its
text claims more than the images support.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- "Everything else is held constant" is not true: B adds a bright,
  colourful shop interior, so brightness, colour and detail change together
  with transparency.
- In the untouched photograph the frontage lies in deep shade under the
  canopy; A's grey panels are lit far more brightly, so A is not a neutral
  baseline either.
- "The whole ground-floor frontage" is not edited: the far-left bay keeps
  the original windows in both versions. The measured area includes the red
  door, which is the same in both.

## Required changes

1. `src/content/comparisons.ts`, example 3: question, background,
   manipulated, conditions and the area note, stating only what the images
   show.
2. `public/examples/comparisons.json`: the `changes` lines of the two
   glazing images.
3. Specification (version bump) and `tools/comparisons/README.md` where they
   describe the glazing images.

## Do not implement

- Changes to images, maps, areas, numbers or other examples.

## Acceptance criteria

- No sentence on the page claims that only transparency differs.
- `npm run check` passes; no console errors.

## Checks

`npm run check`; the built page in headless Chromium at 1400 px.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
