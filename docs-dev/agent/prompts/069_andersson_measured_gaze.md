# Task: Photos with measured gaze from Andersson et al. (2017)

## Goal

Add the openly licensed photos of Andersson et al. (2017) that come with
hand-labelled fixations to the library, as a group of their own, and treat
them exactly as the Zürich photos with measured gaze.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- **Owner's request of 2026-10-19** (run as given): add the publicly
  available eye-tracking data of Andersson et al. (2017) "following the same
  conventions and functionality as the existing measured-gaze dataset from
  Wilming et al. (2017)"; include all suitable static-image stimuli with
  measured fixation data, not videos or moving targets; use the manually
  annotated fixations; a separate library group "Andersson et al. (2017)";
  measured heatmaps, fixation points, fixations over measured and predicted
  maps, comparisons with every model, the display settings, and Areas and
  Qualities where applicable; all four predictions; metadata, citations and
  attribution, with redistribution verified; documentation and
  reproducibility from the original sources; validation of the coordinates;
  checks, fixes and a deploy. "The objective is to expand the existing image
  library with additional images containing real fixation measurements, not
  to introduce a new analysis framework or redesign the application."
- **Source:** Andersson, Larsson, Holmqvist, Stridh & Nyström (2017),
  *Behavior Research Methods* 49, 616–637, doi:10.3758/s13428-016-0738-9.
  Data and stimuli: `github.com/richardandersson/EyeMovementDetectorEvaluation`
  at commit `3e12416ab3fd6254c81811cf03f8e5d67c5d7129`. Its `README.docx`:
  "The software, data, and stimuli were released under the GNU General Public
  License v. 3"; `LICENSE` is the GPL v3 text.
- **Checked on 2026-10-19:** five photos of 1024 × 768 px, shown full-screen
  on a 1024 × 768 screen (0.38 × 0.30 m, 0.67 m), so screen pixels are photo
  pixels. Four have recordings in `annotated_data/data used in the article/img/`
  (14 recordings, one person and one photo each, both coders); `Blad` has
  none. The repository advises the corrected file in `fix_by_Zemblys2018/`
  and calls the folder `originally uploaded data` partly wrong. Every
  recording starts with a fixation at the screen centre.
- SAM 3 is gated and the UP-CLIP reproduction and the simulated panel need
  the owner's laptop, so a cloud session cannot compute them.

## Required changes

1. `tools/measured-gaze/fetch_andersson.py` and `build_andersson.py`: fetch
   the pinned files with SHA-256 checks; build maps, points, manifest
   entries (group "Andersson et al. (2017)", after Zürich), a GPL notice
   and check overlays from coder MN's labels, with RA's as a check. Recipe
   in the specification, *Measured gaze*.
2. The app: `city` optional where the place is not certain; the measured
   layer's subtitle gives the photo's number of people; the method text,
   About credits and the near-top notice name both datasets; the rating page
   keeps its 49 photos; the validator accepts the group and "GNU GPL 3.0".
3. DeepGaze IIE and MSDB maps (`precompute.py --only-missing`), areas
   (`build.py --only-missing`, without SAM 3 façade elements) and the
   materials measure (`build.py --materials --only-missing`) for the four
   photos; no existing file changes.
4. Specification 0.46, `current_state.md`, `plan.md`, the tool README and
   `docs/usage.md`.

## Do not implement

- the 6 extra recordings of `originally uploaded data`, videos, moving dots;
- SAM 3 façade elements, the ground-floor and rhythm measures, the simulated
  panel or UP-CLIP for these photos (laptop steps);
- any change to the Zürich data, the existing maps or the views' design.

## Acceptance criteria

- `uv run fetch_andersson.py && uv run build_andersson.py` runs from a clean
  clone; four maps of 128 × 96 that sum to 1;
- the check overlays show fixations on content, without an offset;
- on these photos the page shows the measured layer first, its fixation
  points over measured and predicted maps, the match of all four models,
  the display settings, Areas, and Qualities (materials);
- `npm run check` passes, the change is deployed and checked live.

## Checks

The two scripts; the overlays; `npm run check`; screenshots; `npm run deploy`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
