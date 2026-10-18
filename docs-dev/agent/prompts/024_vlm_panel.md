# Task: Simulated panel on the three design principles

## Goal

Run a local vision-language model as eight simulated panel members that judge
each example photo on the three design principles of the 2020 HvA expert
panel, and publish their consensus with agreement and stability figures.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Spanjar & Suurenbroek (2020): 14 experts in architecture, landscape
  architecture, planning and urban design classified each photo on the
  presence of horizontal–vertical rhythm and variety, an active ground floor,
  and use of tactile materials. Two groups classified, then swapped to check
  each other; without consensus a principle was "ambiguous". Sources:
  `docs-dev/reference/secondary_background/areas_sources.md`.
- No expert labels exist for the example photos. The output is an AI
  judgement; its agreement and stability show consistency, not validity.
- Evidence and caveats:
  - VLM judgements can track crowd ratings of general attractiveness (Zhou et
    al. 2025: ρ = 0.76 against Place Pulse 2.0);
  - they lean towards European and North American framings and flatten the
    variety of human responses (Zhao et al. 2026).
- **Model:** `Qwen/Qwen3-VL-8B-Instruct` (Apache-2.0, 8.77B parameters), loaded
  in 4-bit NF4 with `bitsandbytes` to fit the 8 GB RTX 4070. If it does not
  load, or its peak memory exceeds 7.5 GB, use `Qwen/Qwen3-VL-4B-Instruct`
  (4.44B) in 8-bit, and record which was used. Pin the revision.

## Required changes

1. Create `tools/vlm-panel/` as a `uv` project with a pinned Python (3.12),
   `torch`, `transformers` (≥ 5.20, locked), `accelerate`, `bitsandbytes` and
   `pillow`.
2. Write `tools/vlm-panel/prompt.md`, the committed prompt. Label the
   definitions as this project's plain-language reading of the principles,
   not the panel's own wording:
   - **Horizontal–vertical rhythm and variety:** façades divided into
     recognisable horizontal layers (base, middle, top; floor lines, cornices)
     and vertical units (bays, plots, columns of windows) that repeat with some
     variation, rather than a uniform surface;
   - **Active ground floor:** a street-level storey that is open to the street
     (entrances, shop windows, see-through frontage, visible use), rather than
     blank walls, closed façades or service entries;
   - **Tactile materials:** materials at eye level with visible texture and
     detail that invite touch (brick, stone, wood, planting, fine detailing),
     rather than smooth, uniform glass, metal or render.

   The prompt asks for strict JSON:
   `{ "rhythm" | "groundFloor" | "materials": { "verdict": "present" | "absent", "evidence": "<one sentence naming visible elements>" } }`.
3. `panel.py`:
   - eight members: four roles (architect, landscape architect, urban
     designer, planner) × two fixed seeds; temperature 0.7, top-p 0.9;
   - the photo at no more than about 1 megapixel;
   - invalid JSON is retried twice, then counted as a missing vote;
   - **consensus** per principle: `present` or `absent` when at least 6 of 8
     members agree, otherwise `ambiguous`;
   - **agreement:** Fleiss' kappa per principle over the 24 photos;
   - **stability:** run the whole panel a second time with two other seeds,
     and report the share of photo × principle consensus labels that stay the
     same;
   - **exploratory cross-check**, labelled as such: the Spearman correlation
     between the ground-floor verdicts (present = 1, absent = 0, ambiguous
     left out) and the share of each photo's ground floor covered by
     entrances and shopfronts (area files from 021 and 023);
   - print a table per photo, the kappas, the stability, the cross-check, the
     time per photo and the peak GPU memory.
4. Write `public/precomputed/vlm-panel/panel.json`: model id, revision,
   quantisation, prompt SHA-256, date, and per photo and principle the
   consensus, the votes (present, absent, missing) and two evidence sentences
   from members who voted with the consensus. Add the kappas, stability and
   cross-check.
5. Write `tools/vlm-panel/README.md`: what it is and is not, the licence, the
   prompt, the consensus rule, the commands and the caveats above.
6. Add `tools/vlm-panel/.cache/` and `tools/vlm-panel/.venv/` to
   `.gitignore`.

## Do not implement

Do not implement:
- page changes (026);
- scores on a scale, rankings, or judgements beyond the three principles;
- hosted models or API calls;
- fine-tuning, or tuning the prompt to reach a wanted result.

## Acceptance criteria

The task is complete when:
- `uv run panel.py` writes `panel.json` with a consensus label for all 24
  photos × 3 principles, plus the kappas, the stability and the cross-check;
- the model used, the quantisation and the peak GPU memory (at most 8 GB) are
  printed and quoted in the final report;
- for three photos, the final report checks each evidence sentence against
  the photo and lists any element named that is not visible;
- no model weights are in git, and `npm run check` passes.

## Checks

`cd tools/vlm-panel && uv run panel.py`; view three photos against their
evidence sentences; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
