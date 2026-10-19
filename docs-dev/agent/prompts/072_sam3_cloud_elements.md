# Task: SAM 3 façade elements without the laptop

## Goal

Owner's request of 2026-10-19 ("Try B"): add the SAM 3 façade elements that
were left as a laptop step, in a cloud session on the CPU, for every area
file without them, and then the Andersson photos' ground-floor and rhythm
measures.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- SAM 3 is gated. The owner's Hugging Face token, granted access, was added
  as a network secret for `huggingface.co`.
- Eight area files have no façade elements: the four Andersson photos
  (prompt 069) and the four edited images of the Example section (prompts
  071, 071b).
- `elements.py --apply` reads the winners from a local cache file that only
  the laptop had; `validation.json` holds the same winners.

## Required changes

1. Rebuild `tools/areas/.cache/elements_comparison.json` from the `elements`
   section of `validation.json` (not committed) and run
   `elements.py --apply --only-missing`.
2. Run `tools/qualities/build.py --ground-floor --rhythm` for the four
   Andersson photos only; recompute the summaries of `checks.json` and
   `qualities_validation.md` that follow from the stored results (sensitivity,
   discrimination, panel cross-table) without rerunning the dataset checks;
   correct the hard-coded counts in `checks.py`.
3. Specification (0.54), `tools/areas/README.md`, `tools/qualities/README.md`,
   `tools/comparisons/README.md`, `docs-dev/plan.md`,
   `docs-dev/planning/current_state.md`.

## Do not implement

- Changes to the rules, the models or the other photos' files; the panel and
  UP-CLIP for the Andersson photos.

## Acceptance criteria

- The eight area files have windows, entrances, balconies and shopfronts from
  SAM 3; no other area file changes.
- The four Andersson quality files have all three measures.
- `npm run check` passes.

## Checks

`npm run check`; the Qualities and Areas views for an Andersson photo and an
Example image in headless Chromium.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
