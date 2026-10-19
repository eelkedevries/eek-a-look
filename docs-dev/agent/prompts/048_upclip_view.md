# Task: Matching descriptions and photos with UP-CLIP

## Goal

In the Qualities view, show which descriptions best match the current photo
and which example photos best match a chosen description, for the UP-CLIP
reproduction and plain CLIP, with each use marked as supported or adapted.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `public/precomputed/up-clip/scores.json` (046): descriptions with `kind`
  and `use`, similarity matrices for both models, retrieval figures from 045.
- The Qualities view exists (047). The example picker and thumbnails are in
  `src/examples.ts`.
- The published UP-CLIP checkpoint is not available; the page must say that
  this is a reproduction on 1,000 of the 15,000 pairs.

## Required changes

1. A section **"Descriptions and photos · UP-CLIP"** at the end of the
   Qualities view, with a model switch ("UP-CLIP reproduction", "Plain CLIP").
2. **Descriptions that match this photo:** the five best descriptions for
   the current photo, with their similarity to three decimals and a badge
   "Perception word" (supported use) or "Principle description"
   (adaptation).
3. **Photos that match a description:** a select list of all descriptions,
   grouped by kind; under it, the eight best example photos as thumbnails in
   order, with their similarity. Choosing a thumbnail selects that photo.
4. A caption of at most 80 words: UP-CLIP (Huang, Song & Jiao 2026) was
   trained on street-view photos from Wuhan to match photos with perception
   descriptions; its trained model is not published, so this is the authors'
   training script re-run on their 1,000-pair public sample; similarities
   compare descriptions within one model only; the principle descriptions are
   our adaptation, not tested by the authors; CLIP cannot point to where in
   the photo a match comes from. Add the retrieval figures from
   `scores.json` behind a "How well does the reproduction retrieve?" toggle.
5. Uploads show nothing in this section.
6. About: a paragraph "UP-CLIP" (60–100 words) and credits: the paper (CC BY
   4.0), the repository (licence not stated), CLIP ViT-L/14 (code MIT; the
   model card's out-of-scope note).
7. Specification (bump the version, with a line in *Changes*): the section,
   its labels and caption. Update `docs-dev/planning/current_state.md`, the
   README and the plan.
8. Deploy with `npm run deploy` and check the live page.

## Do not implement

Do not implement:
- free-text descriptions or a text encoder on the page;
- UP-CLIP for uploads;
- changes to `scores.json`.

## Acceptance criteria

The task is complete when:
- on every example photo the five best descriptions match `scores.json`
  for the chosen model;
- choosing a description shows eight photos in the order of `scores.json`,
  and choosing one selects it;
- every score shows whether its use is supported or an adaptation, and the
  caption says that the published model is not available;
- keyboard use works with no console errors;
- `npm run check` passes and the live page shows the section after deploy.

## Checks

`npm run check`; `npm run preview` and check three photos and two
descriptions against `scores.json`; `npm run deploy` and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
