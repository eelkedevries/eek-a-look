# comparisons

Data for the Example section (prompt 058): three design comparisons on Zürich
photos, each of image A against image B. The images and their credits are in
`public/examples/comparisons.json`; the visitor-facing text is in
`src/content/comparisons.ts`.

## Steps

The edited images (1448 × 1086 px PNG) were scaled to 1280 × 960 px, the size
of the originals, and prepared with `scripts/prepare-photos.mjs`. At that size
they line up with the originals to within about 3 px. Then:

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
  between A and B, blurred (2 px) and above 15. Greenery and glazing: the mean absolute RGB
  difference between A and B, blurred (4 px) and above 20; greenery takes
  the changed pixels, closed, filled and dilated, and glazing the bounding
  rectangles of the three largest patches. It writes `public/precomputed/comparisons/<example>.json` (masks
  as run lengths at 640 × 480, as in the area files), check overlays in
  `.cache/`, and each layer's share of attention per region.

## Run of 19 October 2026

On a 4-core CPU without a GPU. DeepGaze took 178 s (IIE) and 192 s (MSDB) for
the four images; OneFormer 6–82 s per image. Checks: recomputing zurich-42
on this CPU reproduced the committed maps (DeepGaze IIE and MSDB r = 1.0) and
its street categories (100% of pixels). SAM 3 is gated and was not available,
so the edited images have no façade elements yet.

Share of attention in the manipulated area, % (entrance as of prompt 071):

| Comparison | Layer | A | B |
|---|---|---|---|
| Entrance, door and recoloured block (3.4% of the image) | Measured (A only) | 8.32 | – |
| | Classic salience | 3.43 | 4.08 |
| | UNISAL | 3.92 | 6.63 |
| | DeepGaze IIE | 5.81 | 9.30 |
| | DeepGaze MSDB | 6.51 | 10.88 |
| Greenery, added planting (4.3%) | Measured (A only) | 2.71 | – |
| | Classic salience | 5.19 | 6.16 |
| | UNISAL | 3.44 | 1.75 |
| | DeepGaze IIE | 2.59 | 1.61 |
| | DeepGaze MSDB | 1.27 | 0.86 |
| Glazing, three window bays (7.1%) | Classic salience | 6.88 | 8.16 |
| | UNISAL | 7.30 | 10.95 |
| | DeepGaze IIE | 6.66 | 8.55 |
| | DeepGaze MSDB | 6.65 | 8.61 |

On the untouched zurich-53, measured gaze puts 5.24% of attention on the
three window bays (DeepGaze MSDB predicts 8.44%).

Known limits: the edits also changed details elsewhere (sign lettering,
textures), which the maps respond to as well. On the greenery image the
planting hides the façade bases, so the ground-floor rule finds no ground
floor there.
