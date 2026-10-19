# Task: Much larger manipulations for examples 2 and 3

## Goal

Owner's request of 2026-10-19, continued from prompt 071: make the
manipulations of examples 2 (greenery) and 3 (glazing) much larger. They
need generated content, which became possible once the owner added a
Hugging Face token as a network secret for `*.hf.space`.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- FLUX.1 Kontext [dev] runs in the Space `mcp-tools/FLUX.1-Kontext-Dev`; it
  returns the whole photo regenerated, slightly rescaled and changed
  everywhere.
- Example 1 was enlarged by rule in prompt 071.

## Required changes

1. Edit the untouched zurich-33 (a hedge about 2 m tall along the base of
   all blocks) and zurich-53 (the whole ground-floor frontage either side of
   the red door, once opaque and once transparent); keep the raw outputs,
   prompts and seeds in `tools/comparisons/edits/`.
2. `tools/comparisons/composite.py`: register each output to its original,
   find the change mask inside a search box (one shared mask for the two
   glazing versions), and paste the edit over the original only there.
3. Replace `zurich-33-low-planting`, `zurich-53-opaque-glazing` and
   `zurich-53-transparent-glazing` (images, thumbnails, maps, areas) with
   `zurich-33-hedge`, `zurich-53-opaque-frontage` and
   `zurich-53-transparent-frontage`; recompute their maps and areas; point
   `regions.py` at the hedge and the whole frontage.
4. Texts of examples 2 and 3 and the caveat; specification (0.51),
   `docs/usage.md`, `tools/comparisons/README.md`,
   `docs-dev/planning/current_state.md`.

## Do not implement

- Changes to example 1, the page's layout or the computation.

## Acceptance criteria

- Outside the change mask, every new image equals its original apart from
  JPEG re-encoding noise.
- The manipulated areas cover the hedge and the whole frontage.
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
