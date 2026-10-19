# Usage

Open <https://eelkedevries.com/eek-a-look/>.

## Choose a photo

The library on the left lists the twelve Dutch example photos (Zuidas, Weena,
Wilhelminapier, Beatrixkwartier) and twelve Zürich photos; a blue dot marks
the Zürich photos, which have measured eye tracking. Search by street or
place, or show only the photos with measured gaze or the Dutch high-rise
photos. On a phone the library is one row that scrolls sideways.

Or press **Use your own photo** at the top and choose a JPEG or PNG. It is
processed on your device and never uploaded. Large photos are scaled down to
1600 px on the long side.

## The models

Centre bias, classic salience and UNISAL run in your browser on any photo.
DeepGaze IIE and DeepGaze MSDB, the strongest models, were computed in advance
on a laptop GPU, so they cover the example photos only; for your own photo the
page shows UNISAL in their place and says so.

## Read the results

Choose a view above the photo; the inspector on the right changes with it.

- **Single map:** one layer on the photo. Choose the layer in the inspector;
  **Heatmap strength** fades it in and out. The warmer an area, the more
  likely people are to look there.
- **Side by side:** the photo and all layers together. Move the pointer over
  any map to mark the same spot in all of them. Each map shows its match (r)
  with the reference: measured gaze where the photo has it, otherwise the best
  available model. **Contrast** under a map opens it in the Contrast view.
- **Contrast:** one map minus another. By default, measured gaze (on the
  Zürich photos) or the next-best model against the best available model;
  choose any two maps in the inspector, swap them, or reset to the best model.
  Orange marks where the first map expects more looking, blue where the second
  does. Both maps are shown underneath.
- **Areas:** automatic areas for the example photos, with how much of each
  map's attention falls inside them relative to their size.
- **Match with …** (inspector): each layer's correlation with the reference,
  highest first (0 = unrelated, 1 = same pattern).
- **How much the models agree** (below the workspace): a table of
  correlations between each pair of maps for this photo (n/a where a model
  does not cover the photo).

The About section explains the models, their scores on a standard lab test,
and what the maps cannot tell you.

## The first UNISAL map takes a moment

The neural network and its runtime (about 10 MB together) are downloaded
the first time they are needed. After that, each photo takes well under a
second on a typical laptop.
