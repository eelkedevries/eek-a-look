# Task: DeepGaze maps for the Zürich photos

## Goal

Pre-compute DeepGaze IIE and MSDB maps for the 12 Zürich photos, so that all
five models can be compared with the measured maps.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/deepgaze-local/precompute.py` (prompt 013) writes maps for every
  photo in `public/examples/examples.json`. It uses CUDA when present and the
  CPU otherwise.
- A cloud session has no GPU (4 CPUs and 15 GB RAM, checked 2026-10-18), so
  this prompt must work on the CPU. Expect minutes per photo for MSDB.
- The 24 existing maps were made on the owner's GPU and must not change.
- The measured maps from 018 are in `public/precomputed/measured/`, on the
  same 128 × 96 grid.

## Required changes

1. Add a `--only-missing` flag to `precompute.py`: skip a photo when its map
   for that model already exists. Without the flag, behaviour is unchanged.
2. Run `uv run precompute.py --only-missing` and keep the 24 new maps.
3. Extend the printed table: for each Zürich photo, Pearson r between each
   DeepGaze map and the measured map, and the mean per model.
4. Document the flag and the measured CPU run time in
   `tools/deepgaze-local/README.md`.

## Do not implement

Do not implement:
- any page change (020);
- recomputing the existing maps;
- changes to the pinned dependencies or model settings.

## Acceptance criteria

The task is complete when:
- 24 new files exist under `public/precomputed/deepgaze-*/zurich-*.json`,
  and `git diff --stat` shows no change to the existing 24 maps;
- every new map is valid (non-negative, sums to 1 after decoding);
- the table with r against the measured maps is printed and quoted in the
  final report;
- `npm run check` passes.

If the CPU run fails (memory, time or installation), stop, report the error
and the progress so far, and do not commit partial maps.

## Checks

`cd tools/deepgaze-local && uv run precompute.py --only-missing`;
`npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
