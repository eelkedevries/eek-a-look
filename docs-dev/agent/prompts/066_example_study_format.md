# Task: Example comparisons in a study format

## Goal

Owner's request of 2026-10-19: describe each of the three example
comparisons in a fixed format — question (one short sentence), background
(only what is needed), manipulation and conditions, and two possible
outcomes that can be contrasted — and show that format in the Example
section.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The text of the three comparisons is in `src/content/comparisons.ts`
  (question, explanation, what changed, expected pattern) and is rendered by
  `src/views/example.ts` with `src/views/example.css`.
- The owner approved the wording given in the session of 2026-10-19.

## Required changes

1. In `src/content/comparisons.ts`, replace `explanation`, `changed` and
   `expected` with `background`, `manipulated`, `conditionA`, `conditionB`
   and two `outcomes`, filled with the approved wording; adjust the caveat.
2. In `src/views/example.ts`, show Question, Background, Conditions (A, B and
   what is manipulated) and Possible outcomes (two, labelled as hypotheses),
   followed by the existing "What the models predict".
3. Specification (0.41), `docs/usage.md`.

## Do not implement

- Changes to the images, maps, measures, the generated summary or the
  overview cards.

## Acceptance criteria

- Each comparison shows the four parts in this order, then the generated
  summary; the outcomes are marked as hypotheses.
- No console errors; no sideways scroll at phone width; `npm run check`
  passes.

## Checks

`npm run check`; the dev page in headless Chromium at 1400 and 390 px for all
three comparisons.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
