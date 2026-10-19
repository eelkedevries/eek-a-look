# deepgaze-local

Runs the two strongest open gaze-prediction models,
[DeepGaze IIE](https://openaccess.thecvf.com/content/ICCV2021/html/Linardos_DeepGaze_IIE_Calibrated_Prediction_in_and_Out-of-Domain_for_State-of-the-Art_Saliency_ICCV_2021_paper.html)
(Linardos et al., ICCV 2021) and
[DeepGaze MSDB](https://arxiv.org/abs/2505.10169) (Kümmerer, Khanuja and
Bethge, ICCV 2025), on this laptop's GPU. They are too large to run in a
browser.

## Licence position

The [DeepGaze repository](https://github.com/matthias-k/DeepGaze) has no
licence file. Its code is therefore installed from GitHub (pinned commit) into
this tool's environment, and its weights are downloaded into the local caches.
Neither is copied into this repository or published. eek-a-look publishes only
the resulting maps.

## Pre-compute maps for the example photos

```bash
cd tools/deepgaze-local
uv run precompute.py
```

This writes `public/precomputed/<model>/<photo>.json` for every photo in
`public/examples/examples.json` and every edited image in
`public/examples/comparisons.json` (prompt 058): a probability map on the
app's 128-cell grid, stored as little-endian uint16 (scaled to the maximum)
in base64. Re-run it after adding or replacing example photos.

The first run downloads about 2 GB of weights: CLIP RN50x64 from OpenAI,
DINOv2 ViT-B/14 from Meta, ImageNet backbones from PyTorch and DeepGaze's own
read-out weights from its GitHub releases. Later runs take about 20 seconds.
On an RTX 4070 Laptop GPU, IIE takes about 0.4 s and MSDB about 1 s per
photo, using at most 3.1 GB of GPU memory.

To add maps for new photos only, without recomputing the existing ones:

```bash
uv run precompute.py --only-missing
```

A photo is skipped for a model when its map for that model already exists.
The script uses the GPU when CUDA is available and the CPU otherwise. On the
CPU (a 22-thread laptop, run with `CUDA_VISIBLE_DEVICES=` to hide the GPU),
the 12 Zürich photos took 7 min 14 s in all: IIE about 1.8 s and MSDB about
33 s per photo, with a peak of 6.2 GB of RAM.

In a cloud session whose proxy blocks `api.github.com`, `torch.hub` cannot
check the repositories DeepGaze loads and stops with HTTP 403. Cloning
`pytorch/vision` at tag `v0.6.0` into `~/.cache/torch/hub/pytorch_vision_v0.6.0`
and `facebookresearch/dinov2` at `6a62615` into
`~/.cache/torch/hub/facebookresearch_dinov2_6a62615` (without `.git`) lets it
use those copies instead. On 19 October 2026 the four photos of Andersson et
al. (2017) took 7 min 34 s in all on a 4-core cloud CPU, including the
downloads: IIE about 6 s and MSDB about 86 s per photo.

The printed table gives each model's time per photo and the correlation
between the two models. For photos with a measured eye-tracking map
(`tools/measured-gaze/`), a second table gives the Pearson r of each model
with the measured map, and the mean per model. The run fails if the DeepGaze
maps average more than 1/24 MB each (prompt 013's budget of 1 MB for 24 maps).

## Settings

These match the MIT300 benchmark entries quoted on the site:

- photos are resized to 1024 px on the long side (MIT1003's scale);
- DeepGaze's MIT1003 centre-bias template (release v1.0.0) is used;
- MSDB uses 35 pixels per degree and its MIT1003 parameters.
