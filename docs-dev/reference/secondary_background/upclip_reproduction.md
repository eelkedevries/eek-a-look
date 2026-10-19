# UP-CLIP: a reproduction from the authors' public sample

Prompt 045, 2026-10-19. Tool: `tools/up-clip/`. Figures:
`tools/up-clip/retrieval.json`. Availability and sources:
[`qualities_sources.md`](qualities_sources.md).

## What is and is not available

- **Published:** the paper (Huang, Song & Jiao 2026, *International Journal of
  Digital Earth* 19(1), 2677402, CC BY 4.0), the training script and a sample
  of 1,000 of the 15,000 image–text pairs, in
  <https://github.com/19883120121i-afk/UP-CLIP> (commit `ef1bb18`).
- **Not published:** the trained model (no checkpoint, release or Hugging Face
  upload), the full dataset (on request by e-mail), and a licence file (the
  README says MIT; GitHub reports none).

So the published UP-CLIP model cannot be used here. What eek-a-look has is a
**reproduction**: the authors' script, run on their public sample.

## How the reproduction differs from the published model

| | Published UP-CLIP | This reproduction |
|---|---|---|
| Training pairs | 15,000 (80% for training, by the script's split) | 800 of the 1,000-pair sample (the script's 80/20 split, seed 42) |
| Script | `train.py` | the same, with four changes (`train_8gb.diff`): `compute_loss` accepts `num_items_in_batch` and `logging_dir` is dropped, both for current transformers; gradient checkpointing and 8-bit AdamW to fit 8 GB |
| Batch | 32 (README) | 32; the unchanged settings ran out of memory (7.58 GB) |
| Base model | CLIP ViT-L/14 per the README's example; **not verified** from the paper | `openai/clip-vit-large-patch14` at `32bd642` |
| Stopping | early stopping on validation loss, patience 3 | did not trigger: the script adds the validation loss after the early-stopping callback has looked for it, so transformers switched it off. All 50 epochs ran; the best checkpoint by validation loss (epoch 8, loss 2.78; 4.82 at epoch 50) was loaded at the end, as the script intends |
| Warm-up | 200 steps | the same 200 steps, which at 7 steps per epoch last until epoch 29 |
| Test pool | the authors' test split of 15,000 pairs | 200 held-out pairs of the sample |

Training took 39 minutes on the RTX 4070 (peak 6.45 GB).

## Data check

- 1,000 pairs, 985 distinct images: 15 images appear twice under different
  file names (coordinates written with more or fewer decimals), always with
  different captions.
- 3 of those pairs straddle the script's split: their image is in both the
  training and the test part. Removing them (and later copies within the test
  part) leaves 196 test pairs; the results barely change.
- No caption is longer than CLIP's 77 tokens.

## Retrieval on the 200 held-out pairs

Recall@K: how often the right caption (for a photo) or photo (for a caption)
is first, in the first five, or in the first ten of the 200.

| Model | Photo → caption R@1 / R@5 / R@10 | Caption → photo R@1 / R@5 / R@10 |
|---|---|---|
| Plain CLIP ViT-L/14 | 0.07 / 0.19 / 0.28 | 0.05 / 0.16 / 0.26 |
| UP-CLIP reproduction | 0.17 / 0.40 / 0.53 | 0.15 / 0.34 / 0.48 |
| (without duplicates, 196 pairs) | 0.17 / 0.40 / 0.53 | 0.15 / 0.33 / 0.47 |

Fine-tuning on 800 pairs roughly doubles retrieval over plain CLIP. The
paper's "Recall@5 over 70%" was measured on a different, larger test pool
with fifteen times the training data, so the numbers cannot be compared: a
smaller pool makes retrieval easier, less training data makes it harder. The
captions in the sample are close variations on a few keywords, which also
makes the right caption hard to single out.

## What this means for eek-a-look

- The reproduction shows the authors' method works in the direction they
  describe, on their own kind of data. It does not show how the published
  model behaves.
- It was trained on Wuhan street-view photos with first-person perception
  captions. Dutch high-rise streets and Zürich, and the three design
  principles, are outside what it learned and outside what the authors
  evaluated.
- Nothing from the authors' repository and no weights are published. Only the
  scores for the eek-a-look photos are (prompt 046).

## A note to the authors (draft, for the owner to send if wished)

> Subject: UP-CLIP checkpoint for a non-commercial research demonstration
>
> Dear Dr Huang, Dr Song and Professor Jiao,
>
> I read "From pixels to perception: fine-tuning vision-language models for
> semantic urban perception" with interest. For eek-a-look, a non-commercial
> research demonstration of gaze prediction on Dutch high-rise streetscapes, I
> re-ran your training script on the public 1,000-pair sample; on its 200
> held-out pairs it reaches Recall@5 of 0.40 (photo to text) against 0.19 for
> plain CLIP. To compare fairly with your published results, would you be
> willing to share the trained UP-CLIP checkpoint, or the full dataset, for
> research use? I would credit the paper and follow any terms you set. I also
> noticed that the repository's README states the MIT licence but there is no
> LICENSE file; a short note on the intended licence would help.
>
> Kind regards,
> Eelke de Vries
