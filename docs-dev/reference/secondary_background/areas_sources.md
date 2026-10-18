# Areas in the image: sources

Non-binding background for the fifth round (areas, attention per area, simulated
panel; see `docs-dev/plan.md`). Every claim below was checked against the
primary source on 2026-10-18, unless marked **not verified**.

## The research group's studies

- **Spanjar, G. & Suurenbroek, F. (2020).** Eye-tracking the city: matching the
  design of streetscapes in high-rise environments with users' visual
  experiences. *Journal of Digital Landscape Architecture* 5, 374–385
  (CC BY-ND). PDF: <https://gispoint.de/fileadmin/user_upload/paper_gis_open/DLA_2020/537690038.pdf>
  - 31 participants, 15 photos of high-rise streetscapes, Tobii X2-30,
    heatmaps over 5 s made in iMotions.
  - "Before the test, a panel of 14 experts were commissioned to classify each
    photograph according to the presence and quality of three design
    principles: horizontal–vertical rhythm and variety, active ground floor,
    and use of tactile materials." Two groups classified, then swapped to
    check each other; without consensus a principle was "ambiguous". Table 1
    gives one overall label per scene: positive, negative, ambiguous or no
    consensus.
  - Fig. 1 is a heatmap of George Gershwinlaan, Amsterdam (Zuidas).
