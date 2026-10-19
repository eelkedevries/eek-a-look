# Task: Image measures for the study photos

## Goal

Compute the three image measures for the 25 "Published studies" photos and
show them in the Qualities view, marked as renderings or panoramas, without
changing the results for the 24 photos measured so far.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Area files for the study photos exist after prompt 051, with
  `imageKind` in the manifest (`render` for the 10 Qinyang images,
  `panorama` for the 15 Guangzhou images).
- `tools/qualities/build.py` (040–042) writes the quality files and rewrites
  every photo; `checks.py` (043) writes `checks.json`, whose per-photo table
  feeds the page's "All example photos" table.
- The Qualities view (047) says "Qualities are computed in advance for the 24
  Dutch and Zürich example photos only." for photos without a quality file.
- The rules were fixed before they first ran and are not changed here.

## Required changes

1. `build.py --only-missing`: compute the measures only for photos without a
   quality file, so the 24 existing files stay byte-identical. SAM 3 instances
   for the new photos are cached as before.
2. Notes in `reasons` (not new rules): "A design rendering, not a
   photograph." for renders; for panoramas, "A 360° panorama: straight lines
   curve and distant surfaces are small, so repetition and texture are
   harder to see." Report the resolution of each image, since the renders are
   smaller than the 640 px mask grid.
3. Re-run `checks.py`. Its per-photo table covers all measured photos; report
   the outcome counts separately for the 24 earlier photos (unchanged) and the
   25 study photos, and whether any measure gives the same outcome on all
   study photos.
4. The Qualities view: the study photos show their measures like the others,
   with a short tag "Design rendering" or "360° panorama" above the outcome;
   the "All example photos" table lists them in their own group; the
   message for photos without a quality file no longer names the 24 photos.
5. Specification (bump the version, with a line in *Changes*), README and
   `docs-dev/planning/current_state.md`.
6. Deploy with `npm run deploy` and check the live page.

## Do not implement

Do not implement:
- the simulated panel or UP-CLIP changes for these photos (their panel
  verdicts stay absent, shown as "–");
- new rules, or different thresholds for renders or panoramas;
- any change to the 24 existing quality files.

## Acceptance criteria

The task is complete when:
- all 49 example photos have a quality file, and `git diff` shows no change
  to the 24 earlier ones;
- the final report gives the outcome counts for the study photos, and checks
  by eye the evidence of two renders and two panoramas, listing clear errors;
- the page shows a render and a panorama with their tags, and keyboard use
  and phone width still work;
- `npm run check` passes and the live page shows the study photos' measures.

## Checks

`cd tools/qualities && uv run build.py --only-missing && uv run checks.py`;
`npm run check`; `npm run preview` on a render, a panorama and a Dutch
photo; `npm run deploy` and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
