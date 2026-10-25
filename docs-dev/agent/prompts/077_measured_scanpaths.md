# Task: Measured gaze per participant

## Goal

Add the participant-level measured gaze from the Osnabrück–Hamburg database
(Wilming et al., 2017) to eek-a-look: per participant, the fixations in
their order, instead of only the pooled fixations per photo.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Owner's request of 2026-10-25: eek-a-look should have the participant
  data, not only the group-level data, starting with the three A photos of
  the Example section (`zurich-42`, `zurich-33`, `zurich-53`).
- `tools/measured-gaze/build.py` reads the Baseline study (Onat, Açık,
  Schumann & König, 2014; free viewing for 6 s) from the cached HDF5 file
  (`fetch.py`; CC0 1.0). It reads `SUBJECTINDEX` and `fix` (the fixation
  number within a trial) but uses them only to drop each trial's first
  fixation, which starts on the central fixation cross, and to count
  observers.
- `public/precomputed/measured/<id>.points.json` therefore holds only pooled
  x–y positions and the number of observers: 48 observers and 825–887
  fixations for each of the three A photos. There is no participant, no
  order and no duration.
- The edited B photos were never shown to people and have no measured data.
- Prompt 076 (predicted fixations and scanpaths) asks in question 6 whether
  to add measured scanpaths. If 077 runs first, 076 can use its output.

## Questions for the owner

Before writing code, check what the source file contains per fixation
(for example timing or duration fields), report it, then ask the owner the
following and wait for the answers. Give the options you see.

1. Which photos: the three A photos only, all twelve Zürich photos, or
   also the four Andersson et al. (2017) photos.
2. What to keep per fixation: participant (as the database's anonymous
   index only), order, and timing or duration if the source has it; and
   whether each trial's first fixation (on the fixation cross) stays out,
   as in the existing maps.
3. How to show the data: in which views (Example section, single map,
   both), and in what form (one participant at a time with a selector,
   several at once, numbered gaze paths such as those in Suurenbroek &
   Spanjar, 2023).
4. Whether to add a group summary derived from the scanpaths, for example
   the share of participants who fixate a given area within their first k
   fixations.

## Required changes

1. `tools/measured-gaze/` writes the participant-level data for the chosen
   photos to `public/precomputed/measured/`, in a format consistent with the
   existing files. The existing map and points files stay unchanged.
2. The site shows the data as chosen in question 3, labelled as measured
   gaze and with the source and number of participants.
3. Texts: `specification.md` (version bump), `docs/usage.md`,
   `tools/measured-gaze/README.md`, the About text where it describes the
   measured data, and `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- changes to the existing measured maps or points files;
- predicted fixations or scanpaths (prompt 076);
- other eye-tracking datasets;
- any participant information beyond the database's anonymous index.

## Acceptance criteria

The task is complete when:
- pooling the new per-participant fixations of each photo reproduces its
  existing `points.json` exactly (same fixations, same count);
- the existing measured map and points files are byte-identical to before;
- the site shows the participant data as chosen, without console errors;
- `npm run check` passes.

## Checks

`npm run check`; the pooling check above for every photo added; the built
page in headless Chromium for the affected views.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.
Then run `npm run deploy` and check the live page.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`. Make sure it
states (1) the work done and whether it was fully completed, (2) open issues
or problems, and (3) the human actions required before proceeding.
