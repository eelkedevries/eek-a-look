# Qualities labelling: how it could be improved

Non-binding background (owner's request of 2026-10-19: "Do research into how
the Qualities labeling can be improved"). "Labelling" is read here as how the
site decides, per photo, whether each of the three design principles is
present (the image measures, the simulated panel, UP-CLIP) and how it shows
that decision. Sources were searched and read on 2026-10-19. A claim marked
**(excerpt)** was seen only in an abstract or search-engine excerpt, not in
the full text; **not verified** means it could not be checked at all.

## 1. Where the labelling is weak now

From `qualities_validation.md` and the earlier rounds (040–053):

- **No validity check.** Nobody has judged these photos against the
  principles, so the outcomes cannot be called right or wrong. Every check
  so far tests components (windows, openings, materials) or compares
  automated methods with each other.
- **Rhythm finds too much repetition.** On held-out CMP façades the recall is
  high (0.83/0.84) but the precision is low (0.41 vertical, 0.19 layers): the
  measure finds repetition in 36% and 32% of windows where the labels find
  18% and 7%. Glass and ribbon-window façades read as plain (053 tests a
  fix), and SAM 3 finds no façade elements in the 360° panoramas.
- **The ground-floor measure leans closed.** Against CMP labels it gives the
  same outcome on 65% of images (ρ 0.64). In 13 of 84 images the labels say
  "likely present" and SAM 3 says "likely absent". Panoramas read as closed
  because no elements are found.
- **Materials are mostly "unclear" on the study images** (20 of 25), and dark
  brick can read as plaster. DMS46 is right on 80% of pixels in its own kind
  of photos. Dutch and Swiss façades fall outside that kind.
- **The simulated panel does not tell photos apart on rhythm.** It gives 3–4
  on every photo and "present" in v1 on all 24 photos. Its ground-floor
  ratings vary (1–3) and agree moderately with the image measure.
- **The principles were never defined** by the original study (Spanjar &
  Suurenbroek 2020, §2.1). This project's operational definitions are its
  own, so each outcome is only as meaningful as its definition.

## 2. What the literature offers

### 2.1 Established scales to anchor the definitions

- **Urban Design Compendium, Table 5.3 "Active frontage guidelines"**
  (English Partnerships & Housing Corporation, *Urban Design Compendium*,
  p. 89, "Adapted from Gehl, 1994"; read from the PDF). Five grades with
  countable criteria:
  - **A:** "More than 15 premises every 100m", "More than 25 doors and
    windows every 100m", "No blind facades and few passive ones", "Much depth
    and relief in the building surface", "High quality materials and refined
    details".
  - **B:** 10–15 premises and more than 15 doors and windows every 100 m.
  - **C:** 6–10 premises, "Less than half blind or passive facades".
  - **D:** 3–5 premises, "Predominantly blind or passive facades", "Flat
    building surfaces".
  - **E:** 1 or 2 premises, "No details and nothing to look at".

  The same section ("Get the rhythm right") links the ground floor to rhythm:
  "narrow frontage buildings, giving vertical rhythm to the street scene",
  and to relief: "articulation of facades, with projections such as bays and
  porches". So the scale covers parts of all three principles.
- **STIPO, *Plinth Rating Manual*** (The City at Eye Level; read from the
  PDF). It rates each plinth A–E, on design ("hardware") and use
  ("software"). E is "mostly … blank walls, closed garage doors, or gates for
  resupply". A photo shows only the hardware, so an image measure can at
  best estimate half of this scale. It is Dutch practice, so it suits the
  Dutch photos.
- **Gehl, Kaefer & Reigstad (2006)**, "Close encounters with buildings",
  *Urban Design International*, doi:10.1057/palgrave.udi.9000162. This is the
  source of the A–E façade scale. Only the introduction could be read; the
  scale's exact wording is **not verified**. A council report attributes
  "13–20 doors per 100 m" for active frontage to Gehl **(excerpt)**.
- **Ewing & Handy (2009)**, "Measuring the unmeasurable: urban design
  qualities related to walkability", *Journal of Urban Design* 14(1), 65–84.
  An expert panel rated video clips. Transparency, complexity, human scale,
  enclosure and imageability were then expressed as regressions on physical
  features counted in the clips. This is the method that would turn the
  three principles into validated measures. The item-level features and
  weights are **not verified** (the full texts were not reachable).
- **Stamps (1999)**, "Physical determinants of preferences for residential
  facades", *Environment and Behavior* 31(6), 723–751 **(excerpt)**. It
  defines surface complexity, silhouette complexity and façade articulation
  in terms of materials and spatial relations. Surface complexity was the
  strongest predictor of preference (β = .72), and each definition tracked
  subjective impressions (r = .69–.90). This supports measuring surface
  detail directly, not only material classes, for tactile materials.

### 2.2 Ground floor from street images

- **Street-Frontage-Net**: Law, Seresinhe, Shen & Gutiérrez-Roig,
  *International Journal of Geographical Information Science*,
  doi:10.1080/13658816.2018.1555832 (abstract via Semantic Scholar). A CNN
  classifies frontage as active (windows and doors) or blank (walls, fences,
  garages), "up to 92.0%" accurate out of sample (London). Active frontage
  was linked with higher house prices and more "scenicness". The study shows
  the task is learnable from street images, and its active/blank definition
  matches ours.
- **Window-to-wall ratio** from street view: a SegFormer pipeline that first
  rectifies façades with vanishing points and a homography (arXiv
  2406.02706); a YOLOv9 detector of wall, garage and glazing with 94% of
  façades within ±5% of the true ratio (Politecnico di Torino, *Building
  Simulation* 2025, doi:10.1007/s12273-025-1301-3, **(excerpt)**). Both
  measure glazing per wall area, which is what the frontage measure needs,
  and both rectify first.

### 2.3 Repetition and rhythm

- Façade repetition can be found without object detectors, from
  translational symmetry: Wenzel, Drauschke & Förstner (Bonn, 2007/2008)
  detect multiply repeated structures in rectified façades along the
  horizontal and vertical directions with a minimum-description-length
  criterion. Generalised translation symmetry also handles aperiodic layouts
  (ICIP 2014) **(excerpt)**. Such methods work on mullion grids and banding,
  where window instances fail (glass façades).
- Rectification before measuring periodicity is standard in this
  literature, and in the window-to-wall work above. Our measure works in
  local tiles to cope with perspective. Rectifying each façade plane would
  make spacing comparable across the façade and probably lift precision.

### 2.4 Materials

- Street-view cladding datasets exist:
  - Wang et al., *Data in Brief* 57 (2024), 110885: London and Scotland, with
    cladding material, storeys and typology;
  - a *Scientific Reports* (2025) cladding classifier with the classes brick,
    concrete, glass, stone, mixed, others;
  - FaMatMuc (TUM, Munich), material segmentation of façades;
  - BMAT (*ESSD* preprint, 2026), materials for 22 million buildings.

  All **(excerpt)**. Their licences and class definitions were not checked.
  None of the excerpts names a plaster/render class, so they may not settle
  the brick-versus-plaster confusion.
- Stamps (1999, above): surface complexity predicts preference better than
  articulation. A texture measure (edge density or high-frequency energy at
  eye level) would capture visible detail whatever DMS calls the material.

### 2.5 Vision-language models as raters

- **They extract better than they decide.** UrbanAlign (arXiv 2602.19442):
  "VLMs are strong concept extractors but poor decision calibrators". It
  extracts interpretable concept scores from a frozen VLM and maps them to
  human ratings with a locally weighted regression: 72.2% accuracy
  (κ = 0.45) on Place Pulse 2.0, 15.5 points above the zero-shot VLM.
- **Objective items work better than appraisals.** A Montreal benchmark of
  seven VLMs against community annotators (arXiv 2509.14574): "stronger model
  alignment on visible, objective properties than subjective appraisals", and
  better model scores where the humans agree more.
- **Atomic questions are more reliable.** Davidsonian Scene Graph (Cho et
  al., ICLR 2024, arXiv 2310.18235) replaces one holistic judgement with
  atomic, non-overlapping yes/no questions, to avoid inconsistent answers.
- **Probability-weighted scores break ties.** G-Eval (Liu et al. 2023) takes
  the expected rating over the model's token probabilities instead of the
  printed integer, against "score collapse" and ties **(secondary sources)**.
  Qwen3-VL runs locally, so the logits are available.
- **Pairwise comparison is another option.** Place Pulse collects pairwise
  judgements, and GenArena reports better consistency and human alignment
  for VLM judges with pairwise choices aggregated by Bradley–Terry than with
  absolute scores (generation task, not urban; **(secondary)**). Pairwise
  scores are relative to the pool of photos (arXiv 2505.12758).
- A Research Square preprint (rs-10152272) asks whether LLMs can replace
  human raters for Ewing & Handy's qualities, and reports divergence on
  building materials among others **(excerpt; content not reachable)**.

### 2.6 Panoramas

Equirectangular images stretch content away from the horizon. Converting
them to perspective views (cube faces or gnomonic crops) is the usual remedy
and fits models trained on ordinary photos. SAM 3 is trained on perspective
images. It also accepts image exemplars as well as noun phrases (Carion et
al., "SAM 3: Segment Anything with Concepts", arXiv 2511.16719), which could
help with façade types it misses.

### 2.7 Gaze and façades

The authors' own preliminary eye-tracking chapter (HvA, "Exploring
eye-tracking technology") suggests that "Active ground floor" and "Ornate
facades" may predict the dominant eye patterns **(excerpt)**. Practitioner
pilots (Sussman & Ward) report that people ignore blank façades **(not
peer-reviewed)**. The site's attention ÷ size table already tests this per
evidence region on the Zürich photos.

## 3. Recommendations, most value first

1. **Get human judgements, with a written rubric.** Nothing below can be
   shown to be an improvement without them. Have at least three raters
   (urban designers, or HvA colleagues) judge the 49 photos on the 2020
   scale (present, ambiguous, absent), using written criteria:
   - ground floor: the Urban Design Compendium grades, and STIPO's
     "hardware";
   - rhythm: repeated bays and layers, and variety between buildings;
   - materials: visible surface detail near eye level.

   Then run `agreement.py` and report Krippendorff's alpha among the raters.
   A small rating page would cut the raters' work to a few minutes each.
   Only this step makes the outcomes validated rather than operational.
2. **Rebuild the panel as observer, not judge** (UrbanAlign, DSG, the
   Montreal finding). Ask Qwen3-VL atomic, visible questions per photo:
   - number of entrances at street level;
   - shop windows (yes/no);
   - number of distinct buildings;
   - repeated vertical bays (yes/no, how many);
   - materials named near eye level.

   Compute ratings from these answers by a rule fixed in advance, and weight
   the 0–4 tokens by their probabilities. This targets the panel's lack of
   discrimination at no hardware cost, and gives a second, independent count
   to set beside the image measures.
3. **Panoramas: measure in perspective views.** Reproject each 360° image
   into views facing the façades, run SAM 3 there, and map the masks back.
   This fixes the "no façade elements" failure on 15 of the 49 photos.
4. **Ground floor: an adapted frontage grade.** Count doors and windows on
   the ground floor per metre of frontage, with a door's height (about
   2.1 m) or the storey height as the ruler. Report a grade adapted from
   Table 5.3 (premises are hard to count in a photo, so state that). Keep
   the open-share outcome and show the grade as "adapted from the Urban
   Design Compendium". This replaces an arbitrary threshold with a published
   scale.
