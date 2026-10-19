# Task: Image measure for tactile materials

## Goal

Find, for each example photo, which materials are visible near eye level on
the street façade and in the street space, and turn the share of visibly
textured materials into an image measure with a fixed rule.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/qualities/` and the `QualityFile` schema exist (040, 041).
- The 2020 paper places tactile materials "in the street-façade and
  street-space" and mentions benches, plants, cobblestones and raised stone
  flowerbeds (`docs-dev/reference/secondary_background/qualities_sources.md`).
- **DMS46** (Upchurch & Niu, ECCV 2022): a TorchScript model for 46 materials
  from <https://github.com/apple/ml-dms-dataset> (`dms46_v1.zip`, 170 MB;
  Apple sample-code licence; trained on labels under CC BY-NC 4.0).
- A photo shows visible texture, not touch. The measure is about what can be
  seen, and the page must say so.

## Required changes

1. `tools/qualities/fetch_dms.py`: download `dms46_v1.zip` and the pinned
   `taxonomy.json` into `.cache/dms/`, check their SHA-256 (recorded in the
   script on first download), and never commit them. Copy the input
   normalisation and the 46-class index list from the repository's
   `inference.py` at a pinned commit, with the source in a comment.
2. **Materials** per photo: run DMS46 at the size its `inference.py` uses,
   then resize the labels to the mask grid (nearest). Record the peak GPU
   memory and the time per photo.
3. **Material groups** (fixed in the specification):
   - *textured*: Brickwork, Stone (natural), Wood, Wood (tree), Tile, Wicker,
     Foliage (reported separately as "planting");
   - *smooth*: Glass, Mirror, Metal, Stone (polished), Paint/plaster/enamel,
     Plastic (clear), Plastic (non-clear), Ceramic;
   - *neutral*: everything else, including Concrete and Asphalt, whose
     texture a photo cannot decide.
4. **Eye-level zone** (geometry from the area file): the ground floor, plus
   every pixel below the horizon that is not sky, people or vehicles. Split
   it into *façade* (ground floor) and *street space* (the rest).
5. **Indicators:** `zoneShare` (eye-level zone ÷ photo); `texturedShare`,
   `smoothShare`, `neutralShare`, `plantingShare` (each ÷ eye-level zone);
   the same three shares for the façade part and the street-space part; the
   three most common materials in the zone with their shares; and
   `texturedFurniture` (share of street-furniture pixels that are textured).
6. **Rule** (in the specification before running on the photos):
   - `zoneShare` < 0.10 → Unclear ("Too little is visible near eye level");
   - `texturedShare` ≥ 0.25 → Likely present;
   - `texturedShare` < 0.10 and `smoothShare` ≥ 2 × `texturedShare` → Likely
     absent;
   - otherwise Unclear ("Some textured surfaces").
   The reasons name the façade or the street space when one of them alone
   reaches 0.25 textured.
7. **Evidence:** "Textured surfaces" (supports), "Planting" (supports),
   "Smooth surfaces" (against) and "Eye-level zone" (context).
8. Overlays in `.cache/check/` with a material legend, a printed table per
   photo, and the README section: definition, groups, rule, licence, and the
   limits (distance hides texture; reflections; wet or dark surfaces).
9. Specification (bump the version, with a line in *Changes*): the
   operational definition of tactile materials, labelled as this project's
   and as *visible texture, not touch*, the model, the groups, the eye-level
   zone and the rule.

## Do not implement

Do not implement:
- a texture statistic of our own, or a second material model;
- the material check against human labels (043);
- page changes (047);
- changing the groups or the rule after seeing the outcomes on the photos.

## Acceptance criteria

The task is complete when:
- `uv run build.py --materials` adds a `materials` result to all 24 quality
  files and keeps the other principles unchanged;
- the model's revision and SHA-256 are recorded in each file's `models`;
- the final report gives the number of photos per outcome, the peak GPU
  memory, and an eye check of four overlays listing clearly wrong materials;
- no DMS files are in git, and `npm run check` passes.

## Checks

`cd tools/qualities && uv run fetch_dms.py && uv run build.py --materials`;
view four overlays; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
