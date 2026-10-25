# Task: A lower hedge for example 2, and DeepGaze MSDB only in the Example section

## Goal

Owner's request of 2026-10-25: the greenery example looked odd. The hedge of
prompt 071b came out about 4–5 m tall, not the 2 m described: it hides the
whole ground floor, windows included, so the comparison mixes added planting
with removed façade detail. Redo the edit with a low hedge that leaves the
ground-floor windows visible, and show only DeepGaze MSDB in the Example
section ("only do this work for DeepGaze MSDB").

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- FLUX.1 Kontext [dev], Space `mcp-tools/FLUX.1-Kontext-Dev`, as in 071b;
  the owner allowed one run (another seed only if it fails).
- The owner chose: recompute DeepGaze MSDB only, and show only DeepGaze MSDB
  in the Example section, so that no out-of-date map is shown.

## Required changes

1. One FLUX.1 Kontext run on the untouched zurich-33: a low trimmed hedge,
   about 1 m tall, in front of the grey base, below the ground-floor
   windows. Replace `edits/zurich-33-hedge.webp` and its entry in
   `edits.json`; composite with `composite.py`; prepare with
   `scripts/prepare-photos.mjs`.
2. Recompute the DeepGaze MSDB map of `zurich-33-hedge` and the greenery
   region (`regions.py`, which reports MSDB and, for A only, measured gaze).
3. Remove what would otherwise be out of date or unused for the new image:
   its DeepGaze IIE map and area file, and the Example section's Classic
   salience and UNISAL maps with `browser-models.mjs`.
4. `src/views/example.ts`: only DeepGaze MSDB (and the photo); no per-model
   table.
5. Texts of example 2 and the section; specification (version bump),
   `tools/comparisons/README.md`, `docs/usage.md` where it describes the
   section, `docs-dev/planning/current_state.md`.

## Do not implement

- Examples 1 and 3 beyond the shared section changes; other models; area or
  quality recomputation.

## Acceptance criteria

- The new hedge stays below the ground-floor windows; outside the change
  mask the image equals the original apart from JPEG noise.
- The page states only what the MSDB numbers show.
- No console errors; `npm run check` passes.

## Checks

`npm run check`; the built page in headless Chromium at 1400 and 390 px.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
