# Task: Image measure for the active ground floor

## Goal

Create `tools/qualities/` and compute, for each example photo, where the ground
floor is open, transparent only or closed, with a fixed rule that turns the
measures into "Likely present", "Likely absent" or "Unclear".

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Area files (`public/precomputed/areas/<photo-id>.json`, prompts 021–023)
  hold the street categories, the ground floor (4 m rule) and the SAM 3 masks
  for windows, entrances and shopfronts. Helpers for run lengths and paths are
  in `tools/areas/common.py`.
- Spanjar & Suurenbroek (2020) named the principle but did not define it; see
  `docs-dev/reference/secondary_background/qualities_sources.md`. The
  definition below is this project's operational definition.
- A window alone does not establish an active frontage. Transparency is
  shown, but on its own it gives "Unclear", not "Likely present".

## Required changes

1. Create `tools/qualities/` as a `uv` project (Python 3.12, `numpy`, `scipy`,
   `pillow`; the GPU packages come in 041 and 042) with `common.py` (paths,
   run-length helpers reused from `tools/areas/common.py` by import, not a
   copy) and `build.py`. `.cache/` and `.venv/` are ignored by git.
2. **Quality file** `public/precomputed/qualities/<photo-id>.json`, on the
   same mask grid as the area file:

   ```ts
   interface QualityFile {
     photo: string;
     width: number; height: number;          // as the area file
     models: Record<string, string>;         // step → repository@revision or rule
     principles: Partial<Record<'groundFloor' | 'rhythm' | 'materials', PrincipleResult>>;
   }
   interface PrincipleResult {
     outcome: 'likely-present' | 'likely-absent' | 'unclear';
     reasons: string[];                      // plain-language, from the rule
     indicators: Record<string, number | null>;
     evidence: Array<{
       id: string; label: string;
       role: 'supports' | 'against' | 'context';
       share: number;                        // fraction of all mask pixels
       rle: number[];                        // as in the area file
     }>;
   }
   ```

   Each prompt writes only its own principle and keeps the others.
3. **Frontage columns.** A column belongs to the visible frontage if it has
   at least 3 ground-floor pixels. In each such column:
   - **open** if entrances ∪ shopfronts cover at least 30% of that column's
     ground-floor pixels;
   - otherwise **transparent only** if windows cover at least 30%;
   - otherwise **closed**.
4. **Indicators:** `frontageShare` (frontage columns ÷ image width),
   `openShare`, `transparentShare`, `closedShare` (each ÷ frontage columns),
   `entrances` (connected entrance components of at least 20 pixels that
   overlap the ground floor), `longestClosedRun` (longest run of adjacent
   closed columns ÷ frontage columns) and `useCues` (share of a band below the
   ground floor, half the local ground-floor height deep, covered by people,
   signage or street furniture; context only, since people come and go).
5. **Rule** (written into the specification before running on the photos):
   - `frontageShare` < 0.05 → Unclear ("Too little ground floor is visible");
   - `openShare` ≥ 0.30 → Likely present;
   - `openShare` < 0.10 and `closedShare` ≥ 0.60 → Likely absent;
   - otherwise Unclear, with the reason "Mostly windows: transparency alone
     does not show an active frontage" when `transparentShare` ≥ 0.30, or
     "Open and closed stretches are mixed" otherwise.
   Add a note to `reasons` when the horizon method is `assumed-level` or when
   shopfronts cover a whole station hall or shelter (the SAM 3 limitation
   recorded in prompt 023); the latter is checked by eye on the overlays and
   listed per photo in the final report.
6. **Evidence:** "Open frontage" (supports), "Transparent only" (context),
   "Closed frontage" (against): the ground-floor pixels of those columns;
   plus "Entrances" and "Shopfronts" clipped to the ground floor (supports).
7. Write a check overlay per photo to `tools/qualities/.cache/check/`
   (greyed photo, the three frontage layers, a strip under the photo with the
   column classes) and print a table: photo, outcome, the indicators.
8. `tools/qualities/README.md`: the definition, the rule, the limits
   (image columns, not metres; perspective; transient people) and the command.
9. Specification (bump the version, with a line in *Changes*):
   - the `QualityFile` schema under *Data schemas*;
   - under *Domain rules*, a new section **Architectural qualities** with the
     operational definition of the active ground floor, labelled as this
     project's, the frontage columns, the indicators and the rule;
   - under *Naming and voice*: the rule's outcome is called an **"image
     measure"** with the outcomes "Likely present", "Likely absent" and
     "Unclear"; never an assessment or an expert judgement.

## Do not implement

Do not implement:
- rhythm or materials (041, 042);
- validation against human labels (043);
- page changes (047);
- changing the rule's thresholds after seeing the outcomes on the photos.

## Acceptance criteria

The task is complete when:
- `uv run build.py` writes a quality file for all 24 example photos, each with
  a `groundFloor` result whose evidence run lengths add up to the mask size;
- the printed table shows the outcome and indicators for every photo, and
  the final report lists how many photos fall in each outcome;
- the final report checks the overlays of four photos by eye and names any
  column class that is clearly wrong;
- `npm run check` passes.

## Checks

`cd tools/qualities && uv run build.py`; view four overlays; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
