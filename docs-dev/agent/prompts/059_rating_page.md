# Task: A rating page and rubric for human raters

## Goal

Owner's request of 2026-10-19 ("use your recommendations. Run all prompts"),
recommendation 1 of `qualities_improvement_research.md`. No outcome on the
Qualities view has been checked against people. Give raters a page on which
they judge the 49 example photos on the three principles, with a written
rubric, and let `agreement.py` report how far the raters agree with each
other and with every method.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/qualities/agreement.py` reads one labels CSV (photo, principle,
  label, rater, note; label present, absent or ambiguous, the 2020 panel's
  scale) and reports each method's agreement. `labels_template.csv` lists the
  24 earlier photos only.
- The 2020 panel judged "the presence and quality of three design
  principles" per photo, without definitions (`qualities_sources.md`).
- The site is static; there is no server to receive ratings.

## Required changes

1. A rubric, `docs-dev/reference/secondary_background/rating_rubric.md`, and
   the same text on the page:
   - the question as the 2020 panel had it: is the principle present,
     ambiguous or absent in this photo, in your own professional judgement;
   - per principle, things to look at:
     - rhythm and variety: repeated bays across and floors or bands up;
       variety between neighbouring buildings;
     - active ground floor: entrances, shopfronts, blank or passive stretches
       (after the Urban Design Compendium's Table 5.3 and STIPO's plinth
       rating; only what the photo shows, not the use behind it);
     - tactile materials: visible texture and detail near eye level, on the
       façades and in the street space (paving, planting, furniture).

   The cues guide; they are not a scoring rule. The rubric says that study
   images are design renderings or 360° panoramas.
2. A page `rate.html` (`src/rate.ts`, `src/rate.css`), built with the site
   at `/eek-a-look/rate.html` and not linked from the main page:
   - an introduction, a field for the rater's initials and the rubric
     (collapsible);
   - one photo at a time, large, with the three questions (present,
     ambiguous, absent) and an optional note; previous and next; progress
     "n of 49";
   - a photo order shuffled per rater (seeded by the initials);
   - answers kept in the browser (`localStorage`, wrapped in try/catch) so a
     rater can stop and continue;
   - "Download ratings (CSV)" in the labels format with the initials in the
     rater column;
   - no outcome, measure, panel answer, heatmap or gaze anywhere on the page;
   - usable on a phone.
3. `agreement.py`:
   - `--labels` takes one or more files;
   - it reports the raters and Krippendorff's alpha among them per principle
     (nominal, and ordinal with absent < ambiguous < present);
   - then the majority label and each method's agreement, as now.

   `labels_template.csv` regenerated for the 49 photos. Check with two
   synthetic rater files in a temporary folder (not committed).
4. Specification (bump the version, with a line in *Changes*), a short "For
   raters" section in `docs/usage.md`, `tools/qualities/README.md` and
   `docs-dev/planning/current_state.md`.
5. Deploy and check the live page.

## Do not implement

Do not implement:
- a server or any upload of ratings;
- showing any of the site's results to raters;
- changes to the measures, the panel or UP-CLIP.

## Acceptance criteria

The task is complete when:
- `/eek-a-look/rate.html` shows the 49 photos one by one with the three
  questions and the rubric, keeps answers after a reload, and downloads a CSV
  that `agreement.py --labels` reads;
- the main page has no link to it, and it shows no results;
- `agreement.py` reports alpha among raters on the synthetic files;
- `npm run check` passes and the live page behaves as above.

## Checks

`npm run check`; `npm run preview` on `rate.html` (rate three photos, reload,
download, run `agreement.py` on the file and a second synthetic one); phone
width; deploy and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
