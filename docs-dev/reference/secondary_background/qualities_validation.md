# Image measures: checks

Made by `tools/qualities/checks.py` (prompt 043) on 2026-10-19. Figures in
`public/precomputed/qualities/checks.json`.

## What was and was not checked

- **Checked:** whether each measure reads its *components* as people
  labelled them in public datasets, how much the outcomes depend on the
  rule thresholds, and whether the measures tell the 34
  example photos apart (the photos and the study images, design
  renderings, separately; the four Andersson photos have the
  materials measure only).
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

### Glass and ribbon-window façades (prompt 053)

Four ways of finding repeating elements, calibrated on the even CMP images and the LabelMeFacade train split, tested on held-out labels (mean balanced accuracy over bays and floors).

| Candidate | CMP odd | LabelMeFacade test | LabelMeFacade glazed or banded | Mean of the two test sets |
|---|---|---|---|---|
| A: current: SAM 3 window and balcony, score >= s, current tau | 0.781 | 0.797 | 0.825 | 0.789 |
| B: A plus SAM 3 'ribbon window' and 'curtain wall panel' at score >= sB, tau recalibrated | 0.781 | 0.796 | 0.755 | 0.789 |
| C: A plus LSD segments as items where a window has fewer than 3 instances, own threshold tauLine | 0.781 | 0.797 | 0.825 | 0.789 |
| D: A with s and tau calibrated jointly | 0.781 | 0.797 | 0.825 | 0.789 |

D's joint calibration chose s = 0.65, A's own threshold, so D is A. C's line threshold (bays 0.85, floors 0.9) is so strict that the line fallback hardly ever counts, so C differs from A only in the fourth decimal. B's extra phrases at s_B = 0.2 lower the glazed or banded subset. That subset is 4 images with 587 windows, too few to show a gain on glass façades either way.

Rule: highest mean over the two test sets among candidates within 0.01 of A on CMP odd; otherwise A. Choice: **A**. LabelMeFacade test images whose labelled windows cover >= 40% of the building or whose median window is >= 3x as wide as tall (4 images). LabelMeFacade's window labels are often incomplete (in 7 of 10 test images checked by eye only some windows are labelled), which counts true repetition as false and so penalises candidates that find more windows.

### Rectified façades and translational symmetry (prompt 065)

Same windows and reference as above; balanced accuracy / precision, mean over bays and floors.

| Candidate | CMP odd | LabelMeFacade test | glazed or banded | Mean of the two test sets |
|---|---|---|---|---|
| A: current: SAM 3 window and balcony centres, score >= s, current tau | 0.781 / 0.297 | 0.797 / 0.106 | 0.825 / 0.116 | 0.789 |
| R: A with the centres rectified per window (horizontal and vertical vanishing points), tau recalibrated | 0.776 / 0.288 | 0.775 / 0.101 | 0.758 / 0.098 | 0.776 |
| S: no instances: rectified gradient profiles per window, autocorrelation peak at lags 5-100 px, own tau | 0.613 / 0.203 | 0.552 / 0.048 | 0.461 / 0.016 | 0.582 |

Rectified: 165925 of 241355 windows (69%); the others have no façade plane with enough agreeing edges (most CMP façades are already rectified). Rule: highest mean balanced accuracy over the two test sets among candidates within 0.01 of A on CMP odd and with precision on CMP odd not below A's; otherwise A. Choice: **A**.

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

### Frontage grade: a check by eye (prompt 062)

Three photos, openings on the ground floor counted by eye, against the automatic counts within 60 m of the camera.

| Photo | Entrances (eye / automatic) | Shopfronts | Ground-floor windows | Grade |
|---|---|---|---|---|
| zurich-24 | about 4 / 2 | about 3 / 3 | about 8 / 15 | D |
| zurich-42 | 2–3 / 2 (one is a first-floor balcony door) | 3–4 / 0 | 3–4 / 12 | D |
| zuidas-gershwinplein | 2–3 / 1 | 0 / 1 (a glazed lobby) | 0 / 0 | E |

Doors are missed, so entrances per 100 m, the grade's main criterion, come out low and the grade tends to be too low. In the Zürich photos the estimated ground floor reaches the first-floor windows, so ground-floor windows are over-counted. Over the 34 photos: E 16, D 3, D–E 2, no grade 13 (no horizon found, or under 20 m of frontage within 60 m). The grade is shown as an estimate and changes no outcome.

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

### Surface detail (prompt 063)

