# Task: Explain each method at the bottom of the page

## Goal

Add a final section with one card per method: that method's heatmap for the
current photo, with a plain-language paragraph of about 100 words underneath.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

The owner's request of 2026-10-18: "write 1 short paragraph (100 words) to
explain each of the methods as under the images (at bottom of page)". Facts
come from the papers' abstracts and the code (see the model sources in
`src/models/` and `docs-dev/reference/secondary_background/overview.md`).

## Required changes

1. Add `src/content/methods.ts`: one paragraph of about 100 words (90–115)
   per model id, written for the general public in British English. Each
   paragraph covers:
   - how the method works;
   - what it knows and does not know;
   - its MIT300 correlation where it has one;
   - where it runs (browser or computed in advance).
2. Add `src/views/methods.ts` and a `#methods` section as the last section
   before the footer, headed "How each method works". Each card shows:
   - the method's heatmap for the current photo, drawn like the side-by-side
     view;
   - the model name;
   - the paragraph.

   Use one column on mobile, two from 720 px and three from 1080 px. Models
   that do not cover the photo show their note instead of a heatmap.
3. Remove the short model list from the About section, which these cards
   replace, and point to the new section from the About introduction.
4. Add a check script (`scripts/check-method-texts.mjs`, part of
   `npm run check`) that every model in the registry has a paragraph of
   90–115 words.

## Do not implement

Do not implement:
- new models or changes to the other views;
- colour-map changes.

## Acceptance criteria

The task is complete when:
- the bottom of the page shows five cards, each with an image and a paragraph,
  updating when the photo changes;
- every factual claim matches the spec, the papers' abstracts or the code;
- `npm run check` passes and the change is live.

## Checks

`npm run check`; screenshots at desktop and 360 px; `npm run deploy`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
