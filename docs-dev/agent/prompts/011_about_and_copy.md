# Task: About section, honesty text and v1 finish

## Goal

Write the About section (models, quality, limitations, privacy, credits), bring
the README and docs up to date, and confirm v1 on the live site.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

`specification.md`: *Domain rules* (honesty, privacy; the MIT300 figures) and
*Naming and voice*. Readers are the general public: plain words, short
paragraphs.

## Required changes

1. Check the MIT300 figures in the spec against
   <https://saliency.tuebingen.ai/results.html>. If any figure differs,
   **stop** and report it. The spec is canon and needs the owner's update
   first.
2. About section, below the views, at most about 400 words, covering:
   - what the maps show and do not show;
   - the three models: `oneLine`, citation, licence;
   - a small quality table: MIT300 CC and AUC-Judd for centre bias and UNISAL,
     and for DeepGaze IIE and MSDB marked "larger models, not on this page";
     the source and the retrieval date; the sentence "None of these models were
     tested on Dutch street photos.";
   - limitations: lab data, photos viewed on screens for a few seconds, not
     walking a real street, not individual people, and the task changes where
     people look;
   - privacy, matching the footer;
   - credits: the photos (from the manifest), UNISAL (Apache-2.0, with the
     NOTICE), the fonts (SIL OFL), onnxruntime-web (MIT).
3. Check that every heatmap carries "Predicted" and that the top notice is
   present.
4. Update `README.md`: set the status to Live with the link, and keep it
   concise. Update `docs/usage.md`, and `docs/troubleshooting.md` (no WebGPU
   means slower CPU mode; very old browsers).
5. Update `docs-dev/planning/current_state.md`: systems, key decisions and the
   prompts run.
6. On the live site:
   - run Lighthouse (mobile) and report the Performance and Accessibility
     scores;
   - confirm there are no console errors;
   - confirm the network panel shows no third-party requests.

## Do not implement

Do not implement:
- new features or views;
- a Projects page card or a blog post;
- percentages of a human ceiling, or any claim of validity for Dutch streets.

## Acceptance criteria

The task is complete when:
- the live page shows the About section with figures matching the spec;
- every claim on the page is covered by the spec's honesty rules;
- the report lists the Lighthouse scores and confirms no third-party requests;
- `npm run check` passes.

## Checks

`npm run check`; Lighthouse on `https://eelkedevries.com/eek-a-look/`;
re-read the visitor-facing text against the spec's honesty rules.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
