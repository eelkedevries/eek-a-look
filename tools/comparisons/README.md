# comparisons

Data for the Example section (prompt 058): three design comparisons on Zürich
photos, each of image A against image B. The images and their credits are in
`public/examples/comparisons.json`; the visitor-facing text is in
`src/content/comparisons.ts`.

## Steps

Make the B images (and, for glazing, A) as below, prepare them with
`scripts/prepare-photos.mjs`, then:

```sh
cd tools/deepgaze-local && uv run precompute.py --only-missing   # DeepGaze IIE and MSDB
cd tools/areas && uv run build.py --only-missing                 # categories and ground floor
cd tools/areas && uv run elements.py --apply --only-missing      # SAM 3 façade elements (laptop only)
node tools/comparisons/browser-models.mjs                        # Classic salience and UNISAL
cd tools/comparisons && uv run regions.py                        # changed regions and a summary table
```

Example 1's image B (`zurich-42-entrance-block`, prompt 071) is not an AI
edit: `uv run recolour.py` recolours the rusticated stone block around the
entrance of `zurich-42` in blue-teal by rule (CIELAB lightness kept, so the
stone's texture and shading stay; door, steps, sign and plants cut out), and
writes `.cache/sources/zurich-42-entrance-block.png` for
`node scripts/prepare-photos.mjs tools/comparisons/.cache/sources public/examples`.
Outside the block only JPEG re-encoding noise remains (mean 0.5 of 255
levels). It replaced the first edit, a blue-teal
door frame from the owner's package (1.0% of the image), on the owner's
request for a much larger manipulation.

Examples 2 and 3 (prompt 071b) are AI edits, used only where they change the
photo. `edits/` holds the raw outputs of FLUX.1 Kontext [dev] (Hugging Face
Space `mcp-tools/FLUX.1-Kontext-Dev`, endpoint `/infer`, 28 steps, guidance
2.5), each made from the untouched original; `edits/edits.json` records each
prompt and seed. The Space needs a Hugging Face token (ZeroGPU quota), here
supplied as a network secret for `*.hf.space`. The model returns the photo
regenerated at 1168 × 880 px, about 0.9% narrower in scale and 17 px short
on the right, with small changes everywhere. `uv run composite.py` registers
each output to its original (block matching, a robust affine fit; residuals
at most 1.3 px), mirrors its last columns into the missing strip, finds the
change inside a search box (RGB difference blurred 4 px above 20, closed,
filled, patches under 2,000 px dropped, dilated 6 px) and pastes the edit
there, softened by 3 px, over the original's own pixels. The two glazing
versions share one mask, the union of both. Results: a hedge about 2 m tall
along the base of zurich-33 (17.8% of the image), and the whole ground-floor
frontage of zurich-53 either side of the red door as opaque grey panels or
clear glass with a lit shop interior (21.1%). They replaced the owner's
low planting and three opaque or transparent window bays.

Both Python tools read `comparisons.json` as well as `examples.json`.

- `browser-models.mjs` runs the app's own Classic salience and UNISAL code in
  headless Chromium (Playwright, installed globally; not a project
  dependency) and saves their maps in
  `public/precomputed/comparisons/<model-id>/<image-id>.json`, in the format
  of the DeepGaze maps.
- `regions.py` finds each comparison's manipulated area inside a search box
  set by hand around the described change. Entrance (prompts 067, 071): the
  door and its recoloured surround, i.e. the bounding rectangle of the
  recoloured stone found from the change in blueness (blue minus red)
  between A and B, blurred (2 px) and above 15. Greenery and glazing (prompt 071b): the
  mean absolute RGB difference between A and B, blurred (4 px) and above 20,
  the changed pixels closed, filled and dilated: the hedge, and the frontage
  where the two glazing versions differ. It writes `public/precomputed/comparisons/<example>.json` (masks
  as run lengths at 640 × 480, as in the area files), check overlays in
  `.cache/`, and each layer's share of attention per region.

## Run of 19 October 2026

On a 4-core CPU without a GPU. DeepGaze took 178 s (IIE) and 192 s (MSDB) for
the four images; OneFormer 6–82 s per image. Checks: recomputing zurich-42
on this CPU reproduced the committed maps (DeepGaze IIE and MSDB r = 1.0) and
its street categories (100% of pixels). SAM 3 is gated; the edited images'
façade elements were added later by `elements.py --apply --only-missing` in a
cloud session (prompt 072, `tools/areas/README.md`).

Share of attention in the manipulated area, % (entrance as of prompt 071):

| Comparison | Layer | A | B |
|---|---|---|---|
| Entrance, door and recoloured block (3.4% of the image) | Measured (A only) | 8.32 | – |
| | Classic salience | 3.43 | 4.08 |
| | UNISAL | 3.92 | 6.63 |
| | DeepGaze IIE | 5.81 | 9.30 |
| | DeepGaze MSDB | 6.51 | 10.88 |
| Greenery, added hedge (17.3%; prompt 071b) | Measured (A only) | 9.71 | – |
| | Classic salience | 20.24 | 28.05 |
| | UNISAL | 18.19 | 9.86 |
| | DeepGaze IIE | 14.72 | 7.77 |
| | DeepGaze MSDB | 8.67 | 5.65 |
| Glazing, ground-floor frontage (20.8%; prompt 071b) | Classic salience | 18.05 | 28.12 |
| | UNISAL | 27.91 | 61.03 |
| | DeepGaze IIE | 21.09 | 63.10 |
| | DeepGaze MSDB | 15.78 | 48.67 |

On the untouched zurich-53, measured gaze puts 30.58% of attention on the
ground-floor frontage (DeepGaze MSDB predicts 34.84%).

Known limits: outside the edited areas all images keep the originals' pixels
(JPEG re-encoding noise only, mean 0.3–0.5 of 255 levels), but inside them
the AI edits of examples 2 and 3 may contain small unintended details, and
the transparent frontage adds a colourful interior, so transparency and
visual detail change together. On the greenery image the hedge hides the
façade bases, so the ground-floor rule may find no ground floor there.
