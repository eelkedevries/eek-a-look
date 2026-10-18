# areas

Finds areas in the eek-a-look example photos automatically, so the page can
show which parts of a scene receive attention: nine street categories and the
ground floor (prompt 021). Windows, entrances, balconies and shopfronts are
added by `elements.py` (prompt 023).

These are automatic areas. They are not an expert judgement, and a share of
pixels is not a share of what people perceive.

## Licences

- OneFormer ADE20K Swin-L, `shi-labs/oneformer_ade20k_swin_large` (MIT), at a
  pinned revision. The weights download into the local Hugging Face cache and
  are never published; only the masks are.
- ADE20K, the training data behind OneFormer: images for non-commercial
  research and education, annotations BSD-3.

Sources: `docs-dev/reference/secondary_background/areas_sources.md`.

## Recipe

1. **Street categories.** OneFormer (task "semantic") labels each pixel with
   one of the 150 ADE20K classes, and `common.CATEGORIES` groups them:
   façade, sky, greenery, street surface, people, vehicles, signage, street
   furniture and other. Every pixel belongs to exactly one category. Masks
   are made at the photo's size scaled to 640 px on the long side.
2. **Horizon** (`groundfloor.horizon_row`):
   - line segments (OpenCV LSD) at least 3% of the image width long, on
     façade pixels, at 2–75° from horizontal (receding horizontal edges);
   - RANSAC finds up to two vanishing points, weighted by segment length, with
     inliers within 1.5°. Assuming no roll, they lie on the horizon. The
     horizon row is their inlier-weighted mean;
   - with fewer than 15 supporting segments, or a row outside the middle 80%,
     the middle row is used instead (`assumed-level`).
3. **Ground floor** (`groundfloor.ground_floor`), with camera height
   *c* = 1.6 m and storey height *H* = 4.0 m:
   - in each column, the base *y<sub>0</sub>* is the lowest façade pixel, if
     the pixel below it is street surface;
   - otherwise (a person, vehicle, furniture, sign, greenery, anything else or
     the image edge below it) the base is unknown. Unknown bases are
     interpolated linearly from the known ones in the same run of façade
     columns. A run with no known base gets no ground floor;
   - columns with the base at or above the horizon are skipped;
   - the ground floor is the façade pixels from *y<sub>0</sub>* up to
     *y<sub>h</sub> − (H − c)/c · (y<sub>0</sub> − y<sub>h</sub>)*: the 4 m
     line on a vertical façade, for a level camera at eye height (Hoiem,
     Efros & Hebert 2008).

Known limits:
- On photos taken looking up at towers, no horizon may be found. The middle
  row then sits too high, so the ground floor comes out too tall.
- Where every façade base is hidden (a tram, a shelter, crowds), no ground
  floor is found.
- `build.py` prints a *head offset*: the median top row of standing people
  minus the horizon. With an eye-height camera it should be close to 0, so a
  large offset flags a wrong horizon.

## Output

`public/precomputed/areas/<photo-id>.json`, the `AreaFile` of the
specification. Masks are row-major run lengths that start outside the area.
`build.py` checks every file after writing it:
- the run lengths add up;
- the categories cover each pixel once;
- the ground floor lies inside the façade;
- the file is at most 150 kB.

## Commands

```sh
cd tools/areas
uv run build.py   # areas for all example photos, overlays in .cache/check/
```

The first run downloads OneFormer (about 0.9 GB). On the RTX 4070 a photo
takes about 0.5 s, with a peak of 2 GB of GPU memory.

## Validation (prompt 022)

```sh
uv run fetch_validation.py   # eTRIMS (78 MB) and CMP Facade base (36.5 MB), SHA-256 checked
uv run validate.py --all     # writes public/precomputed/areas/validation.json and
                             # docs-dev/reference/secondary_background/areas_validation.md
```

- **Street categories** are scored against the human labels of eTRIMS (60
  street-level photos) and the CMP Facade base set (378 rectified façades):
  IoU per category, at the mask size.
- **The ground floor** is tested with eTRIMS's human-labelled doors: what
  share of door pixels and door instances falls inside it, also for camera
  heights 1.5–1.7 m and storey heights 3.5–5.0 m.
- **Attention ÷ size** is reported per area with masks eroded and dilated by
  1°, and compared with measured gaze on the Zürich photos.

The datasets stay in `.cache/` and are never published: eTRIMS is for
research use (cite Korč & Förstner 2009); CMP Facade is CC BY-SA (cite
Tyleček & Šára 2013).

### Scoring your own annotations

Any folder of PNG label masks can be scored, for example areas drawn by an
expert panel:

```sh
uv run validate.py --labels path/to/labels --images path/to/photos --mapping my-mapping.json
```

A label PNG has the same name as its photo and holds one class index per
pixel. The mapping file says which classes count as which category (see
`mappings/etrims.json`):
- `classes`: the class names, for reference;
- `ignore`: unlabelled indices;
- `categories`: the category ids with their class indices;
- optionally `doors`: the door index, for the ground-floor check.
