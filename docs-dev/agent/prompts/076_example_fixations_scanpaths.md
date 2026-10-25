# Task: Predicted fixations and scanpaths in the Example section

## Goal

For the three design comparisons in the Example section, add predicted
fixation points sampled from DeepGaze MSDB and predicted scanpaths from
DeepGaze3.5-VL, computed on the laptop GPU.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Owner's request of 2026-10-25: the heatmaps stay DeepGaze MSDB; add
  fixation predictions and scanpaths, with MSDB for the fixations and
  DeepGaze3.5-VL for the scanpaths.
- Example section: `src/views/example.ts`, `src/content/comparisons.ts`,
  `public/examples/comparisons.json` (three A images, three B images). Maps
  are pre-computed with `tools/deepgaze-local/`.
- DeepGaze MSDB returns a fixation density. Points drawn from it are
  independent draws, not a sequence.
- DeepGaze3.5-VL (Agrawal, Bethge & Kümmerer, 2026, arXiv:2607.02083;
  https://github.com/Susmit-A/DeepGaze3.5-VL): a rank-32 LoRA adapter
  (language-model layers only, about 350 MB via Git LFS) on
  `OpenGVLab/InternVL3_5-8B-HF`. The free-viewing adapter
  (`model/combined_adapter/`) was trained on MIT1003, CAT2000, COCO-Freeview,
  DAEMONS and FIGRIM, and returns fixations on a 0–99 grid (8 by default).
  Its prompt describes 3 seconds of free viewing. The repository pins vLLM
  0.11.2, transformers 4.57.6, peft 0.18.1 and torch 2.9.0.
- Licence: the code and adapter are released for non-commercial research use
  only; the base model has its own licence. Follow the licence position of
  `tools/deepgaze-local/README.md`: install at run time, publish only the
  outputs.
- Hardware: RTX 4070 Laptop GPU with 8 GB. The base model in bf16 (about
  17 GB) does not fit. Any quantised or offloaded run deviates from the
  published model and must be documented as such.
- Measured gaze for the A images (`zurich-42`, `zurich-33`, `zurich-53`):
  Wilming et al. (2017) fixations in `public/precomputed/measured/`. The
  `points.json` files keep no observer or order; since prompt 077,
  `<id>.scanpaths.json` keeps them per participant and in order, without
  timing (the source has `start` and `end` in ms).
- Owner's decision of 2026-10-25: DeepGaze3.5-VL keeps its published
  3-second prompt (no 6-second prompt, no retraining). Any comparison with
  the measured 6-second paths uses only their first 3 seconds, which needs
  the fixation start times from the source.

## Questions for the owner

Before writing code, ask the owner the following and wait for the answers.
Give the options you see, with their expected memory use, run time and loss
of fidelity where relevant.

1. How to run DeepGaze3.5-VL within 8 GB.
2. The number of sampled MSDB fixations per image, and the number and length
   of the DeepGaze3.5-VL scanpaths per image.
3. The sampling settings for DeepGaze3.5-VL, so that the set represents a
   distribution rather than one most-likely path.
4. How to show fixations and scanpaths in the Example section: how many
   scanpaths are drawn, and in what style. The numbered gaze paths in
   Suurenbroek & Spanjar (2023) are a possible reference.
5. The summary measure: the share of predicted scanpaths with at least one
   fixation in the manipulated area within the first k fixations, for A and
   B and as a difference. Confirm k.
6. Whether to add measured scanpaths (ordered, per observer) for the three
   A images from the Wilming et al. source data, as a check on the
   predicted ones.

## Required changes

1. A pre-computation tool under `tools/`, following the conventions of
   `tools/deepgaze-local/`, that writes for the six images of
   `comparisons.json` the sampled MSDB fixations and the DeepGaze3.5-VL
   scanpaths to `public/precomputed/`, with the settings recorded next to the
   outputs (model versions and commits, seed, quantisation or offloading,
   sampling parameters).
2. The Example section shows the predicted fixations and scanpaths for A and
   B, labelled as predicted and naming the model. It states that the heatmap
   (MSDB) and the scanpaths (DeepGaze3.5-VL) come from different models.
3. Per example, the summary measure of question 5 for A, B and B − A.
4. Texts: `specification.md` (version bump), `docs/usage.md`, the model
   texts checked by `scripts/check-method-texts.mjs` where they list models,
   `README.md`, `docs-dev/planning/current_state.md`, and the new tool's
   README with its licence position and the fidelity note.

## Do not implement

Do not implement:
- other scanpath or saliency models;
- fixations or scanpaths for uploads or the library photos, unless the
  owner's answers ask for it;
- changes to the existing IIE or MSDB maps;
- fixation durations or a time axis (the models predict order, not timing);
- statements about experience or well-being based on these predictions.

## Acceptance criteria

The task is complete when:
- the six images have fixation and scanpath files, and a re-run with the
  same seed reproduces them;
- the Example section shows them, labelled as predicted, without console
  errors;
- the summary numbers on the page equal a recomputation from the stored
  files;
- the deviation from the published model (if any), the licence position and
  the settings are documented;
- `npm run check` passes.

## Checks

`npm run check`; the built page for the three examples in headless Chromium;
a recomputation of the summary measure from the stored files.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.
Then run `npm run deploy` and check the live page.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`. Make sure it
states (1) the work done and whether it was fully completed, (2) open issues
or problems, and (3) the human actions required before proceeding.
