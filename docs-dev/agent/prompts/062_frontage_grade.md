# Task: Frontage density and an adapted frontage grade

## Goal

Owner's request of 2026-10-19, recommendation 4 of
`qualities_improvement_research.md`. The Urban Design Compendium (Table 5.3,
"Adapted from Gehl, 1994") grades frontages A–E by premises and doors and
windows per 100 m and by the share of blind or passive façade. Estimate the
countable parts from the photo and show an adapted grade beside the
ground-floor outcome.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/qualities/frontage.py` classifies ground-floor columns as open,
  transparent only or closed, and counts entrances.
- The ground floor comes from a level camera at 1.6 m and the horizon
  (`tools/areas/groundfloor.py`). In a perspective photo a façade base at
  row y_b lies at depth c·f/(y_b − y_h). A column there spans
  c/(y_b − y_h) m sideways, without the focal length f. Along a receding
  façade the depth change needs f.
- Window instances from SAM 3 are cached per photo
  (`.cache/instances-scored/`).

## Required changes

1. Frontage length per photo in metres, from the ground-floor base row and
   horizon of each frontage column:
   - perspective photos: the 3D base points
     X = (x − c_x)·c/(y_b − y_h), Z = c·f/(y_b − y_h), with f from an
     assumed horizontal field of view of 60°, and also 45° and 75°;
   - panoramas: exact, from azimuth and distance (prompt 051's geometry).

   Columns whose depth is above 60 m are left out (too far to count
   openings).
2. Counts on the ground floor:
   - entrances (as now);
   - shopfronts (components);
   - windows (SAM 3 window instances scoring ≥ 0.65 whose centre lies in the
     ground floor).

   Per 100 m of the counted frontage: `entrancesPer100m` and
   `openingsPer100m` (entrances + shopfronts + windows). Blind or passive
   share = closed + transparent-only columns.
3. Adapted grade, fixed here (per 100 m; B/P = blind or passive share):
   - A: entrances > 15, openings > 25, B/P < 10%;
   - B: entrances ≥ 10, openings > 15, B/P < 25%;
   - C: entrances ≥ 6, B/P < 50%;
   - D: entrances ≥ 3;
   - E: otherwise.

   Entrances stand in for premises (a premises has at least one). Depth and
   relief, materials and details are not measured. The grade is computed at
   45°, 60° and 75° and shown as one grade or a range ("B–C"). Under 20 m of
   counted frontage gives no grade.
4. The outcome rule is unchanged; the grade and counts are indicators. The
   ground-floor card shows "Frontage grade (adapted from the Urban Design
   Compendium, Table 5.3): C", and the numbers show the counts per 100 m and
   the counted length.
5. Check by hand on three photos: count entrances, shopfronts and
   ground-floor windows by eye, compare with the automatic counts, and record
   the comparison in `qualities_validation.md`.
6. Re-run the ground-floor measure on the 49 photos. Specification (bump,
   *Changes*), `docs/usage.md`, `tools/qualities/README.md`,
   `current_state.md`.
7. Deploy and check the live page.

## Do not implement

Do not implement:
- changes to the outcome thresholds;
- counting premises or judging use;
- tuning the grade thresholds on the example photos.

## Acceptance criteria

The task is complete when:
- every quality file with a found horizon has the counts, the counted length
  and the grade (or a range, or none under 20 m);
- outcomes are unchanged;
- the hand check is recorded;
- the card shows the grade;
- `npm run check` passes and the live page shows it.

## Checks

`cd tools/qualities && uv run build.py --ground-floor`; `npm run check`;
`npm run preview`; deploy and check the live page.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
