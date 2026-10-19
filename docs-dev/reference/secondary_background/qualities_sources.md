# Architectural qualities and UP-CLIP: sources

Non-binding background for the sixth round (image measures for the three
design principles, a graded simulated panel and UP-CLIP; see
`docs-dev/plan.md`). Every claim below was checked against the primary source
on 2026-10-19, unless marked **not verified**.

## The three principles in the original study

Spanjar, G. & Suurenbroek, F. (2020). Eye-tracking the city: matching the
design of streetscapes in high-rise environments with users' visual
experiences. *Journal of Digital Landscape Architecture* 5, 374–385 (CC BY-ND;
full text read from the owner's copy).

- Section 2.1 names the principles: "(1) horizontal–vertical rhythms and
  variety, (2) active ground floor and (3) tactile materials located in the
  street-façade and street-space". The paper does not define them further.
- Section 2.4: "a panel of 14 experts were commissioned to classify each
  photograph according to the presence and quality of three design
  principles". Two groups classified and then swapped photos. With consensus a
  principle was "present" or "absent"; without it, "ambiguous". Table 1 gives
  one overall label per scene (positive, negative, ambiguous, no consensus).
  The judgements are per photo. No regions were drawn.
- Concrete cues the paper reports from the experts and the heatmaps:
  - street space: "a sequence of benches and plants" (Fig. 2A, tactile
    materials and plasticity); "cobblestones" and "raised stone flowerbeds that
    create a subtle transition between the façades and the street-space"
    (Discussion);
  - façades: "(oriel) windows and balconies"; "a high variation in
    buildings"; "anonymous and lacking in variation and rhythm" (Fig. 2A);
    "monotonous" (Fig. 2B); "the appearance of the vertical rhythm" (Fig. 2C);
  - ground floor: "the openings on the ground floor instantly captured the
    viewers' attention" (Fig. 2B); the experts "agreed that the height of the
    ground floor made it difficult to create a human scale" (Fig. 2D);
    "whether a ground floor is closed or transparent has little effect on
    eye-fixation" (Discussion).
- For Fig. 1 the text says both "there was no active ground floor" and, in the
  Discussion, that all three principles were applied there. The paper does
  not resolve this, which shows how loose the scene-level labels are.
- The 15 photos and the panel's per-principle labels are not public, so this
  project has no expert labels to test against.

## UP-CLIP: what exists

**Paper.** Huang, G., Song, X. & Jiao, H. (2026). From pixels to perception:
fine-tuning vision-language models for semantic urban perception.
*International Journal of Digital Earth* 19(1), 2677402.
doi:[10.1080/17538947.2026.2677402](https://doi.org/10.1080/17538947.2026.2677402).
Published online 24 May 2026, CC BY 4.0 (Crossref). Wuhan University.

- Abstract (via OpenAlex): a "lexicon-guided, human-AI collaborative
  annotation paradigm" builds 15,000 street-view image–text pairs; CLIP is
  fine-tuned on them; "UP-CLIP outperforms pre-trained baselines, achieving a
  Recall@5 over 70% in bi-directional retrieval"; applications in Wuhan map
  "ambivalent perceptions (e.g., 'vibrant yet worn-out') via text-to-image
  retrieval" and "city-wide sentiment distribution maps through image-to-text
  retrieval".
- The paper states: "we have made the core dataset and model training scripts
  publicly available" (seen in a search-engine excerpt of the full text). It
  does not say that model weights are released.
- The full text could not be fetched from this machine (the publisher returns
  HTTP 403 to scripts), so the backbone, the hyperparameters and the full
  results table are **not verified** from the paper.

**Repository.** <https://github.com/19883120121i-afk/UP-CLIP>, created and
last pushed on 2025-11-30 (GitHub API, 2026-10-19). It contains:

- `train.py`: a Hugging Face `Trainer` that fully fine-tunes a CLIP model with
  the standard contrastive loss (`return_loss=True`); learning rate 5e-6,
  cosine schedule, 200 warm-up steps, fp16, gradient accumulation 4, weight
  decay 0.01, early stopping on validation loss, and a random 80/20 split
  with seed 42;
- `requirements.txt` (unpinned: torch, pandas, pillow, datasets,
  transformers, scikit-learn);
- `data/dataset-1k.csv` and `data/image/` with 1,000 image files: the "subset
  dataset (1k samples)" of street-view images from Wuhan. Columns `filename`,
  `selected_keywords`, `text`. The captions are about 48 words long
  (maximum 53) and written in the first person. Sixteen keywords occur: Neat
  457, Efficient 379, Inconvenient 258, Natural 196, Comfortable 183, Safe 177,
  Run-down 156, Walkable 121, Beautiful 78, Ugly 66, Unique 59, Bustling 58,
  Chaotic 47, Dangerous 47, Lively 38, Historic 2. None of them names façade
  rhythm, ground-floor activity or materials;
- a README whose example command uses `openai/clip-vit-large-patch14`. The
  README's paths (`data/images`, `dataset_1k.csv`) differ from the files
  (`data/image`, `dataset-1k.csv`), and its citation block is a placeholder
  ("Your Name and Co-authors", "Journal Name").

What is **not** available:

- **No trained checkpoint.** No release, no weights in the repository, and no
  model on Hugging Face under "UP-CLIP", "up_clip", "upclip" or "urban
  perception clip" (Hub API searches, 2026-10-19).
- **No licence file.** The README says "MIT License", but there is no
  `LICENSE` file and GitHub reports no licence.
- **The full 15k dataset** is "available upon request" by e-mail
  (2023282090097@whu.edu.cn), citing "size limits and copyright
  restrictions". The licence of the 1k sample images is not stated.

Consequences for eek-a-look:

- The published UP-CLIP model cannot be run. A genuine use of *that* model
  would need the authors' checkpoint or their full dataset.
- What can be done is a **reproduction**: the authors' own training script on
  their public 1k sample (one fifteenth of the data). Its results describe
  this reproduction, not the published model.
- The sample images and any weights trained on them stay on the laptop and
  are never published; only scores for the eek-a-look photos are.

**Supported and adapted uses.**

| Use | Status |
|---|---|
| Image → perception description (rank descriptions for a street photo) | Supported by the paper (image-to-text retrieval, Recall@K), for Wuhan street-view images and its own caption style |
| Perception description → images (rank photos for a description) | Supported by the paper (text-to-image retrieval) |
| Short descriptions instead of ~48-word first-person captions | Adaptation |
| Dutch and Swiss eye-level photos instead of Wuhan street-view panoramas | Adaptation (domain shift) |
| Scoring the three design principles | Adaptation; not evaluated by the authors |
| Locating evidence in the image | Not supported: CLIP gives one embedding per image, no segmentation |

## CLIP ViT-L/14

`openai/clip-vit-large-patch14` (Hugging Face; the code in
<https://github.com/openai/CLIP> is MIT). The model card says: "**Any**
deployed use case of the model - whether commercial or not - is currently out
of scope", and that even constrained image search is "not recommended unless
there is thorough in-domain testing of the model with a specific, fixed class
taxonomy". eek-a-look therefore runs it only on the owner's laptop, publishes
only pre-computed scores for a fixed list of descriptions, and labels them as
research output that has not been tested in this domain.

## Material segmentation: DMS46

Upchurch, P. & Niu, R. (2022). A dense material segmentation dataset for
indoor and outdoor scene parsing. *ECCV 2022*. arXiv:[2207.10614](https://arxiv.org/abs/2207.10614).
Repository: <https://github.com/apple/ml-dms-dataset>.

- 3 million polygon labels of materials on 44 thousand Open Images photos;
  labels CC BY-NC 4.0.
- A pre-trained model (`dms46_v1.zip`, 170 MB, TorchScript) predicts 46
  materials, among them Brickwork, Concrete, Stone (natural), Stone
  (polished), Tile, Wood, Wood (tree), Foliage, Glass, Mirror, Metal,
  Paint/plaster/enamel, Asphalt, Sky and Water. The model and the sample code
  are under Apple's sample-code licence (`LICENSE.txt`): use, reproduction and
  modification are allowed; the notice must be kept when redistributing.
- The per-class accuracy of DMS46 is reported in the paper; the figures are to
  be quoted from it when the material measure is checked (prompt 043).
- Like OneFormer (trained on ADE20K, images for non-commercial research),
  the weights stay on the laptop; only masks are published.

## Measuring repetition in façades

- Repetition of horizontal layers and vertical bays can be read from the
  spacing of line segments and of repeated elements. Rectified façade parsing
  relies on such regularity: Tyleček & Šára (2013), the CMP Facade paper,
  model façades as "objects with regular structure". CMP labels cornices,
  sills, mouldings and pillars as well as windows, doors, balconies and shops,
  so the same repetition measure can be computed from human labels and from
  the automatic pipeline (prompt 043).
- Perspective changes the spacing along a receding façade, so the measure is
  taken locally, in tiles, and along the direction of the local line family
  rather than the image axes.

## Vision-language models with boxes

- Qwen3-VL (Apache-2.0) can return bounding boxes for things it names; the
  Qwen3-VL model card describes grounding with relative coordinates. The exact
  coordinate convention is to be confirmed on one probe photo before the run
  (prompt 044) and is **not verified** here.
- A graded scale (0–4) instead of present/absent is a change of measurement
  design, fixed before the run, to see whether the model separates photos at
  all. It is not tuned to reach a wanted result.
