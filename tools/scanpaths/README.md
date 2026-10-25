# scanpaths

Predicted fixations and scanpaths for the six images of the Example section
(prompt 076): the three originals (A) and their edits (B) listed in
`public/examples/comparisons.json`.

- **Fixations** (`fixations.py`): 800 points per image drawn from the stored
  DeepGaze MSDB map (`public/precomputed/deepgaze-msdb/<photo>.json`, the map
  the heatmap shows): a grid cell with its probability, then a uniform
  position within the cell. They are independent draws and have no order.
  Runs on the CPU in a second.
- **Scanpaths** (`scanpaths.py`): 100 scanpaths of eight fixations per image
  from [DeepGaze3.5-VL](https://github.com/Susmit-A/DeepGaze3.5-VL)
  (Agrawal, Bethge & Kümmerer, 2026,
  [arXiv:2607.02083](https://arxiv.org/abs/2607.02083)), the free-viewing
  adapter `model/combined_adapter/`. Needs a CUDA GPU.
- **Summary** (`summary.py`): recomputes, from the stored files, the numbers
  the page shows: per example the share of scanpaths with a fixation in the
  manipulated area among their first seven fixations after the start (the
  model's fixations 2–8), for A and B, B − A with its binomial standard
  error, and the share of the measured gaze paths of A with a fixation in
  the area within their first 3 s.
- **Window** (`window.py`): for each participant of each A image, the last
  fixation number (after the one on the central cross) that starts within
  3,000 ms of image onset, from the source's start times, to
  `public/precomputed/measured/<id>.window3s.json`. On the owner's decision
  of 2026-10-25, DeepGaze3.5-VL keeps its published 3-second prompt and a
  comparison with the 6-second measured paths uses only their first 3 s. No
  timing is published. The window holds a median of nine fixations per
  participant (5–14), against the model's seven after its start. Needs
  `tools/measured-gaze/.cache/etdb_v1.0.hdf5` (`tools/measured-gaze/fetch.py`).

The measured gaze paths are the per-participant files of prompt 077
(`tools/measured-gaze/build_scanpaths.py`), limited to the window above;
number 1 in the database is the fixation on the central cross. On the page, a predicted path is drawn without its starting fixation
and numbered 1–7, as the measured paths are numbered from the first
fixation after the cross.

## Licence position

The DeepGaze3.5-VL code and adapter are released for **non-commercial
research use only**; the base model, `OpenGVLab/InternVL3_5-8B-HF`, has its
own licence (Apache-2.0 on its model card). As with `tools/deepgaze-local/`,
nothing of either is copied into this repository: `scanpaths.py` downloads
four files and the adapter of the pinned commit into `.cache/` at run time
(the adapter checked against the SHA-256 of the repository's Git LFS
pointer), the base model comes from Hugging Face at a pinned revision, and
eek-a-look publishes only the resulting scanpaths. The prompt is imported from
the downloaded `predict_scanpath.py`, so it is the repository's own, word for
word.

## Fidelity: a 4-bit approximation

The published model is the base model in bf16 (about 17 GB) with the adapter
merged, run with vLLM. That does not fit the laptop's RTX 4070 with 8 GB. On
the owner's choice, `scanpaths.py` instead runs it with transformers, peft and
bitsandbytes:

- the language model's linear layers in **4-bit NF4** with double
  quantisation and bf16 compute;
- the vision encoder, projector and output layer in bf16, and the adapter as
  stored (unmerged);
- the input embeddings (1.2 GB) on the CPU, which gives the same values and
  frees GPU memory.

Quantisation changes the model's output probabilities by an amount that is
**not measured here**, so the stored scanpaths are draws from an
approximation of DeepGaze3.5-VL, not from the published model. Every output
file says so in `settings.deviation`, and the page labels the scanpaths
accordingly.

## Run

```bash
cd tools/scanpaths
uv run fixations.py                        # MSDB fixations, CPU
uv run window.py                           # 3-second window of the measured paths, CPU
uv run --group gpu scanpaths.py            # DeepGaze3.5-VL, GPU
uv run --group gpu scanpaths.py --check    # regenerate the first batch per image and compare
uv run summary.py                          # the numbers the page shows
```

`scanpaths.py --only-missing` skips images that already have scanpaths, and
`--only <photo-id>` runs one image. The first run downloads the adapter
(349 MB) and the base model (about 17 GB, into the Hugging Face cache).

Loading needs about 7.1 GB of GPU memory, by estimate, before the embeddings
move to the CPU (about 5.9 GB after, plus about 1 GB for the prompt's cache
and its copy). By estimate, each draw takes a few seconds, so the six images
(about 600 draws) take roughly 40–90 minutes. If loading runs out of memory on the
8 GB card, close other programs that use the GPU, or add `--lm-head-4bit` to
quantise the output layer as well (about 0.9 GB less). That is a further
deviation from the published model, and the files record it.

## Settings

- Prompt: `build_freeview_prompt(8)` of `predict_scanpath.py` (three seconds
  of free viewing, eight fixations), in the base model's chat template with
  the generation prompt, as the repository's `FewShotPromptBuilder` does.
  The base model's processor, with its defaults, turns the 1280 × 960 photo
  into 13 tiles of 448 × 448 px (12 and a thumbnail), so the prompt has
  3,500 tokens. The prompt is run through the model once per image; each
  scanpath is then drawn from a copy of its cache.
- Sampling: pure sampling from the model's distribution, temperature 1, no
  top-k, top-p or repetition penalty, at most 144 new tokens; one draw at a
  time, with `torch.manual_seed(seed + j)` before draw `j`. The seed of an
  image comes from its id (`common.seed_for`), so it does not depend on the
  order of the images. A run stops with an error if fewer than one in five
  draws is valid.
- A draw is kept only if it has exactly eight fixations with coordinates
  0–99; the first 100 kept draws are stored, in order. The number of draws,
  the number rejected and up to five rejected outputs are recorded.
- Coordinates stay on the model's 0–99 grid; in pixels, x × width / 100 and
  y × height / 100, as `predict_scanpath.py`.
- Each file's `settings` records the repository commit, the adapter's
  SHA-256, the base model's revision, the package versions, the GPU and CUDA
  version, the quantisation, the sampling parameters and seeds, the run time
  and the peak GPU memory.

A re-run with the same seeds, hardware and package versions reproduces the
scanpaths; `--check` tests this for the first ten draws of every image. A
different GPU, driver or package version can change the draws.

## Testing without a GPU

`--base-model OpenGVLab/InternVL3_5-1B-HF --revision <sha> --no-adapter --count 10 --out <dir>`
runs the same code path unquantised on the CPU with a small base model and
no adapter. It checks the prompt, generation, parsing and file writing only;
its scanpaths mean nothing and are never published.
