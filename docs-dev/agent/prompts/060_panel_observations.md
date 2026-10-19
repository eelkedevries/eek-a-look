# Task: The simulated panel as observer

## Goal

Owner's request of 2026-10-19, recommendation 2 of
`qualities_improvement_research.md`. The graded panel rates rhythm 3–4 on
every photo. Vision-language models extract visible facts better than they
make judgements (UrbanAlign; the Montreal benchmark), and atomic questions
are more reliable than one holistic one (Davidsonian Scene Graph). Ask
Qwen3-VL what it sees, compute ratings from the answers by a fixed rule, and
weight the graded ratings by the model's probabilities so they no longer tie.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/vlm-panel/panel.py` runs Qwen3-VL-8B (4-bit) locally: v1
  present/absent and `--graded` 0–4 with boxes, eight members (four roles ×
  two seeds), sampled at temperature 0.7, with a second run for stability.
- `panel-graded.json` and `agreement.py` map a median ≥ 3 to present and
  ≤ 1 to absent.

## Required changes

1. `tools/vlm-panel/prompt_observe.md`, fixed before the run (a format check
   on one photo only). It asks for JSON answers to observable questions:
   - ground floor:
     - `entrances`: doors at street level, a count;
     - `shopWindows`: shop or display windows at street level, a count;
     - `blankStretch`: a street-level stretch without openings at least as
       long as a shopfront, yes or no;
     - `streetUse`: goods, seating or signs of use in front of the
       ground floor, yes or no;
   - rhythm:
     - `buildings`: distinct buildings or façades in view, a count;
     - `repeatedBays`: windows or bays that repeat at a regular spacing
       across a façade, yes or no;
     - `repeatedFloors`: floors or bands that repeat up a façade, yes or no;
     - `variety`: neighbouring façades that differ in height, colour or
       material, yes or no;
   - materials:
     - `materials`: from brick, natural stone, wood, tiles or setts,
       planting, plaster or paint, glass, metal, concrete, asphalt, those
       visible within about 3 m of the ground;
     - `texturedSurfaces`: surfaces near eye level with visible texture or
       detail, yes or no.
2. `uv run panel.py --observe`:
   - four sampled runs per photo (seeds 11, 23, 37, 41). Counts take the
     median, yes/no the majority (a tie is no), and a material counts if
     named in at least 2 of 4 runs;
   - per question, the share of photos on which all four runs agree, for
     stability.
3. Ratings by this rule, fixed here:
   - ground floor = [entrances ≥ 1] + [entrances ≥ 3] + [shopWindows ≥ 1] +
     [no blankStretch] + [streetUse], at most 4;
   - rhythm = [repeatedBays] + [repeatedFloors] + [variety] +
     [buildings ≥ 3];
   - materials = number of textured materials named (brick, natural stone,
     wood, tiles or setts, planting) + [texturedSurfaces], at most 4.

   Then ≥ 3 → present, ≤ 1 → absent, otherwise ambiguous, as for the graded
   panel.
4. Probability-weighted graded ratings:
   - for each of the four roles, one greedy pass of the unchanged graded
     prompt;
   - at each rating, the probabilities of the tokens 0–4 give an expected
     rating;
   - the photo's weighted rating is the mean over the roles.
5. `public/precomputed/vlm-panel/panel-observed.json` with the answers, the
   ratings, the weighted ratings, the stability and the model revision; a
   report (`tools/vlm-panel/README.md` and `qualities_validation.md`):
   - the spread of ratings per principle against the graded panel;
   - Spearman ρ with the image measure's main indicator (automated against
     automated);
   - stability.
6. Qualities view: "Methods for this photo" gets a row "Simulated panel,
   observed (rule)" with the rating and its main answers. The graded row adds
   "weighted x.x". `agreement.py` gets the observed panel as a method.
7. Specification (bump, *Changes*), `docs/usage.md`, `current_state.md`.
8. Deploy and check the live page.

## Do not implement

Do not implement:
- changing the questions or the rule after seeing the results;
- combining panel answers with gaze statistics;
- changes to v1, the graded run's stored answers or the image measures.

## Acceptance criteria

The task is complete when:
- `panel-observed.json` covers the 49 example photos;
- the report gives the spread, ρ and stability;
- the methods table shows the new row and the weighted rating;
- `npm run check` passes and the live page shows them.

## Checks

`cd tools/vlm-panel && uv run panel.py --observe`; `npm run check`;
`npm run preview` on two photos; deploy and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
