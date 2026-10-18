# Live DeepGaze on your laptop

On the public site, DeepGaze IIE and DeepGaze MSDB cover the example photos
only, because their maps were computed in advance. On a laptop with an NVIDIA
GPU you can run them live on any photo, including your own, for example in a
demo.

## Start

```bash
cd ~/Documents/portfolio/eek-a-look
npm run local
```

Then open <http://localhost:4173/eek-a-look/>. Press Ctrl+C in the terminal to
stop everything.

`npm run local` builds the site, starts the DeepGaze helper on your GPU,
waits until both models are loaded, and serves the site. The page notices the
helper, and the two DeepGaze models then read "running on this computer's
GPU".

## What to expect

- **First run:** about 2 GB of model weights are downloaded once (CLIP,
  DINOv2, ImageNet backbones and DeepGaze's own weights), which takes a few
  minutes. Later starts take about 15 seconds.
- **Speed:** on the RTX 4070 Laptop GPU, about 0.4 s (IIE) and 1 s (MSDB) per
  photo, using at most about 3 GB of GPU memory.
- **Privacy:** your photo goes from the browser to the helper on the same
  laptop, and nowhere else. The helper only accepts connections from this
  computer.
- **The public site is unaffected:** it never contacts the helper.

## Requirements

Node.js 22 and [uv](https://docs.astral.sh/uv/). Without an NVIDIA GPU the
helper falls back to the CPU, which works but takes many seconds per photo.
Details of the models and settings are in `tools/deepgaze-local/README.md`.
