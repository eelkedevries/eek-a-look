# Usage

Open <https://eelkedevries.com/eek-a-look/>.

## Choose a photo

- Pick one of the twelve example photos (Zuidas, Weena, Wilhelminapier,
  Beatrixkwartier), or
- press **Use your own photo** and choose a JPEG or PNG. It is processed on
  your device and never uploaded. Large photos are scaled down to 1600 px on
  the long side.

## The models

Centre bias, classic salience and UNISAL run in your browser on any photo.
DeepGaze IIE and DeepGaze MSDB, the strongest models, were computed in advance
on a laptop GPU, so they cover the example photos only; for your own photo the
page shows UNISAL in their place and says so.

## Read the results

- **Overlay:** one model's heatmap on the photo. Choose the model with the
  buttons above the photo; the slider fades the heatmap in and out. The
  warmer and redder an area, the more likely people are to look there.
- **Side by side:** the photo and all models together.
- **What AI adds:** the best available neural model minus centre bias. Orange
  marks where it expects more looking than "people look at the middle" alone;
  blue marks where it expects less.
- **How much the models agree:** a table of correlations between each pair of
  maps for this photo (0 = unrelated, 1 = same pattern; n/a where a model does
  not cover the photo).

The About section explains the models, their scores on a standard lab test,
and what the maps cannot tell you.

## The first UNISAL map takes a moment

The neural network and its runtime (about 10 MB together) are downloaded
the first time they are needed. After that, each photo takes well under a
second on a typical laptop.
