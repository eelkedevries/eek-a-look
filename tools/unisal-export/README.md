# unisal-export

Converts the pretrained [UNISAL](https://github.com/rdroste/unisal) saliency
model (Droste, Jiao & Noble, ECCV 2020; Apache-2.0) to the ONNX file that
eek-a-look runs in the browser, and checks the conversion.

## Reproduce

```bash
cd tools/unisal-export
uv run export.py
```

The script clones UNISAL at a pinned commit into `.cache/` (git-ignored),
loads the weights fine-tuned on MIT1003 eye-tracking data, exports to ONNX,
stores the weights as fp16, and compares ONNX Runtime with the unmodified
PyTorch model on every example photo. It exits non-zero if Pearson r falls
below 0.999 (fp32) or 0.99 (fp16), or if the model exceeds 10 MB.

It writes:

- `public/models/unisal/unisal-mit1003-fp16.onnx`: the model;
- `public/models/unisal/model.json`: inputs, outputs, size rule and the
  learned prior parameters the browser needs;
- `public/models/unisal/LICENSE` and `NOTICE`: UNISAL's licence and attribution;
- `reference/weena-delftse-poort.json`: one normalised output on the shared
  128-cell grid, for checking the browser implementation.

## What differs from UNISAL's own code

Nothing is retrained. UNISAL builds 16 Gaussian prior maps from learned
parameters at the size of its coarsest feature map. Here they are a second
model input, which the browser builds from the same parameters. This lets one
model accept every input size UNISAL uses (multiples of 32, chosen per photo
by aspect ratio).