- **Spanjar, G., Suurenbroek, F. & Reynolds, R. (2024).** The non-experts'
  experience of 3D city visualisations: lessons for urban design practice.
  *JoDLA* 9-2024, 471–481. doi:[10.14627/537752043](https://doi.org/10.14627/537752043).
  PDF: <https://gispoint.de/fileadmin/user_upload/paper_gis_open/DLA_2024/537752043.pdf>
  - "The heatmaps were analysed by a panel of 15 commissioned spatial
    experts." The panel named the inset "of entrances, balconies, and windows"
    creating "an interplay of light and shade, producing depth and contrast",
    differences in hue and luminance, and "the openings of the buildings".
  - Design principles per viewpoint (citing Suurenbroek & Spanjar 2023):
    active ground floors, balconies with coloured railings, breaking up
    building mass, architectural detailing of frontages, stepped building
    mass, set-backs and variation in openings, community space with greenery.
- Neither paper draws regions in the images (checked in both full texts).

## Gaze mapped onto scene classes

- **Che, L., Wang, X., Pollefeys, M., Schindler, K., Raubal, M. & Kiefer, P.
  (2026).** Modeling subjective urban perception with human gaze
  (Place Pulse-Gaze). arXiv:[2605.00764](https://arxiv.org/abs/2605.00764), 1 May 2026.
  Mask2Former pretrained on Cityscapes (19 classes); fixations assigned to a
  class by their mean location; shares of fixation time per class, with no
  normalisation by class area stated. 2,248 Place Pulse 2.0 images, 96
  participants, Tobii Pro Spectrum (600 Hz), 7 s per image. Data and code
  "will be available" at <https://github.com/lin102/Place-Pulse-Gaze>.
- **Alinaghi, N., Hollendonner, S. & Giannopoulos, I. (2024).** MYFix:
  automated fixation annotation of eye-tracking videos. *Sensors* 24(9), 2666.
  doi:[10.3390/s24092666](https://doi.org/10.3390/s24092666). Mobile eye
  tracking outdoors: YOLOv8 (COCO) and Mask2Former (Cityscapes) on scene-camera
  frames, no retraining; 89.05% accuracy in a controlled and 81.50% in a
  real-world wayfinding setting; about 1.61 s per frame.

## Segmentation models

| Model | Classes relevant here | Licence (weights) | Size | Browser |
|---|---|---|---|---|
| OneFormer ADE20K Swin-L (`shi-labs/oneformer_ade20k_swin_large`) | ADE20K 150, incl. building, sky, tree, road, sidewalk, person, car, signboard, poster, trade name, awning, windowpane, door, railing, column | MIT (Hugging Face card; repository MIT) | **measured** peak 2.65 GB on the RTX 4070 | Not supported by Transformers.js |
| Mask2Former Swin-L (Cityscapes, ADE20K, Mapillary) | Cityscapes 19; ADE20K 150; Mapillary Vistas 65 (no windows or doors) | CC BY-NC 4.0 ("All models available for download through this document", `MODEL_ZOO.md`); code MIT | 216M params | Not supported by Transformers.js |
| SegFormer (NVIDIA) ADE20K / Cityscapes | as the dataset | NVIDIA Source Code License: "only may be used ... non-commercially", i.e. "for research or evaluation purposes only" | B0–B5 | Supported; ONNX exports exist (`onnx-community/segformer-b3-finetuned-ade-512-512-ONNX`) |
| SAM 3 (`facebook/sam3`) | any short noun phrase ("window", "balcony") | SAM License (19 Nov 2025): royalty-free limited licence; redistribution only with the agreement; "you must acknowledge the use of SAM Materials in your publication"; gated on Hugging Face | 848M params (README); 3.44 GB fp32 file; VRAM **not verified**, to be measured | Transformers.js lists SAM 3, but only the tracker (point/box prompts) is exported to ONNX (`onnx-community/sam3-tracker-ONNX`) |
| Grounding DINO base + SAM 2.1 large | any phrase (boxes), then masks | Apache-2.0 (both); Grounded-SAM-2 repo Apache-2.0 | 233M + 224M params; **measured** peak 4.34 GB | Both listed in Transformers.js |
| OWLv2 large (`google/owlv2-large-patch14-ensemble`) | any phrase (boxes) | Apache-2.0 | 438M | Listed in Transformers.js |
| CLIPSeg (`CIDAS/clipseg-rd64-refined`) | any phrase, coarse | Apache-2.0 | 151M | Supported |
| Florence-2 large | referring segmentation | MIT | 777M | Supported |

Sources: model cards and `config.json` on Hugging Face (fetched 2026-10-18);
<https://github.com/facebookresearch/Mask2Former/blob/main/MODEL_ZOO.md>;
<https://github.com/NVlabs/SegFormer/blob/master/LICENSE>;
<https://github.com/facebookresearch/sam3> (README: Python ≥ 3.12, PyTorch ≥ 2.7,
CUDA ≥ 12.6, gated checkpoints) and its `LICENSE`;
<https://github.com/IDEA-Research/Grounded-SAM-2>;
<https://huggingface.co/docs/transformers.js/index>.

**SAM 3 access.** The Hugging Face gate of `facebook/sam3` is `manual`
(checked with the Hub API on 2026-10-18): Meta reviews each request. A later
version, `facebook/sam3.1` (March 2026), has the same manual gate. Ungated
repackaged copies exist, for example `Comfy-Org/sam3.1` (one 1.75 GB fp16
file for ComfyUI, with the SAM License). This project does not use them; the
owner chose to wait for Meta's review.

**SAM 3 against detector-plus-SAM pipelines.** Carion et al. (2025), SAM 3:
Segment Anything with Concepts, arXiv:[2511.16719](https://arxiv.org/abs/2511.16719)
(ICLR 2026). Table 1, instance masks, cgF1: SA-Co/Gold SAM 3 54.1, Grounding
DINO-T 3.3, OWLv2 17.3, human 72.8; LVIS SAM 3 37.2, Grounding DINO-T 14.7.
Prompts are short noun phrases; "SAM 3 is not designed for long referring
expressions"; it "struggles to generalize to out-of-domain terms". 30 ms per
image on an H200.

**Open vocabulary on street scenes.** Zeng, Z. & Boehm, J. (2024). Exploration
of an open vocabulary model on semantic segmentation for street scene imagery.
*ISPRS Int. J. Geo-Inf.* 13(5), 153. doi:[10.3390/ijgi13050153](https://doi.org/10.3390/ijgi13050153).
Grounded SAM on Cityscapes, BDD100K, GTA5 and KITTI: strong for single
categories, weaker with several categories, "especially categories bearing
close textual or visual resemblances"; refined prompts help.

**Façade elements.** Kanna, E., Arzoumanidis, L., Nguyen, H. D. A. S. & Dehbi,
Y. (2026). SVI2LoD3. arXiv:[2608.29992](https://arxiv.org/abs/2608.29992).
SAM 3 zero-shot "instructed to segment windows, doors and façade surfaces" in
street-view images; mIoU 0.7221 against adapted eTRIMS labels; window detection
rate 76.66%; balconies "not currently modeled". No published benchmark of
SAM 3 or Grounded SAM on balconies or shopfronts was found.

## Datasets and their terms

- **ADE20K**: images "only for non-commercial research and educational
  purposes"; annotations and software BSD-3 (<https://ade20k.csail.mit.edu/terms/>).
- **Cityscapes**: non-commercial only; trained models may be distributed as
  derivative works but not used commercially (<https://www.cityscapes-dataset.com/license/>).
- **Mapillary Vistas**: a free research edition (66 classes in v1.x, 124 in
  v2.0) and a separate commercial edition with 100 classes (Neuhold et al.,
  ICCV 2017). The research edition's licence is listed as CC BY-NC-SA 4.0 by
  third-party catalogues; **not verified** from Mapillary itself.
- **eTRIMS** (validation): 60 images in the 8-class set (building, car, door,
  pavement, road, sky, vegetation, window); "Data provided here may be used for
  research purposes"; cite Korč, F. & Förstner, W. (2009), eTRIMS Image
  Database for interpreting images of man-made scenes, TR-IGG-P-2009-01,
  University of Bonn. Download without login (78 MB):
  <https://www.ipb.uni-bonn.de/projects/etrims_db/>.
- **CMP Facade Database** (validation): 606 rectified façade images (base set
  378), 12 classes: facade, molding, cornice, pillar, window, door, sill,
  blind, balcony, shop, deco, background; CC BY-SA; cite Tyleček, R. & Šára, R.
  (2013), Spatial pattern templates for recognition of objects with regular
  structure, Proc. GCPR. Download without login (base 36.5 MB):
  <https://cmp.felk.cvut.cz/~tylecr1/facade/>.

Only derived masks and summary numbers are published; no dataset images and no
model weights.

## Ground floor by geometry

For a level pinhole camera at height *c* above flat ground, a point on a
vertical façade at height *h* projects at image row
*y = y<sub>h</sub> − (h − c)/c · (y<sub>0</sub> − y<sub>h</sub>)*, where *y<sub>h</sub>*
is the horizon row and *y<sub>0</sub>* the row where that façade meets the
ground. Objects on the ground plane at camera height (heads of standing
people) therefore lie on the horizon. This relation between horizon, camera
height and object heights is used by Hoiem, D., Efros, A. A. & Hebert, M.
(2008), Putting objects in perspective, *IJCV* 80, 3–15,
doi:[10.1007/s11263-008-0137-5](https://doi.org/10.1007/s11263-008-0137-5).
The 4 m storey height and 1.6 m eye height are assumptions of this project,
tested by a sensitivity analysis (prompt 022).

## Areas of interest and size

- Orquin, J. L., Ashby, N. J. S. & Clarke, A. D. F. (2016). Areas of interest
  as a signal detection problem in behavioral eye-tracking research. *Journal
  of Behavioral Decision Making* 29(2–3), 103–115: overlapping fixation
  distributions make AOI assignment a signal-detection problem; margins above
  0.5° helped where no overlap was expected.
- Hessels, R. S., Kemner, C., van den Boomen, C. & Hooge, I. T. C. (2016). The
  area-of-interest problem in eyetracking research: a noise-robust solution
  for face and sparse stimuli. *Behavior Research Methods* 48, 1694–1712.
  doi:[10.3758/s13428-015-0676-y](https://doi.org/10.3758/s13428-015-0676-y).
- Larger areas collect more gaze by size alone, so the page shows attention
  share divided by area share (1.0× = what size alone predicts).

## Vision-language models as judges

- **Qwen3-VL** (Apache-2.0): 2B (2.13B params), 4B (4.44B), 8B (8.77B; also an
  FP8 build) on Hugging Face. In bf16 the 8B needs about 17.5 GB and the 4B
  about 9 GB for weights alone (2 bytes per parameter), so on 8 GB the 8B needs
  4-bit quantisation; actual use **to be measured** (prompt 024). Gemma 3 is
  gated under the Gemma terms.
- Zhou, Q., Zhang, J. & Zhu, Z. (2025). Evaluating urban visual attractiveness
  perception using multimodal large language model and street view images.
  *Buildings* 15(16), 2970. doi:[10.3390/buildings15162970](https://doi.org/10.3390/buildings15162970).
  GPT-4o pairwise judgements on 1,000 street-view images, scaled by Thurstone's
  law: Spearman ρ = 0.76 against Place Pulse 2.0 crowd ratings (a Siamese CNN:
  0.60). General attractiveness, not expert design principles.
- Zhao, R., Liu, W., Sha, Z., Su, N., Zhang, Y. & Long, Y. (2026). Culturally
  uneven urban perception in large language models. arXiv:[2604.20048](https://arxiv.org/abs/2604.20048).
  Default judgements of three frontier models sit closer to European and North
  American framings; prompting shifts them but "fails to capture the full
  variety" of human responses.

## Own pilot, 2026-10-18 (not committed)

OneFormer ADE20K Swin-L and Grounding DINO base + SAM 2.1 large, on
weena-stationsplein, zuidas-gershwinplein, zurich-23 and zurich-18, RTX 4070:

- OneFormer: 0.24–0.52 s per photo, peak 2.65 GB. Clean sky, building, road,
  sidewalk, tree, person, poster, signboard, trade name, awning, bus, booth.
  No windowpane or door pixels at street distance: windows merge into
  "building".
- Grounding DINO + SAM 2.1, all nine phrases in one prompt: about 0.75 s per
  photo, peak 4.34 GB. Windows on the upper floors of Gershwinplein and its
  glass entrance were outlined well; "shopfront" covered 53% of that photo (a
  whole building); no balconies found; "window" covered 27% of zurich-18.
- SAM 3 was not tested (gated; no access yet).
