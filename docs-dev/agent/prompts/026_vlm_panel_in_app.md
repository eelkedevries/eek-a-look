# Task: Show the simulated panel's judgement

## Goal

Show, for each example photo, the simulated panel's judgement on the three
design principles, clearly labelled as an AI judgement and not an expert one.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Panel output: `public/precomputed/vlm-panel/panel.json` (024).
- The Areas tab exists (025); the panel goes under its table.
- The near-top statement and the honesty rules are in the specification.

## Required changes

1. In the Areas tab, under the table, add a block headed "Simulated panel ·
   AI judgement, not experts". Load `panel.json` with a content-hash version,
   as the area files are loaded.
2. For each principle (in the order rhythm and variety, active ground floor,
   tactile materials), show:
   - the verdict ("Present", "Absent" or "No consensus");
   - the votes ("7 of 8 present");
   - one evidence sentence.
   Present the verdicts as text, not traffic-light colours.
3. Add a caption of at most 60 words: eight runs of a vision-language model
   (Qwen3-VL), each asked as a different kind of designer, judged the photo on
   the three principles an HvA expert panel used (Spanjar & Suurenbroek 2020).
   A verdict needs six of eight to agree. No experts judged these photos, so
   it is not validated.
4. On uploads, show nothing for the panel.
5. About:
   - a paragraph "Simulated panel" (60–100 words) with the method, the
     agreement and stability figures from `panel.json`, and the caveats
     (cultural bias, Zhao et al. 2026; not validated);
   - a credit for the model used (Qwen3-VL, Apache-2.0).
6. Specification (bump the version, with a line in *Changes*):
   - the panel block;
   - the consensus rule;
   - the honesty label;
   - "AI judgement" under *Naming and voice*.
   Update `docs-dev/planning/current_state.md`.
7. Deploy with `npm run deploy` and check the live page.

## Do not implement

Do not implement:
- a combined score, or mixing panel verdicts into the gaze statistics;
- panel judgements for uploads;
- any change to the panel's output or its prompt.

## Acceptance criteria

The task is complete when:
- on zuidas-gershwinplein and zurich-23, the block shows three verdicts with
  votes and evidence, under the heading and with the caption;
- an upload shows no panel block, and no console errors occur;
- `npm run check` passes, the change is deployed, and the live page shows the
  block on one example photo, described in the final report.

## Checks

`npm run check`; local preview of one Dutch photo, one Zürich photo and an
upload; `npm run deploy`; live check.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
