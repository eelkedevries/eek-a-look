# vlm-panel

A **simulated panel**: a vision-language model, run locally as eight panel
members, judges each eek-a-look example photo on three design principles.
This is an AI judgement. No experts judged these photos, so it is not
validated.

## Where the principles come from

Spanjar & Suurenbroek (2020, *Journal of Digital Landscape Architecture* 5,
374–385) had 14 experts in architecture, landscape architecture, planning and
urban design classify 15 streetscape photos before an eye-tracking experiment.
They worked in two groups that swapped photos to check each other. Each
principle was rated "present" or "absent", or "ambiguous" without consensus:
- horizontal–vertical rhythm and variety;
- an active ground floor;
- use of tactile materials.

The paper names the principles but does not define them. `prompt.md` holds
this project's plain-language reading of them, which is not the panel's own
wording, and the exact messages sent to the model.

## How it works

- **Model:** `Qwen/Qwen3-VL-8B-Instruct` (Apache-2.0), loaded in 4-bit NF4 to
  fit the RTX 4070's 8 GB. If a probe answer peaks above 7.5 GB, it falls back
  to `Qwen/Qwen3-VL-4B-Instruct` in 8-bit. Revisions are pinned in
  `panel.py`, and the model and quantisation used are recorded in the output.
- **Members:** four roles (architect, landscape architect, urban designer,
  planner, the 2020 panel's fields) × two fixed seeds. Sampling uses
  temperature 0.7 and top-p 0.9. The photo is scaled to at most 1 megapixel.
- **Answers:** each member gives strict JSON: per principle, a verdict and one
  sentence of evidence naming visible elements. An invalid answer is retried
  twice, then counted as a missing vote.
- **Consensus:** a verdict counts when at least 6 of 8 members agree;
  otherwise it is "ambiguous".
- **Agreement:** Fleiss' kappa per principle over the 24 photos.
- **Stability:** the whole panel runs again with two other seeds; the output
  reports the share of the 72 consensus labels that stay the same.
- **Cross-check (exploratory):** for the active ground floor, the Spearman
  correlation between the verdicts and the share of each photo's ground floor
  covered by entrances and shopfronts (from `tools/areas/`). It compares two
  automated methods, so it is not a validation.

Agreement and stability show that the model is *consistent*, not that it is
*right*. A kappa of `null` means every member gave the same verdict on every
photo: the model did not tell the photos apart on that principle at all.
That happened for rhythm and variety and for tactile materials in the
2026-10-18 run: "present" on all 24 photos.

## Graded run (prompt 044)

Because the present/absent run said "present" for rhythm and materials on
every photo, `panel.py --graded` asks the same eight members, with the same
system message and definitions (`prompt_graded.md`, fixed before the run), to
**rate** each principle from 0 to 4 (0 absent, 1 a trace, 2 partly present,
3 clearly present, 4 strongly present throughout), give one sentence of
evidence, and draw up to three **boxes** around the elements that support the
rating. Boxes come back in Qwen3-VL's relative 0–1000 `bbox_2d` convention
(official cookbook) and are stored on the mask grid of the area files. One
probe photo was used only to confirm the JSON format.

Results of the 2026-10-19 run (`public/precomputed/vlm-panel/panel-graded.json`):

| | Rhythm and variety | Active ground floor | Tactile materials |
|---|---|---|---|
| Krippendorff's alpha (ordinal), among members | 0.95 | 0.81 | 0.67 |
| Distinct medians over 24 photos | 2 (3–4) | 4 (1–3) | 3 (2–3) |
| Box area inside the matching automatic region | 83% (façade) | 64% (ground floor, dilated 2%) | 50% (eye-level zone) |
| Spearman with the image measure (exploratory) | −0.04 | 0.49 (21 photos) | −0.25 |

70 of 72 medians changed by at most 0.5 in a second run with seeds 37 and 41.
129 s per photo for eight members; peak GPU memory 7.29 GB.

Reading: the graded scale separates the ground floor and, a little, the
materials, but rhythm is still at the top of the scale on every photo (3 or
4). Agreement among members of one model and stability across seeds are
consistency, not validity. The boxes mostly sit on relevant elements (shop
windows and awnings, window bays, planters), but some cover a whole building.
Neither the ratings nor the boxes are combined with gaze statistics.

```sh
uv run panel.py --graded   # writes public/precomputed/vlm-panel/panel-graded.json
```

## As observer (prompt 060)

`uv run panel.py --observe` asks the same model what it *sees*
(`prompt_observe.md`): doors and shop windows at street level, a blank
stretch, use in front; buildings, repeating bays, repeating floors, variety;
materials named within about 3 m of the ground, visible texture. Four sampled
runs per photo (seeds 11, 23, 37, 41): counts take the median, yes/no the
majority (a tie is no), a material counts if named in at least two runs. A
rule fixed before the run turns the answers into ratings 0–4:

- ground floor = [doors ≥ 1] + [doors ≥ 3] + [shop windows ≥ 1] + [no blank
  stretch] + [use in front], at most 4;
- rhythm = [bays repeat] + [floors repeat] + [variety] + [buildings ≥ 3];
- materials = textured materials named (brick, natural stone, wood, tiles or
  setts, planting) + [visible texture], at most 4.

It also re-asks the graded prompt once per role without sampling and takes
the expected rating from the probabilities of the tokens 0–4 (G-Eval style),
so ratings no longer tie. Results (34 photos after the Guangzhou panoramas were
removed, 75–100 s per photo, peak 7.3 GB):

| Principle | Observed (sd) | On the 24 photos | Weighted: distinct (range) | Graded medians | ρ observed / weighted with the image measure |
|---|---|---|---|---|---|
| ground floor | 0–4 (1.02) | 1 ×13, 2 ×5, 3 ×3, 4 ×2, 0 ×1 | 30 (1.0–3.3) | 1–3 | 0.61 / 0.53 |
| rhythm | 0–4 (1.30) | 4 ×21, 3 ×2, 2 ×1 | 25 (3.0–4.0) | 3–4 | 0.22 / 0.13 |
| materials | 0–4 (1.24) | 1 ×9, 2 ×7, 3 ×6, 0 ×1, 4 ×1 | 18 (1.9–3.0) | 2–3 | 0.08 / −0.21 |

The observed rule separates the photos on the ground floor and materials,
and the weighted ratings no longer tie. On rhythm the model still says yes to
repetition and variety on almost every ordinary photo; the spread comes from
the renderings. The links with the image measures are between
automated methods, not a validation. All four runs agree on 59–94% of the
photos per question, but on the full materials list only on 35%.

## Caveats

- VLM judgements can track crowd ratings of general attractiveness (Zhou,
  Zhang & Zhu 2025: GPT-4o against Place Pulse 2.0, ρ = 0.76), but these are
  expert design principles, not attractiveness.
- Multimodal models lean towards European and North American framings and
  flatten the variety of human responses (Zhao et al. 2026).
- Different seeds of one model are not independent experts: the panel's
  agreement is likely higher than real experts' would be.

Sources: `docs-dev/reference/secondary_background/areas_sources.md`.

## Command

```sh
cd tools/vlm-panel
uv run panel.py             # writes public/precomputed/vlm-panel/panel.json
uv run panel.py --graded    # ratings 0–4 with boxes, panel-graded.json (prompt 044)
uv run panel.py --observe   # observations, rule ratings, weighted ratings, panel-observed.json (prompt 060)
```

The first run downloads the model (about 17 GB for the 8B version) into the
local Hugging Face cache; no weights are committed.
