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

## Horizontal–vertical rhythm and variety (prompt 041)

**Definition (this project's):** façades articulated by horizontal layers
(floor lines, bands, cornices, rows of windows or balconies) and vertical
units (bays, columns of windows, pilasters) that repeat, with visible
variation between façade zones, rather than a uniform or unarticulated
surface. Rhythm is a relation between elements, so the measure looks at their
spacing; one window says nothing about rhythm.

**Items:** SAM 3 instances for "window" and "balcony" inside the façade,
scoring at least *s*, where *s* is calibrated with τ (prompt 041b). LSD line segments on the façade are drawn as
evidence ("Floor lines and bands", "Vertical divisions") but are not counted.

**Cells and periodicity.** The façade is cut into 32 × 32 px cells (on the
640 px mask grid). Each cell with at least 60% façade is judged from the
160 × 160 px window around it: the instance centres are projected on the
x-axis (bays) and the y-axis (floors), smoothed (σ = 1.5 px), and the highest
local peak of the autocorrelation at lags of 5–100 px is the periodicity *p*
(0 with fewer than 3 instances). A family repeats when *p* ≥ τ.

**Calibration** (`rhythm_calibration.json`): τ per family on the CMP Facade
images with even numbers, for the best balanced accuracy against the human
labels (a family repeats if any one labelled class — window, door, balcony,
pillar or shop across; window, balcony, sill, cornice or moulding up — has at
least 3 regularly spaced centres in the window). *s* is chosen from
0.20, 0.30, 0.40, 0.50 and 0.65 jointly with τ, for the best mean balanced
accuracy (prompt 041b, after weena-millenniumtoren's banded offices came out
plain: SAM 3 finds 0 windows there at 0.65 but 53 at 0.30). The calibration
kept 0.65 (mean balanced accuracy 0.792, against 0.744 at 0.20), so the
limitation stays. τ = 0.20 for bays (balanced accuracy 0.78) and 0.10 for
floors (0.80), at the low end of the grid, so having three or more regularly
placed elements carries most of the signal. The odd CMP images are kept for
prompt 043.

The prompt's first design did not work on the calibration images and was
changed there, before the measure ran on the example photos:
- 64 px windows with lags up to 40 px could not hold three windows of CMP
  Facade (median gaps 54 px across, 80 px up): the reference fired on 2–3% of
  windows and τ fell to the edge of its grid;
- with 160 px windows, line segments and instances together scored a balanced
  accuracy of 0.59 (bays) and 0.52 (floors); instances alone 0.78 and 0.80.

**Cell classes:** rhythmic (both families repeat), layers only, bays only,
plain (fewer than 3 instances), irregular.

**Variety:** façade cells clustered by mean colour (CIELAB, distances on
(L/2, a, b), average linkage, cut at 12); a zone is a cluster with at least
10% of the façade cells.

**Rule:**
- `facadeCells` < 8 → Unclear ("Too little façade is visible");
- `rhythmicShare` ≥ 0.25 and `distinctZones` ≥ 2 → Likely present;
- `rhythmicShare` ≥ 0.25 and one zone → Unclear ("Repetition without visible
  variety");
- `rhythmicShare` < 0.10 → Likely absent ("Few repeating layers or bays");
- otherwise Unclear ("Some repetition").

**Limits:**
- Glass curtain walls and ribbon windows, where SAM 3 finds no windows at the
  0.65 threshold, read as plain even when floor bands are plain to see (for
  example weena-millenniumtoren). Prompt 053 tested three fixes against held-out
  labels (below); none did better, so the measure is unchanged.
- Arches, columns and pilasters are not counted (zurich-30, the station
  façade, reads as plain).
- Sun and shade can split one façade into two colour zones, which counts as
  variety.
- "Irregular" hardly occurs: with τ this low, three instances almost always
  count as repeating.

## Tactile materials (prompt 042)

**Definition (this project's):** surfaces near eye level, on the street façade
and in the street space, whose material shows visible texture or detail
(brickwork, natural stone, wood, tiles and setts, wicker, planting), as
opposed to smooth, uniform surfaces. This is **visible texture in a photo,
not touch**.

**Model:** DMS46 (Upchurch & Niu, ECCV 2022), the pre-trained model of
<https://github.com/apple/ml-dms-dataset> (Apple sample-code licence; trained
on labels under CC BY-NC 4.0). `fetch_dms.py` downloads it into `.cache/dms/`
and checks its SHA-256; it is never committed. It runs as the repository's
`inference.py` does (long side 512, ImageNet normalisation); the labels are
resized to the mask grid. About 0.07 s per photo, 0.45 GB on the RTX 4070.

**Groups:** textured = Brickwork, Stone (natural), Wood, Wood (tree), Tile,
Wicker, Foliage (also reported as planting); smooth = Glass, Mirror, Metal,
Stone (polished), Paint/plaster/enamel, Plastic (clear and non-clear),
Ceramic; neutral = the rest, including Concrete and Asphalt.

**Eye-level zone:** the ground floor (façade part) plus every pixel below the
horizon that is not sky, people, vehicles or ground floor (street-space part).

**Rule:**
- horizon method `assumed-level` → Unclear (as for the ground floor since
  040b; added before this measure was run);
- `zoneShare` < 0.10 → Unclear ("Too little is visible near eye level");
- `texturedShare` ≥ 0.25 → Likely present;
- `texturedShare` < 0.10 and `smoothShare` ≥ 2 × `texturedShare` → Likely
  absent;
- otherwise Unclear ("Some textured surfaces").

**Limits** (from the check overlays):
- dark brick façades can come out as Paint/plaster (zuidas-gershwinplein), so
  brick buildings may count as smooth;
- stucco and rusticated bases are Paint/plaster, which the groups call
  smooth (zurich-24);
- distance hides texture; reflections in glass show other materials;
- a grass tram track counts as planting (weena-millenniumtoren), which is
  what the model sees but not what a designer means by tactile;
- DMS46 was trained on general photos; its published per-class test accuracy
  is quoted in prompt 043's report.

## Checks (prompt 043)

`checks.py` tests what can be tested without expert labels for these photos,
and writes `public/precomputed/qualities/checks.json` and the report
`docs-dev/reference/secondary_background/qualities_validation.md`:
- **rhythm** on the CMP Facade images with odd numbers (not used for the
  calibration): the measure's "repeats" against the human-label reference;
- **frontage** on the odd CMP images that label doors or shops: `openShare`
  from the human labels against `openShare` from SAM 3, in the same band (the
  bottom quarter of the labelled façade stands in for the ground floor);
- **materials**: DMS46's published per-class results, and the
  textured / smooth / neutral grouping on outdoor DMS test images whose
  original photos are still on Flickr (labels CC BY-NC 4.0, in `.cache/`,
  never committed);
- **sensitivity**: how many of the 24 outcomes change when one rule threshold
  is halved or raised by half;
- **discrimination**: outcomes per principle, and whether any measure says
  the same on every photo;
- the image measure against the simulated panel v1, labelled as two
  automated methods.

It needs `../areas/fetch_validation.py` (CMP Facade) and, for the material
check, `dms_v1_labels.zip` unpacked in `.cache/dms-val/` (see `checks.py`).

**Expert labels.** `labels_template.csv` has one row per photo and principle.
A panel fills in `label` with `present`, `absent` or `ambiguous` (the scale of
the 2020 panel), one row per rater, and runs `uv run agreement.py --labels
FILE.csv`. The script reports, per method and principle, the percentage
agreement and Cohen's kappa with the labels (majority label per photo when
there are several raters). Its mappings for the graded panel and UP-CLIP are
written in its docstring and were fixed before any labels exist.

## Study images (prompt 052)

The 25 images "From published studies" (10 design renderings, 15 360°
panoramas; `imageKind` in the manifest, prompt 051) are measured with the same
rules: `uv run build.py --only-missing` leaves the 24 earlier quality files
untouched. Their reasons carry a note on the image kind, and the quality file
records `imageKind`. Outcomes on 2026-10-19 (likely present / unclear /
likely absent): ground floor 2 / 7 / 16, rhythm 3 / 12 / 10, materials
4 / 20 / 1.

Limits seen in the overlays: in the panoramas SAM 3 finds no façade elements
(the buildings are small and behind trees), so frontages read as closed and
rhythm as plain; DMS46 reads the stretched ground of a panorama as sand,
soil, water or plaster; the renders are smaller than the mask grid
(about 368 px wide).

**Glass and ribbon-window façades (prompt 053):** `compare_rhythm.py` compares the
measure (A) with three variants on the same cells and windows: B adds SAM 3
instances for "ribbon window" and "curtain wall panel", C adds LSD segments as
items where a window has fewer than 3 instances, D calibrates the instance
score with τ. Calibration: even CMP images plus the LabelMeFacade train split
(`fetch_labelmefacade.py`, pinned commit, SHA-256-checked, kept in `.cache/`
and never committed; non-commercial, no licence file). Tests: odd CMP, the
LabelMeFacade test split and its glazed or banded subset. Mean balanced
accuracy 0.781 / 0.797 / 0.825 for A; B 0.781 / 0.796 / 0.755; C and D end at
A's settings. The rule kept A. The glazed or banded subset has only 4 images
(587 windows), and LabelMeFacade often labels only some windows, so this does
not settle glass façades. Figures in `rhythm_calibration.json`
(`glassComparison`) and `qualities_validation.md`.

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
uv run build.py --rhythm        # rhythm and variety (calibrates on CMP Facade first if needed)
uv run build.py --calibrate     # re-run the rhythm calibration
uv run fetch_labelmefacade.py   # LabelMeFacade into .cache/, once (prompt 053)
uv run compare_rhythm.py        # glass and ribbon-window comparison (about 75 min on 8 GB)
uv run fetch_dms.py             # DMS46 model, once
uv run build.py --materials     # tactile materials
```

Check overlays go to `.cache/check/` (ignored by git).