5. **Materials: add surface detail.** Add a texture measure (edge density or
   band-pass energy) on the eye-level façade, as a second indicator next to
   the DMS groups. Check it on hand-labelled patches of brick and plaster
   from the example photos. Only then consider a cladding dataset, after
   checking its licence and classes.
6. **Rhythm: rectify, then test translational symmetry.** Rectify each
   façade plane, then add a symmetry-based repetition detector that needs no
   window instances. Judge it on precision on odd CMP, where the measure is
   weakest, and on the glazed subset of 053.
7. **Show why an outcome is what it is.** Per principle, draw the main
   indicator on a small scale with the "unclear" band, so a borderline
   "unclear" can be told from a clear one. Mark photos where the image
   measure and the panel disagree.

Not recommended: fine-tuning a larger model on the 49 photos, or tuning the
thresholds until the outcomes look right. Both would hide the lack of
validation.

## 4. Proposed prompts

Renumbered from 058–064 to 059–065 after prompt 058 was used for the Example
section.

| # | Prompt | Needs |
|---|---|---|
| 059 | Rating rubric and rating page for human raters; `agreement.py` report | raters (owner recruits) |
| 060 | Panel v3: atomic observable questions, probability-weighted ratings | local GPU, ~2 h |
| 061 | Panoramas measured in perspective views | local GPU |
| 062 | Ground floor: frontage density and an adapted grade | — |
| 063 | Materials: surface-detail indicator, checked on labelled patches | ~100 hand-labelled patches |
| 064 | Outcome scale with the unclear band; method-disagreement flag | — |
| 065 | Rhythm: rectification and symmetry-based repetition | after 053's result |

