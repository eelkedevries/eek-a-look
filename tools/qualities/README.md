# qualities

**Image measures** for the three design principles that an HvA expert panel
used to classify streetscape photos (Spanjar & Suurenbroek 2020):
horizontal–vertical rhythm and variety, active ground floor, and tactile
materials. For each example photo, each measure gives an outcome ("Likely
present", "Likely absent" or "Unclear"), its reasons, the numbers behind it,
and the evidence on the photo as masks.

These are not expert judgements. The 2020 paper names the principles but does
not define them; the definitions here are this project's operational
definitions, written into the specification (*Architectural qualities*)
before each rule was run on the photos. No experts have judged these photos,
so agreement with experts has not been evaluated.

Sources: `docs-dev/reference/secondary_background/qualities_sources.md`.

## Active ground floor (prompt 040)

**Definition (this project's):** visible street-level frontage that offers
openings to the street, namely entrances and shopfronts. Windows are shown,
but transparency alone does not make a frontage active; blank, closed
stretches count against it.

**Inputs:** the area file of the photo (`tools/areas/`): the ground floor
(4 m rule), and the SAM 3 masks for entrances ("door"), shopfronts
("storefront") and windows ("window").

**Frontage columns.** Every image column with at least 3 ground-floor pixels
is part of the visible frontage. A column is:
- **open** if entrances or shopfronts cover at least 30% of its ground floor;
- otherwise **transparent only** if windows cover at least 30%;
- otherwise **closed**.

**Indicators:** `frontageShare` (frontage columns ÷ image width);
`openShare`, `transparentShare`, `closedShare` (÷ frontage columns);
`entrances` (entrance components of at least 20 pixels on the ground floor);
`longestClosedRun` (longest run of adjacent closed columns ÷ frontage
columns); `useCues` (people, signage and street furniture in a band below the
ground floor, half its local height deep; context only).

**Rule:**
- horizon method `assumed-level` → Unclear ("The horizon could not be
  found, so the ground floor may be far too tall or missing"; prompt 040b);
- `frontageShare` < 0.05 → Unclear ("Too little ground floor is visible");
- `openShare` ≥ 0.30 → Likely present;
- `openShare` < 0.10 and `closedShare` ≥ 0.60 → Likely absent;
- otherwise Unclear ("Mostly windows: transparency alone does not show an
  active frontage" when `transparentShare` ≥ 0.30, else "Open and closed
  stretches are mixed").

**Evidence layers:** open frontage (supports), transparent only (context),
closed frontage (against), entrances and shopfronts on the ground floor
(supports).

**Limits:**
- Shares are of image columns, not metres; perspective compresses distant
  frontage.
- Glazing that SAM 3 does not call a window (glass curtain walls, recessed
  glass ground floors) counts as closed, so `closedShare` can be too high on
  modern glass bases.
- "Storefront" can cover a whole station hall or shelter (prompt 023).
- Where the horizon is assumed (`assumed-level`), the ground floor can cover
  almost the whole façade, so the outcome is always Unclear (040b).
- People in front of the ground floor come and go, so `useCues` is context,
  not evidence.

## Output

`public/precomputed/qualities/<photo-id>.json`, the `QualityFile` of the
specification, on the mask grid of the area file. Each run keeps the
principles it does not re-run. `build.py` checks that every evidence mask's
run lengths add up and match its share.

## Commands

```sh
cd tools/qualities
uv run build.py                 # every measure implemented so far
uv run build.py --ground-floor  # the active ground floor only
```

Check overlays go to `.cache/check/` (ignored by git).
