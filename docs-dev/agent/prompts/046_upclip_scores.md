# Task: UP-CLIP scores for the example photos

## Goal

Score every example photo against a fixed list of descriptions with the
UP-CLIP reproduction and with plain CLIP, in both directions, and publish the
scores with each use marked as supported or adapted.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- `tools/up-clip/` with the reproduction checkpoint and `retrieval.json`
  (045). Supported and adapted uses are listed in
  `docs-dev/reference/secondary_background/qualities_sources.md`.
- CLIP gives one embedding per image: these scores have no location.
- Image measures (040–042) and the graded panel (044) give per-photo values
  to compare with; comparisons between automated methods are exploratory.

## Required changes

1. `tools/up-clip/descriptions.json`, in this project's own wording (no
   captions from the authors' data), each with an `id`, `text`, `kind` and
   `use`:
   - **perception** (`use: "supported"`): one sentence per keyword of the
     authors' sample lexicon (the 16 words in the sources file), in the form
     "A street that feels {word}.";
   - **principle** (`use: "adaptation"`): for each principle, two positive
     and two negative sentences that follow the specification's operational
     definitions (for example "Shop windows and entrances open onto the
     pavement." and "Blank, closed walls line the street at ground level.").
2. `scores.py`:
   - image embeddings as the mean of three square crops covering the photo's
     width (left, centre, right), each through the CLIP processor, so the
     sides are not cut off; record this as an adaptation;
   - for both models, the cosine similarity of every photo with every
     description;
   - a **principle score** per photo and model: mean cosine with the positive
     sentences minus mean cosine with the negative ones;
   - **exploratory, automated vs automated:** across the 24 photos, the
     Spearman correlation of each model's principle score with the image
     measure's main indicator and with the graded panel's median rating.
3. Write `public/precomputed/up-clip/scores.json`: the models (plain CLIP and
   "UP-CLIP reproduction (1k pairs)", with revisions and the retrieval figures
   from 045), the descriptions, the similarity matrix per model (photo ×
   description, four decimals), the principle scores and the correlations.
   At most 60 kB.
4. Add a section to `tools/up-clip/README.md` with the descriptions, the crop
   rule, the scores and how to read them (a similarity, not a probability; only
   comparable within one model).
5. Specification (bump the version, with a line in *Changes*): a *UP-CLIP*
   section under *Domain rules* with the reproduction, the description list,
   the crop rule, the principle score, the supported and adapted uses, and the
   rule that UP-CLIP scores are not combined with gaze statistics.

## Do not implement

Do not implement:
- page changes (048);
- free-text descriptions, a browser or helper text encoder;
- spatial maps from CLIP (sliding windows, patch features).

## Acceptance criteria

The task is complete when:
- `uv run scores.py` writes `scores.json` for 24 photos, both models and every
  description;
- the final report lists, per model, the top three descriptions for three
  photos and the top three photos for three descriptions, and quotes the
  exploratory correlations;
- no weights are in git, and `npm run check` passes.

## Checks

`cd tools/up-clip && uv run scores.py`; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