Surface detail (|G(1) − G(3)| / (G(8) of the grey image + 0.01), averaged with G(8), at the image's own resolution) per labelled region of 200 outdoor DMS test images, chosen as above (more originals could be downloaded than for the materials check), odd images only: AUC textured against smooth classes 0.44 (1095 and 1467 regions), brickwork against paint/plaster 0.27 (59 and 677 regions).

Rule tested: pixels DMS46 calls plaster/paint or concrete with surface detail above t count as textured; t maximises the grouping's pixel accuracy on the even images; adopted only if on the odd images the accuracy rises by at least 1 point and textured IoU does not fall. t = 0.2694. Odd images: pixel accuracy 0.80 → 0.79, textured IoU 0.65 → 0.64. **Not adopted**: surface detail is shown as an indicator only.

## Sensitivity of the rules

How many of the 34 outcomes change when one threshold is halved or multiplied by 1.5.

| Principle | Threshold | Value | × 0.5 | × 1.5 |
|---|---|---|---|---|
| groundFloor | frontageMin | 0.05 | 0 | 0 |
| groundFloor | openPresent | 0.3 | 3 | 0 |
| groundFloor | openAbsent | 0.1 | 3 | 2 |
| groundFloor | closedAbsent | 0.6 | 0 | 4 |
| rhythm | facadeCellsMin | 8 | 0 | 0 |
| rhythm | rhythmicPresent | 0.25 | 6 | 5 |
| rhythm | zonesPresent | 2 | 1 | 6 |
| rhythm | rhythmicAbsent | 0.1 | 1 | 3 |
| materials | zoneMin | 0.1 | 0 | 2 |
| materials | texturedPresent | 0.25 | 7 | 5 |
| materials | texturedAbsent | 0.1 | 2 | 2 |
| materials | smoothRatio | 2.0 | 2 | 1 |

## Do the measures tell the photos apart?

| Principle | Photos | Likely present | Unclear | Likely absent |
|---|---|---|---|---|
| groundFloor | 24 photos | 1 | 10 | 13 |
| groundFloor | 10 study images | 2 | 3 | 5 |
| rhythm | 24 photos | 11 | 7 | 6 |
| rhythm | 10 study images | 3 | 3 | 4 |
| materials | 28 photos | 6 | 14 | 8 |
| materials | 10 study images | 1 | 9 | 0 |

| Principle | Main indicator | Range over all photos |
|---|---|---|
| groundFloor | `openShare` | 0.00–0.64 |
| rhythm | `rhythmicShare` | 0.00–0.90 |
| materials | `texturedShare` | 0.00–0.84 |

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

## The simulated panel as observer (prompt 060)

Qwen3-VL answered visible questions (counts and yes/no; four sampled runs per photo); ratings 0–4 come from a rule fixed before the run. Weighted: the graded prompt's expected rating from the probabilities of 0–4, mean over four roles. Automated against automated, not a validation.

| Principle | Observed: values (sd) | On the 24 photos | Weighted: distinct (range) | Graded medians (24 photos) | ρ observed / weighted with the measure |
|---|---|---|---|---|---|
| groundFloor | 0–4 (1.02) | 0: 1, 1: 13, 2: 5, 3: 3, 4: 2 | 30 (1.0–3.3) | 4 (1–3) | 0.61 / 0.53 (openShare) |
| rhythm | 0–4 (1.30) | 2: 1, 3: 2, 4: 21 | 25 (3.0–4.0) | 2 (3–4) | 0.22 / 0.13 (rhythmicShare) |
| materials | 0–4 (1.24) | 0: 1, 1: 9, 2: 7, 3: 6, 4: 1 | 18 (1.9–3.0) | 3 (2–3) | 0.08 / -0.21 (texturedShare) |

All four runs give the same answer: entrances 71%, shopWindows 79%, buildings 59%, blankStretch 62%, streetUse 85%, repeatedBays 85%, repeatedFloors 85%, variety 94%, texturedSurfaces 82%, materials 35%.
On the ordinary photos the model answers yes to the rhythm questions almost every time, so rhythm still hardly separates them; its spread comes from the renderings.

## Expert labels later

Raters judge the photos on `/eek-a-look/rate.html` (prompt 059) on the 2020 panel's scale (`present`, `ambiguous`,
`absent`) and send back its CSV; `uv run agreement.py --labels a.csv b.csv …` reports their agreement with each
other (Krippendorff's alpha) and each method's agreement with their majority label.
