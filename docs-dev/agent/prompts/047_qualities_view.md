# Task: The Qualities view

## Goal

Add a "Qualities" view that shows, per example photo and principle, the image
measure with its evidence on the photo, the definitions it rests on, how the
other methods judged the same photo, and how much attention the evidence
regions receive.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Data: quality files and `checks.json` (`public/precomputed/qualities/`,
  040–043); `panel.json` and `panel-graded.json` (024, 044); `scores.json`
  (`public/precomputed/up-clip/`, 046).
- The page is a workspace (prompt 028): a library, the views "Single map",
  "Side by side", "Contrast" and "Areas" (`mountTabs` in `src/main.ts`) and
  an inspector (`src/views/inspector.ts`) with a short note on the open view.
  Areas show both groups together (029). Build on the layout as it is when
  this prompt runs.
- The Areas view (`src/views/areas.ts`, `src/maps/areas.ts`) already draws
  masks on the greyed photo and computes attention ÷ size with
  `attentionShares`; reuse both. The panel block (`src/views/panel.ts`) sits
  under the Areas table today.
- Honesty and naming rules are in the specification: "image measure", "AI
  judgement"; panel and UP-CLIP outputs are never combined with gaze
  statistics.

## Required changes

1. A view **"Qualities"** after "Areas" in the workspace's view control
   (`src/views/qualities.ts`), with its own inspector note. Load the
   files with content-hash versions, as the area files are loaded. Uploads
   get "Qualities are computed in advance for the example photos only."
2. A switch for the three principles (rhythm and variety, active ground
   floor, tactile materials). For the chosen principle:
   - the greyed photo with the evidence layers (supports, against and
     context in three distinguishable Okabe–Ito colours, with a legend that
     fills a layer on hover or focus, as in Areas) and the tag **"Image
     measure · not an expert judgement"**;
   - the outcome as text ("Likely present", "Likely absent", "Unclear"), its
     reasons, and the indicators with plain names and values;
   - a toggle "Show the AI judgement's boxes" that draws the graded panel's
     boxes for that principle, labelled as AI judgement.
3. **Definitions**, collapsed by default: "Our definition" (the
   specification's operational definition) next to "In the original study":
   Spanjar & Suurenbroek (2020) had 14 experts judge whole photos as present,
   absent or ambiguous; they named the principles without defining them, and
   they did not judge these photos.
4. **Methods for this photo**, one row each, with what it is and whether it
   was checked against experts (always "no" for the principle; "parts
   checked against human labels" for the image measure, from `checks.json`):
   image measure; simulated panel (v1 verdict and votes); graded panel
   (median and range); UP-CLIP reproduction and plain CLIP (principle score,
   marked "adaptation"). Under it: "These methods are compared with each
   other, not with experts."
5. **Attention ÷ size** for the evidence layers of the image measure, per
   ready gaze layer (measured gaze first), with the Areas rules (to one
   decimal; "–" under 0.5% of the photo). No attention figures for the panel
   boxes or UP-CLIP.
6. **All photos**: a table of the 24 photos for the chosen principle, with
   the image-measure outcome, the panel v1 verdict, the graded median and the
   UP-CLIP reproduction score; a row of outcome counts; the
   non-discrimination notes from `checks.json` and `panel.json`. Choosing a
   photo name selects that photo.
7. Move the simulated panel block from the Areas view into the Qualities view
   (unchanged text and rules).
8. About: a paragraph "Architectural qualities" (60–100 words: the measures,
   that the definitions are this project's, what was and was not checked),
   and credits for DMS46 (Apple sample-code licence; labels CC BY-NC 4.0) and
   SAM 3 (SAM License acknowledgement).
9. Specification (bump the version, with a line in *Changes*): the Qualities
   view under *Scope* and *Derived views*, its honesty label and caption, and
   the panel block's new place. Update `docs-dev/planning/current_state.md`
   and the README.
10. Deploy with `npm run deploy` and check the live page.

## Do not implement

Do not implement:
- the UP-CLIP matching descriptions and photos (048);
- a combined score across methods;
- qualities for uploads, or changes to any pre-computed data.

## Acceptance criteria

The task is complete when:
- on every example photo the view shows the three principles with evidence,
  outcome, reasons and indicators, and the methods table;
- on zurich-23, the attention ÷ size of one evidence layer matches a value
  computed by hand from its mask and the measured map (to one decimal);
- uploads show the "example photos only" message;
- keyboard use works (tabs, switch, legend, toggle), with no console errors;
- `npm run check` passes and the live page shows the view after deploy.

## Checks

`npm run check`; `npm run preview` and click through four photos at 1440 and
390 px, one upload and the keyboard path; `npm run deploy` and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
