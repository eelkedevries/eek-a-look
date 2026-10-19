# Image measures: checks

Made by `tools/qualities/checks.py` (prompt 043) on 2026-10-19. Figures in
`public/precomputed/qualities/checks.json`.

## What was and was not checked

- **Checked:** whether each measure reads its *components* as people
  labelled them in public datasets, how much the outcomes depend on the
  rule thresholds, and whether the measures tell the 49
  example photos apart (the 24 earlier photos and the 25 study images,
  renderings and 360° panoramas, separately).
- **Not checked:** the principles themselves. No experts have judged these
  photos, so agreement with experts has not been evaluated. Agreement
  between automated methods (below) is not validity.

## Rhythm: repetition against CMP labels

189 CMP Facade images with odd numbers (48642 façade windows), not used for the
calibration of τ. Reference: at least 3 regularly spaced elements of one labelled class (spec).

| Family | τ | Balanced accuracy | Precision | Recall | Repeats (labels) | Repeats (measure) |
|---|---|---|---|---|---|---|
| vertical | 0.20 | 0.79 | 0.41 | 0.83 | 18% | 36% |
| layer | 0.10 | 0.78 | 0.19 | 0.84 | 7% | 32% |

Per image, the share of rhythmic windows from the measure against the share from the labels: Spearman ρ = 0.68, mean absolute difference 0.28.
CMP façades are rectified (no perspective) and mostly classical, so this is an easier test than the street photos.

## Frontage: openings against CMP labels

158 CMP images with odd numbers that label doors or shops. The bottom quarter of the labelled façade (CMP has no horizon) stands
in for the ground floor, the same band for both sides, so only the openings and windows differ.

- `openShare` from the human labels against `openShare` from SAM 3: Spearman ρ = 0.64,
  mean absolute difference 0.16;
- the same outcome from both: 65% of the images.

| Labels ↓ / SAM 3 → | likely present | unclear | likely absent |
|---|---|---|---|
| likely present | 58 | 13 | 13 |
| unclear | 5 | 28 | 22 |
| likely absent | 1 | 1 | 17 |

## Materials: DMS46

Per-class results of DMS46 on the DMS test set, from Upchurch & Niu (2022), Table 8. They describe the model on its own kind of photos, not on Dutch or Swiss street façades.

| Class | Group | Test accuracy | Test IoU |
|---|---|---|---|
| Brickwork | textured | 0.746 | 0.491 |
| Stone, natural | textured | 0.665 | 0.436 |
| Wood | textured | 0.797 | 0.635 |
| Wood, tree | textured | 0.428 | 0.261 |
| Tile | textured | 0.722 | 0.550 |
| Wicker | textured | 0.674 | 0.460 |
| Foliage | textured | 0.902 | 0.761 |
| Glass | smooth | 0.653 | 0.483 |
| Mirror | smooth | 0.452 | 0.278 |
| Metal | smooth | 0.575 | 0.303 |
| Stone, polished | smooth | 0.379 | 0.236 |
| Paint/plaster/enamel | smooth | 0.694 | 0.632 |
| Plastic, clear | smooth | 0.360 | 0.222 |
| Plastic, non-clear | smooth | 0.519 | 0.321 |
| Ceramic | smooth | 0.757 | 0.427 |
| Concrete | neutral | 0.603 | 0.304 |
| Asphalt | neutral | 0.628 | 0.442 |

Own check on 149 outdoor DMS test images (327 originals no longer available): the textured / smooth / neutral grouping agrees with the human labels on 80% of labelled pixels; IoU textured 0.66, smooth 0.64, neutral 0.71. These are the model's own kind of photos (in-domain), so on Dutch and Swiss streets it may do worse.

## Sensitivity of the rules

How many of the 49 outcomes change when one threshold is halved or multiplied by 1.5.

| Principle | Threshold | Value | × 0.5 | × 1.5 |
|---|---|---|---|---|
| groundFloor | frontageMin | 0.05 | 0 | 1 |
| groundFloor | openPresent | 0.3 | 3 | 0 |
| groundFloor | openAbsent | 0.1 | 3 | 2 |
| groundFloor | closedAbsent | 0.6 | 0 | 4 |
| rhythm | facadeCellsMin | 8 | 3 | 4 |
| rhythm | rhythmicPresent | 0.25 | 6 | 5 |
| rhythm | zonesPresent | 2 | 1 | 6 |
| rhythm | rhythmicAbsent | 0.1 | 1 | 3 |
| materials | zoneMin | 0.1 | 0 | 2 |
| materials | texturedPresent | 0.25 | 12 | 7 |
| materials | texturedAbsent | 0.1 | 2 | 2 |
| materials | smoothRatio | 2.0 | 3 | 1 |

## Do the measures tell the photos apart?

| Principle | Photos | Likely present | Unclear | Likely absent |
|---|---|---|---|---|
| groundFloor | 24 earlier photos | 1 | 10 | 13 |
| groundFloor | 25 study images | 2 | 7 | 16 |
| rhythm | 24 earlier photos | 11 | 7 | 6 |
| rhythm | 25 study images | 3 | 12 | 10 |
| materials | 24 earlier photos | 6 | 10 | 8 |
| materials | 25 study images | 4 | 20 | 1 |

| Principle | Main indicator | Range over all photos |
|---|---|---|
| groundFloor | `openShare` | 0.00–0.64 |
| rhythm | `rhythmicShare` | 0.00–0.90 |
| materials | `texturedShare` | 0.00–0.70 |

No measure gives the same outcome on every photo of a group.

## Image measure against the simulated panel (automated against automated)

Rows: image measure (likely present → present, unclear → ambiguous, likely absent → absent). Columns: the simulated panel's v1 consensus. Neither is an expert judgement.

**groundFloor** (same label on 38% of the 24 photos the panel judged)

| Measure ↓ / panel → | present | ambiguous | absent |
|---|---|---|---|
| present | 1 | 0 | 0 |
| ambiguous | 6 | 0 | 4 |
| absent | 5 | 0 | 8 |

**rhythm** (same label on 46% of the 24 photos the panel judged)

| Measure ↓ / panel → | present | ambiguous | absent |
|---|---|---|---|
| present | 11 | 0 | 0 |
| ambiguous | 7 | 0 | 0 |
| absent | 6 | 0 | 0 |

**materials** (same label on 25% of the 24 photos the panel judged)

| Measure ↓ / panel → | present | ambiguous | absent |
|---|---|---|---|
| present | 6 | 0 | 0 |
| ambiguous | 10 | 0 | 0 |
| absent | 8 | 0 | 0 |

## Expert labels later

`tools/qualities/labels_template.csv` has one row per photo and principle. An expert panel fills in
`present`, `absent` or `ambiguous` (the 2020 panel's scale) and runs
`uv run agreement.py --labels <file>` for each method's agreement with them.
