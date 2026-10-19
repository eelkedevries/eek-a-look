# Task: Lay the page out as a workspace

## Goal

Implement the owner-approved mock-up of 2026-10-19 ("eek-a-look Pro
Mock-up"): a professional workspace with a photo library, the views and an
inspector, so the maps are quicker to choose, read and compare.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Views after prompt 027: overlay (own model buttons and slider), side by
  side, Contrast (own selectors), Areas; agreement matrix with a "Match with
  measured gaze" list; picker above the stage.
- The picker is pre-rendered by `vite.config.ts`.

## Required changes

1. Top bar: name and tagline, links to Workspace, Agreement, Methods and
   About, "Runs on this device", and "Use your own photo" as the primary
   button. The honesty notice stays directly under it.
2. Library (left): search, the filters "All", "Measured gaze" and "Dutch
   high-rise", thumbnails grouped by area, a blue dot on photos with measured
   gaze, a count. On a phone it is one row that scrolls sideways.
3. Workspace (middle): the photo's place and title, and the views "Single
   map", "Side by side", "Contrast" and "Areas" as a segmented control.
4. Inspector (right), in `src/views/inspector.ts`:
   - layers with their r against the reference; choosing one opens it in
     "Single map";
   - the Contrast selectors, the swap button and "Reset to the best model";
   - heatmap strength (also applied in "Side by side") and the legend;
   - the match with the reference (measured gaze, otherwise the best model),
     replacing the "Match with measured gaze" list;
   - a short note on the open view.
5. Shared choices in `src/view-state.ts`; `referenceModel()` in
   `src/results.ts`.
6. A status bar with the number of ready layers and the photo size.
7. Update the specification (bump the version), `docs/usage.md`,
   `README.md` and `current_state.md`.

## Do not implement

- keyboard shortcuts;
- saving, sharing or exporting results;
- changes to the maps, models or statistics.

## Acceptance criteria

- the three panes work at desktop width and stack at phone width without
  horizontal scrolling of the page;
- search and filters narrow the library; choosing a layer opens it; the
  strength slider changes the single map and side by side;
- Contrast defaults are unchanged from prompt 027; uploads still work;
- `npm run check` passes, the change is deployed and checked live.

## Checks

`npm run check`; local preview at 1440 and 390 px on a Dutch photo, a
Zürich photo and an upload; `npm run deploy`; live check.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

## Final report

End with the required final report specified in `AGENTS.md`.
