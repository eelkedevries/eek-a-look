# Overview

*eek-a-look*: non-binding orientation.

## What it is

Predicted gaze heatmaps for streetscape photos: open saliency models next to
simple baselines, running entirely in your browser.

## Why

Eye-tracking studies of Dutch high-rise streetscapes, such as those by the AUAS
(HvA) *Sensing Streetscapes* and *Building for Well-being* projects, often
summarise gaze with aggregated heatmaps, or use commercial gaze-prediction
software without validation. eek-a-look puts open models next to two simple
baselines, so it is visible how much each model adds, and states plainly that
the maps are predictions.

## Stack

Vite + TypeScript; onnxruntime-web for the neural model; a small `uv` Python
script for the one-off model conversion.

## Scope and platform

- **Audience:** the general public.
- **Platforms:** current desktop and mobile browsers. WebGPU is used where
  available, with WASM elsewhere.
- **v1 scope:** three models, twelve example photos, upload, and four
  comparison views.
- **Later:** drawing areas of interest; large models (DeepGaze) via Hugging
  Face.

The binding scope is in `../primary_authoritative/specification.md`.

## Background references

- MIT/Tübingen Saliency Benchmark: <https://saliency.tuebingen.ai/results.html>
- UNISAL: <https://github.com/rdroste/unisal>; community LiteRT conversion:
  <https://huggingface.co/litert-community/UniSal-Saliency-LiteRT>
- DeepGaze (IIE, III, MSDB): <https://github.com/matthias-k/DeepGaze>. There was
  no licence file on 2026-10-18.
- MSI-Net (MIT licence, TF.js demo): <https://github.com/alexanderkroner/saliency>
- Clarke and Tatler (2014), centre-bias baseline:
  <https://doi.org/10.1016/j.visres.2014.06.016>
- Place Pulse-Gaze (ETH Zurich preprint, May 2026):
  <https://arxiv.org/abs/2605.00764>. Not used; noted for context.
