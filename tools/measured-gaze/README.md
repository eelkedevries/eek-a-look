# measured-gaze

Adds photos with **measured** eye tracking to eek-a-look, each with a map of
where people actually looked: twelve Zürich street photos from Wilming et al.
(2017), 48 people each, and four photos from Andersson et al. (2017), two to
five people each ([below](#andersson-et-al-2017)). These are the only measured
maps on the site; every other map is a prediction.

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
maps). The fixations from steps 1–2 are also written, as 0-based pixel
pairs, to `public/precomputed/measured/zurich-<n>.points.json`
(`{photo, width, height, observers, points: [[x, y], …]}`); the site can show
them as points over the "Measured gaze" layer. The photo is copied to `.cache/photos/zurich-<n>.png` and prepared by
`scripts/prepare-photos.mjs` (JPEG, metadata stripped, still 1280 × 960, plus
a thumbnail). The photos are added to `public/examples/examples.json` after
the Dutch ones, with the observer and fixation counts under `measured`.

Each of the twelve has 48 observers and 805–929 fixations.

## Fixations per participant

Prompt 077 keeps the same fixations per participant and in their order, for
the twelve Zürich photos: `build_scanpaths.py` writes
`public/precomputed/measured/zurich-<n>.scanpaths.json`
(`{photo, width, height, observers, fields, participants: [{index, fixations: [[fix, x, y, pupil], …]}, …]}`)
and changes no other file.

- **What the source holds per fixation** (`Baseline` group): `SUBJECTINDEX`,
  `trial`, `fix` (the fixation's number in the trial), `x` and `y` (1-based
  pixels), `start` and `end` (ms from image onset), `eye` (1 or 2; one eye per
  trial), `pupil`, `category`, `filenumber` and `dataset_nr`.
- **What is kept** (owner's choice of 25 October 2026): `index`, the
  database's anonymous `SUBJECTINDEX`, nothing else about the person; and
  per fixation `fix` as recorded, `x` and `y` as in the points file (0-based)
  and `pupil` as recorded, in the EyeLink's arbitrary units, written as the
  shortest decimal that reads back as the stored float32. Timing (`start`,
  `end`) and `eye` are not kept.
- **The first fixation.** About half of the trials hold `fix` 1, always on the
  central fixation cross (it starts about 180 ms before the photo appears);
  the other half start at `fix` 2, already away from the centre (median
  4.3°). The rule `fix > 1` of the maps therefore drops exactly the cross
  fixation in both cases, and it is left out here too.
- **Gaps.** Within a trial the database lacks some fixation numbers: 61
  across the twelve photos (1–12 per photo; 5, 3 and 2 on photos 42, 33 and
  53). The order of the kept fixations is unaffected; the numbers show
  where one is missing.
- **Check.** The rows of each photo are grouped by participant in ascending
  order, with `fix` ascending within each, so joining the participants
  reproduces `zurich-<n>.points.json` exactly, in the same order, with the
  same number of observers. The script checks this for every photo and
  writes nothing for a photo that fails.

```sh
uv run build_scanpaths.py   # after fetch.py and build.py
```

| id | People | Fixations | Per person (min–median–max) | Missing numbers |
|---|---|---|---|---|
| `zurich-18` | 48 | 805 | 2–16–25 | 1 |
| `zurich-19` | 48 | 870 | 10–18–26 | 4 |
| `zurich-22` | 48 | 899 | 10–19–25 | 3 |
| `zurich-23` | 48 | 883 | 10–18–24 | 8 |
| `zurich-24` | 48 | 870 | 6–18–25 | 4 |
| `zurich-27` | 48 | 857 | 10–18–24 | 5 |
| `zurich-30` | 48 | 929 | 12–19–26 | 12 |
| `zurich-33` | 48 | 887 | 12–18–25 | 3 |
| `zurich-42` | 48 | 850 | 11–18–25 | 5 |
| `zurich-46` | 48 | 862 | 11–19–24 | 5 |
| `zurich-51` | 48 | 871 | 1–18–26 | 9 |
| `zurich-53` | 48 | 825 | 9–17–24 | 2 |

The site shows them only in the Example section, as one chosen
participant's gaze path over image A (`src/views/example.ts`,
`drawScanpath` in `src/render/fixations.ts`); the pupil size is not shown.

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

## Andersson et al. (2017)

Prompt 069 adds the four photos with recordings from

Andersson, R., Larsson, L., Holmqvist, K., Stridh, M. & Nyström, M. (2017).
One algorithm to rule them all? An evaluation and discussion of ten eye
movement event-detection algorithms. *Behavior Research Methods* 49(2),
616–637. doi:[10.3758/s13428-016-0738-9](https://doi.org/10.3758/s13428-016-0738-9).

### Source and licence

The authors' repository
[richardandersson/EyeMovementDetectorEvaluation](https://github.com/richardandersson/EyeMovementDetectorEvaluation)
states (`README.docx`): "The software, data, and stimuli were released under
the GNU General Public License v. 3 … Some of the stimuli have been omitted due
to copyright issues", and carries the GPL v3 text as `LICENSE`. The photos and
the labelled recordings may therefore be redistributed and changed, provided
that copies keep the licence, changes are marked with a date, and the source
form stays available. On the site this is done by:

- the credit line of each photo (author, licence, the original PNG at a pinned
  commit, and "Converted from PNG to JPEG on 19 October 2026");
- `public/examples/andersson-2017-NOTICE.txt`, written by `build_andersson.py`:
  which files on the site derive from the dataset and how, where the original
  PNGs and recordings are, and the full licence text; the About credits link
  to it;
- this tool, which rebuilds every derived file from the pinned commit.

The individual photographers are not named in the repository; the licence
statement is the authors'. The original PNGs are not mirrored here: the
pinned commit on GitHub is the source named in the notice.

Every file is taken from commit `3e12416ab3fd6254c81811cf03f8e5d67c5d7129`
and checked against its SHA-256 sum in `fetch_andersson.py`: the four photos
(`Stimuli/images/<name>1024x768.png`), the 14 photo recordings of
`annotated_data/data used in the article/img/` as labelled by coders MN and
RA, the corrected file `fix_by_Zemblys2018/UH29_img_Europe_labelled_FIX_MN.mat`
and `LICENSE`.

### What was recorded

Students at Lund University viewed the photos freely (the paper: "The
instructions were to freely view the images") on a 1024 × 768 screen of
0.38 × 0.30 m at 0.67 m, with an SMI Hi-Speed 1250 and a chin and forehead
rest. The files hold the right eye only, at 500 Hz (200 Hz in three files),
and span 9.9–10.0 s each. Two experts labelled every sample by hand: 1
fixation, 2 saccade, 3 post-saccadic oscillation, 4 smooth pursuit, 5 blink,
6 other. Each file is one person viewing one photo.

Photos used (the fifth photo in the repository, `Blad`, has no recordings;
videos and moving dots are not static and are left out):

| id | Stimulus | Recordings (participant codes) |
|---|---|---|
| `andersson-rome` | `Rome` | UH21, UL43 |
| `andersson-europe` | `Europe` | TH34, UH29, UH47, UL23 |
| `andersson-vy` | `vy` | TH34, UH27, UH33 |
| `andersson-konijntjes` | `konijntjes` | TL20, TL28, UL31, UL39, UL47 |

Only the Colosseum is named as a place (Rome); the repository names no
places, so the other three have no `city`.

### Recipe

For each photo:

1. Take coder MN's labels of the recordings above, with Zemblys et al.'s
   (2018) correction of `UH29_img_Europe`, as the repository advises for "the
   best possible labelled input". MN was chosen over RA because, in the
   paper's confusion analysis of the image data, RA "under-classifies samples
   as fixations" compared with MN and labels them as smooth pursuit instead;
   a still photo has no moving target to pursue (this project's reasoning,
   not the paper's). The two coders disagree on 7% of the image samples.
   RA's labels serve as a check.
2. A fixation is a run of consecutive samples labelled 1. Its position is the
   mean of its samples that have gaze (rows with both coordinates 0, or with
   timestamp 0, are left out: one file ends with two such rows).
3. Drop the first fixation of each recording: every viewing starts at the
   centre of the screen (13 of the 14 first fixations lie within 2° of it;
   the 14th is off the screen).
4. Screen pixels are photo pixels: the photo filled the 1024 × 768 screen.
   Take the floor of each position as the 0-based pixel and drop fixations
   outside the photo (one, on `andersson-europe`).
5. Add one count per fixation, not weighted by duration, to a 768 × 1024
   array and blur it with a Gaussian of 1° (`scipy.ndimage.gaussian_filter`,
   `mode='constant'`). From the recorded geometry, as in the authors'
   `pixels2degrees.m`, 1° is 31.5 px across and 29.9 px down (the pixels are
   not square), so σ = (29.9, 31.5) px.
6. Sum into 8 × 8 px cells, which gives the shared 128 × 96 grid exactly, and
   normalise to sum 1.

The map and the points are written in the same formats as the Zürich ones
(`public/precomputed/measured/<id>.json` and `<id>.points.json`). The photos
are prepared by `scripts/prepare-photos.mjs` (JPEG, metadata stripped, still
1024 × 768, plus a thumbnail) and added to `public/examples/examples.json` in
the group "Andersson et al. (2017)", after the Zürich photos.

| id | People | Fixations | Outside the photo | Fixations from RA's labels | r, MN map with RA map |
|---|---|---|---|---|---|
| `andersson-rome` | 2 | 64 | 0 | 64 | 0.995 |
| `andersson-europe` | 4 | 116 | 1 | 118 | 0.981 |
| `andersson-vy` | 3 | 65 | 0 | 63 | 0.992 |
| `andersson-konijntjes` | 5 | 144 | 0 | 132 | 0.995 |

With two to five people the maps are much rougher than the Zürich ones, and
any model's match with them is less certain.

### Commands

```sh
cd tools/measured-gaze
uv run fetch_andersson.py   # 33 files into .cache/andersson/, SHA-256 checked
uv run build_andersson.py   # photos, maps, points, manifest entries, notice, check overlays
```

`build_andersson.py` prints the table above and writes a check overlay per
photo to `.cache/andersson/check/`: the greyed photo, the map, MN's fixations
as cyan dots and RA's as small magenta ones. The fixations lie on the
rabbits' eyes, the horse and the road sign, the kiosk and the crowd before
the Colosseum, and the lettering and planting of the façade, with no visible
offset.

### Validation (19 October 2026)

- **Screen and photo.** Every recording reports a 1024 × 768 screen, the size
  of every photo, so the photo filled the screen and no offset applies.
- **Start position.** 13 of the 14 first fixations lie within 2° of the screen
  centre (median 18 px), as expected for viewings that start at the centre.
- **Content.** In the check overlays the fixations land on the rabbits' eyes
  and noses, on the horse and the road sign, on the kiosk and people before
  the Colosseum, and on the lettering and flower boxes of the façade.
- **Shift test** (not part of the tool): each map was rebuilt with every
  fixation moved by up to ±128 px in steps of 16 px and correlated with
  DeepGaze MSDB's map. The best shift was (0, 0) for the rabbits and
  (0, −16) px for the Colosseum and the country path (r gains 0.016 and
  0.044); 16 px is about 0.5°, near the 0.40° calibration offset the paper
  reports. The façade peaked at (−48, −16) px with r 0.43 → 0.49; with four
  people and fixations spread over many flower boxes this is weak evidence.
  As a baseline, the same test (shifts of half a degree) on the twelve Zürich
  photos, whose coordinates were checked in prompt 018, found the best shift
  at 0° on six and at 0.5° on six (three upwards, one downwards, two to the
  left): a best shift of 0.5° is within the test's noise against this model,
  not by itself a sign of misplaced fixations.
- **Own photo against the others.** Each measured map matches MSDB's map of
  its own photo (r 0.43–0.80) better than those of the other three
  (−0.08 to 0.21), except that the rabbits' map also matches the façade
  prediction at 0.51 (both are spread over the middle of the image).

Model match on these photos (Pearson r with the measured map, from
`tools/deepgaze-local/precompute.py`; the page shows the same values):

| id | DeepGaze IIE | DeepGaze MSDB |
|---|---|---|
| `andersson-rome` | 0.80 | 0.80 |
| `andersson-europe` | 0.35 | 0.43 |
| `andersson-vy` | 0.74 | 0.76 |
| `andersson-konijntjes` | 0.79 | 0.73 |

Then, as for any new example photo: `tools/deepgaze-local/precompute.py
--only-missing` for the DeepGaze maps, `tools/areas/build.py --only-missing`
for the areas and `tools/qualities/build.py --materials --only-missing` for
the materials measure (see the specification, *Measured gaze*).