## Sources

- Urban Design Compendium (English Partnerships & Housing Corporation), §5.2.1, Table 5.3, p. 89: <https://people.utm.my/lylai/wp-content/uploads/sites/630/2017/05/Urban-Design-Compendium-1.90.pdf>
- STIPO, Plinth Rating Manual: <https://stipo.nl/app/uploads/2021/01/Plinth-Rating-Manual.pdf>
- Gehl, Kaefer & Reigstad (2006): <https://doi.org/10.1057/palgrave.udi.9000162>
- Ewing & Handy (2009), project page: <https://activelivingresearch.org/identifying-and-measuring-urban-design-qualities-related-walkability>
- Stamps (1999): <https://pollux-fid.de/r/cr-10.1177/00139169921972326>
- Street-Frontage-Net: <https://doi.org/10.1080/13658816.2018.1555832>
- Window-to-wall ratio with SegFormer: <https://arxiv.org/abs/2406.02706>
- Wenzel, Drauschke & Förstner (2008): <https://www.ipb.uni-bonn.de/pdfs/Wenzel2008Detection.pdf>
- Building façade datasets (Data in Brief 2024): <https://doaj.org/article/880a755763b8493db2485d30d1121702>
- Cladding classification (Scientific Reports 2025): <https://doaj.org/article/2d5260f68ca14e6a9b1a236d48a266b2>
- FaMatMuc: <https://mediatum.ub.tum.de/doc/1785050/nsszxg7gq162y06miz0fyc7ol.Noll_egice.pdf>
- UrbanAlign: <https://arxiv.org/abs/2602.19442>
- Montreal VLM benchmark: <https://arxiv.org/abs/2509.14574>
- Davidsonian Scene Graph: <https://arxiv.org/abs/2310.18235>
- Global urban visual perception (relative scores): <https://arxiv.org/abs/2505.12758>
- LLMs as raters of urban design quality (preprint): <https://www.researchsquare.com/article/rs-10152272/v1>
- SAM 3: <https://arxiv.org/abs/2511.16719>
- Suurenbroek & Spanjar, Exploring eye-tracking technology: <https://research.hva.nl/en/publications/exploring-eye-tracking-technology-assessing-how-the-design-of-den/>
