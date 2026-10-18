# Task: Street categories and ground floor for the example photos

## Goal

For each of the 24 example photos, compute the automatic street categories
and the ground floor on the laptop GPU and publish them as masks; façade
elements follow in 023.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Decisions: `docs-dev/plan.md`, *Fifth round*. Sources, licences and the
  pilot: `docs-dev/reference/secondary_background/areas_sources.md`.
- Runs on the RTX 4070 (8 GB), like `tools/deepgaze-local/`. Nothing runs on
  the site, and no weights are published.
- **Street categories:** OneFormer ADE20K Swin-L,
  `shi-labs/oneformer_ade20k_swin_large` (MIT). Pilot: 0.24–0.52 s per photo,
  2.65 GB peak. It finds sky, building, pavement, people, posters and signs,
  but no windows or doors at street distance, which is why the elements get
  their own prompt (023).
- The ground-floor rule follows the horizon relation in Hoiem, Efros & Hebert
  (2008); see the sources file.

## Required changes

1. Create `tools/areas/` as a `uv` project with a pinned Python (3.12),
   `torch`, `transformers` (≥ 5.20, locked), `pillow`, `numpy`, `scipy` and
   `opencv-python-headless`. Pin the model revision (commit hash) in code.
2. `build.py` processes every photo in `public/examples/examples.json`:
   1. **Street categories.** Run OneFormer (task "semantic") on the photo and
      map the 150 ADE20K class indices to nine categories, so that every pixel
      belongs to exactly one:
      - `facade`: 0 wall, 1 building, 25 house, 48 skyscraper, 84 tower,
        8 windowpane, 14 door, 58 screen door, 42 column, 86 awning, 79 hovel;
      - `sky`: 2 sky;
      - `greenery`: 4 tree, 9 grass, 17 plant, 72 palm, 66 flower, 29 field;
      - `street-surface`: 3 floor, 6 road, 11 sidewalk, 52 path, 13 earth,
        94 land, 91 dirt track, 46 sand, 53 stairs, 59 stairway, 121 step;
      - `people`: 12 person;
      - `vehicles`: 20 car, 80 bus, 83 truck, 102 van, 116 minibike,
        127 bicycle, 76 boat, 103 ship, 90 airplane;
      - `signage`: 43 signboard, 100 poster, 123 trade name,
        144 bulletin board, 149 flag;
      - `street-furniture`: 93 pole, 87 streetlight, 136 traffic light,
        69 bench, 138 ashcan, 32 fence, 38 railing, 95 bannister, 88 booth,
        106 canopy, 104 fountain, 132 sculpture, 19 chair, 15 table, 114 tent;
      - `other`: every remaining index.
   2. **Ground floor.** With camera height *c* = 1.6 m and storey height
      *H* = 4.0 m:
      - estimate the horizon row *y<sub>h</sub>* from vanishing points of
        receding horizontal façade edges (line segments on façade pixels,
        RANSAC, zero roll assumed). If fewer than 15 segments support it, or
        it falls outside the middle 80% of the image, use the middle row and
        set the method to `assumed-level`;
      - per image column, take *y<sub>0</sub>* as the bottom of the lowest
        façade run when it meets street surface. Where it is hidden by people,
        vehicles, furniture, signage or greenery, or by the image edge,
        interpolate linearly from the nearest visible base in the same façade
        run. Skip columns with no façade, or with *y<sub>0</sub>* ≤
        *y<sub>h</sub>*;
      - the ground floor is the façade pixels between *y<sub>0</sub>* and
        *y<sub>h</sub> − (H − c)/c · (y<sub>0</sub> − y<sub>h</sub>)*;
      - put the ground-floor code in a module that 022 and 023 can import,
        and document the details and edge cases in the README.
   3. **Write** `public/precomputed/areas/<photo-id>.json` in the format of
      step 3, with masks at the photo's size scaled to 640 px on the long
      side. The ground floor is an `element`; 023 adds the other elements to
      the same files without changing the categories.
   4. **Check images.** Write an overlay per photo to `.cache/check/`
      (categories, the ground-floor band and the horizon line). Print a table:
      id, horizon method, head offset (median top row of standing people
      minus the horizon row, in % of the height; "–" without people), % per
      category, % ground floor, seconds per photo, and the peak GPU memory.
3. Add to `specification.md` (bump to 0.10, with a line in *Changes*):
   - *Data schemas*: `AreaFile`:
     `{ photo; width; height; horizon: { row, method: 'vanishing-lines' | 'assumed-level' }; params: { cameraHeightM, storeyHeightM }; models: Record<string, string>; areas: Array<{ id, label, group: 'category' | 'element', share, rle: number[], model?, instances?, meanScore? }> }`.
     `rle` holds row-major run lengths that start outside the area.
     `share` is the area's fraction of all pixels. `models` maps a step to
     its repository and revision.
   - *Domain rules*: an "Automatic areas" block with the category table and
     the ground-floor rule. Façade elements are named in 023.
   - *Architecture*: area masks are pre-computed for the example photos only.
4. Write `tools/areas/README.md`: purpose, the recipe, the licence (OneFormer
   MIT, weights never published), the commands, and what the areas are not
   (an expert judgement, a measured share of perception).
5. Add `tools/areas/.cache/` and `tools/areas/.venv/` to `.gitignore`.

## Do not implement

Do not implement:
- façade elements other than the ground floor (023);
- any page change (025) or an `npm run local` route;
- scoring against datasets (022);
- the simulated panel (024).

## Acceptance criteria

The task is complete when:
- `uv run build.py` in `tools/areas/` writes 24 area files and the table;
- in every file:
  - each mask's run lengths sum to width × height;
  - the nine categories cover every pixel exactly once, and their shares sum
    to 1 (within 1e-9);
  - the ground floor lies inside `facade`;
  - the file is at most 150 kB;
- the peak GPU memory is printed and quoted in the final report;
- for zuidas-gershwinplein, weena-stationsplein, zurich-18 and zurich-23, the
  final report states for each photo, after viewing the overlays:
  - whether the categories look right, and what is mislabelled;
  - whether the ground-floor top lies near the first-floor line;
  - where the horizon lies relative to the heads of standing people;
- no model weights or files over 50 MB are in git, and `npm run check` passes.

## Checks

`cd tools/areas && uv run build.py`; view the overlays of the four photos
above; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
