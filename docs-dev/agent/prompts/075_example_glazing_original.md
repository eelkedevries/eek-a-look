# Task: Example 3 compares the transparent frontage with the original photograph

## Goal

Owner's request of 2026-10-25: example 3 compares the edited photograph with
transparent glazing against the untouched original instead of against the
opaque version. Redo every map, area and calculation for it, and remove the
opaque version and the text about it.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The two glazing versions shared one change mask (prompt 071b). With the
  opaque version gone, the transparent edit gets its own mask, so its
  composite changes slightly; it gets a new id, `zurich-53-glass-frontage`,
  because the host's proxy cache keeps images for 30 days.

## Required changes

1. `composite.py`: the transparent edit alone, with its own mask; prepare
   the new image; remove the raw opaque edit and its `edits.json` entry.
2. Remove `zurich-53-opaque-frontage` and `zurich-53-transparent-frontage`
   (images, thumbnails, DeepGaze maps, area files) from the site.
3. DeepGaze IIE and MSDB maps, automatic areas with SAM 3 façade elements,
   and the glazing region for `zurich-53-glass-frontage`; `comparisons.json`
   with A = `zurich-53`.
4. Texts of example 3; specification (version bump), `docs/usage.md`,
   `tools/comparisons/README.md`, `docs-dev/planning/current_state.md`.

## Do not implement

- Changes to examples 1 and 2 or to the page's layout.

## Acceptance criteria

- Outside the change mask the new image equals the original apart from JPEG
  noise.
- No file or text refers to the opaque version except as history.
- No console errors; `npm run check` passes.

## Checks

`npm run check`; the built page and the workspace for the new image in
headless Chromium.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
