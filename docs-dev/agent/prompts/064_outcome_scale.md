# Task: Show why an outcome is what it is

## Goal

Owner's request of 2026-10-19, recommendation 7 of
`qualities_improvement_research.md`. "Unclear" can mean close to a threshold
or held back by another condition, and the methods often disagree without the
page saying so. Draw each outcome's main indicator on a small scale with the
rule's bands, and mark where the methods disagree.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The outcome cards (`src/views/qualities.ts`, prompt 055) show the outcome,
  reasons and "The numbers".
- The rules' main indicators and thresholds:
  - rhythm: `rhythmicShare`, < 0.10 likely absent, ≥ 0.25 likely present
    (with at least 2 façade zones);
  - ground floor: `openShare`, < 0.10 likely absent (with a closed share
    ≥ 60%), ≥ 0.30 likely present;
  - materials: `texturedShare`, < 0.10 likely absent (with smooth ≥ twice
    textured), ≥ 0.25 likely present.
- Methods with a present/ambiguous/absent label per photo:
  - the image measure;
  - the graded panel (median ≥ 3 / ≤ 1);
  - the observed panel (prompt 060);
  - UP-CLIP (terciles, `agreement.py`).

## Required changes

1. In each card, a small horizontal scale (0–100%) of the main indicator
   with the three bands ("likely absent", "unclear", "likely present"),
   their thresholds, and the photo's value as a marker. When the outcome
   differs from the band the value falls in, the note gives the other
   condition (from the rule, e.g. "one façade zone only").
2. Under the scale, the labels of the other methods in one line ("Panel,
   rated: present · Panel, observed: absent · UP-CLIP: ambiguous"), and
   "Methods disagree" when any two of the image measure and the two panels
   give present and absent. The all-photos table marks such cells.
3. Accessible: the scale has a text equivalent ("openShare 24%: unclear band,
   10–30%"); it works on a phone.
4. Specification (bump, *Changes*), `docs/usage.md`, `current_state.md`.
5. Deploy and check the live page.

## Do not implement

Do not implement:
- changes to any rule, measure or panel;
- a combined score of the methods.

## Acceptance criteria

The task is complete when:
- every card shows its scale, value and bands, and the other methods'
  labels;
- disagreements are marked in the card and in the table;
- `npm run check` passes and the live page behaves as above at desktop and
  phone width.

## Checks

`npm run check`; `npm run preview` on a photo with agreement and one with
disagreement; phone width; deploy and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
