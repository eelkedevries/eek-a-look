# Task: Example street photos with credits

## Goal

Add twelve openly licensed, eye-level photos of Dutch high-rise streets, with a
credits manifest and a picker.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

`specification.md`: *Data schemas* (`ExamplePhoto`) and *Domain rules*
(Images). The owner will replace these photos with their own later, so the
preparation step must be reusable.

## Required changes

1. Find three photos for each of these four areas on Wikimedia Commons (use the
   API), so twelve in total:
   - Zuidas (Amsterdam);
   - Weena (Rotterdam);
   - Wilhelminapier (Rotterdam);
   - Beatrixkwartier (The Hague).

   Criteria:
   - taken from pedestrian eye level, looking along or across the street, with
     high-rise visible;
   - landscape, at least 1600 px wide, in daylight;
   - licence CC0, public domain, CC BY or CC BY-SA (no NC or ND);
   - no close-up, identifiable faces.
2. Add `scripts/prepare-photos.mjs`, using `sharp` as a devDependency. It
   resizes to at most 1600 px on the long side, saves JPEG at quality 82,
   strips all metadata, and writes a 320 px thumbnail next to each photo.
   Process the downloads with it. Keep the originals outside the repository.
3. Write `public/examples/examples.json` following the schema exactly.
4. Add `scripts/validate-examples.mjs`. It checks that every manifest field is
   present, every file and thumbnail exists, ids are unique, and licences are
   in the allowed set. Append it to the `check` script.
5. Picker UI:
   - thumbnails grouped by area under area headings;
   - buttons with alt text, usable by keyboard;
   - selecting a photo loads it onto the stage;
   - the first photo loads by default.
6. Credit line under the stage:
   - for an example: "Photo: {author}, {licence} (linked), via Wikimedia
     Commons. {changes}.";
   - for an upload: "Your photo (stays on this device)".

## Do not implement

Do not implement:
- hotlinking to Commons (all files are self-hosted);
- models or heatmaps;
- the owner's own photos.

## Acceptance criteria

The task is complete when:
- twelve photos are self-hosted, or fewer with the shortfall explained in the
  report;
- photos and thumbnails together are at most 6 MB;
- `npm run check` (including the manifest validation) passes;
- the report has a table of photo id, area, author, licence and source URL.

## Checks

`npm run check`; spot-check three credit links in the browser.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
