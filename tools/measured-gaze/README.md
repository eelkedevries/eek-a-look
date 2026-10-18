# measured-gaze

Adds twelve Zürich street photos to eek-a-look, each with a map of where 48
people actually looked. These are the only **measured** maps on the site; every
other map is a prediction.

## Source and licence

Wilming, N., Onat, S., Ossandón, J. P., Açık, A., Kietzmann, T. C., Kaspar, K.,
Gameiro, R. R., Vormberg, A. & König, P. (2017). An extensive dataset of eye
movements during viewing of complex images. *Scientific Data* 4, 160126.
doi:[10.1038/sdata.2016.126](https://doi.org/10.1038/sdata.2016.126).

Data and photos are **CC0 1.0**. The files come from Zenodo record
[5017807](https://zenodo.org/records/5017807), which mirrors Dryad
doi:[10.5061/dryad.9pf75](https://doi.org/10.5061/dryad.9pf75):

| File | Size | MD5 |
|---|---|---|
| `etdb_v1.0.hdf5` | 33 MB | `473684bb542257e35cb1782a3d098079` |
| `Stimuli_8.zip` (category 8, "Urban": 64 PNGs of 1280 × 960) | 125 MB | `1e87c119c4b96ca192719e3acd8866dc` |

The fixations come from the study `Baseline` (Onat, Açık, Schumann & König,
2014, *PLoS ONE*): free viewing for 6 s, EyeLink II, 45.6 px per degree, the
photo shown full-screen at (0, 0). Each observer–trial was recorded from one
eye only.

The photos used are the street scenes among the 64, by file number: 18, 19,
22, 23, 24, 27, 30, 33, 42, 46, 51 and 53 (ids `zurich-<n>`). The dataset does
not name the places; the captions name one only where the photo shows it
beyond doubt (23 is Paradeplatz, 30 the main station).

## Recipe

For each photo:

1. Take the `Baseline` rows with `category == 8`, `filenumber == n` and
   `fix > 1`: the first fixation of each trial starts on the central fixation
   cross, so it is dropped.
2. Convert `x` and `y` from 1-based to 0-based pixels and drop points outside
   the image.
3. Add one count per fixation (not weighted by duration) to a 960 × 1280
   array.
4. Blur with a Gaussian of σ = 1° = 45.6 px (`scipy.ndimage.gaussian_filter`,
   `mode='constant'`, so nothing leaks in from outside the image).
5. Sum into 10 × 10 px cells, which gives the shared 128 × 96 grid exactly,
   and normalise to sum 1.

The map is written to `public/precomputed/measured/zurich-<n>.json` in the
`PrecomputedMap` format (model `'measured'`, uint16 base64, as the DeepGaze
maps). The photo is copied to `.cache/photos/zurich-<n>.png` and prepared by
`scripts/prepare-photos.mjs` (JPEG, metadata stripped, still 1280 × 960, plus
a thumbnail). The photos are added to `public/examples/examples.json` after
the Dutch ones, with the observer and fixation counts under `measured`.

Each of the twelve has 48 observers and 805–929 fixations.

## Commands

Needs [uv](https://docs.astral.sh/uv/) and the repository's Node packages
(`npm ci` at the root).

```sh
cd tools/measured-gaze
uv run fetch.py   # downloads both files into .cache/, checks the MD5 sums
uv run build.py   # photos, maps, manifest entries, check overlays
```

`fetch.py` skips files that are already present and valid. `build.py` prints
a table (id, observers, fixations, map sum) and writes a check overlay per
photo to `.cache/check/`: the greyed photo, the map and every fixation as a
dot. The heat should lie on people, vehicles, signs and the end of the street.
