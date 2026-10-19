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

Classic salience and UNISAL run in your browser on any photo.
DeepGaze IIE and DeepGaze MSDB, the strongest models, were computed in advance
on a laptop GPU, so they cover the example photos only; for your own photo the
page shows UNISAL in their place and says so.

## Read the results

Choose a view above the photo; the inspector on the right changes with it.

- **Single map:** one layer on the photo. On the Zürich photos it opens on
  **Measured gaze**, with the fixations as dots; elsewhere on the best model.
  Choose another layer in the inspector; **Heatmap strength** fades it in and
  out. The warmer an area, the more likely people are to look there.
- **Side by side:** the photo and all layers together. Move the pointer over
  any map to mark the same spot in all of them. Each map shows its match (r)
  with the reference: measured gaze where the photo has it, otherwise the best
  available model. **Contrast** under a map opens it in the Contrast view.
- **Contrast:** one map minus another. By default, measured gaze (on the
  Zürich photos) or the next-best model against the best available model;
  choose any two maps in the inspector, swap them, or reset to the best model.
  Orange marks where the first map expects more looking, blue where the second
  does. Both maps are shown underneath.
- **Display settings:** directly below the view buttons and above the
  image, a section you can fold away with **Heatmap strength** and, on the
  Zürich photos, the fixation settings below.
- **Show fixations (raw data):** on the Zürich photos, this checkbox in the
  display settings (on by default) draws every fixation the
  measured map was built from as a semi-transparent cyan dot over the
  **Measured gaze** map, in all three views above. Tick **Also over the
  model maps** beside it to draw the same dots over the models' maps, so you
  can see where people looked against each prediction; those maps then say
  "with measured fixations". The **Fixation points** slider beside
  the heatmap strength sets how strongly they are drawn.
- **Qualities:** for every example photo (study images are tagged as a design
  rendering or a 360° panorama), three design principles
  (rhythm and variety, an active ground floor, tactile materials) measured
  from the photo (the simulated AI panel also answers what it sees, rated by a
  fixed rule), all three at once: the evidence drawn on it (rhythm in
  solid lines, ground floor dashed, materials dotted; point at a legend item
  to fill its region), one card per principle with the outcome (the
  ground floor also with a frontage grade A–E, adapted from the Urban Design
  Compendium and estimated from the photo), the
  definitions, how a
  simulated AI panel and UP-CLIP judged the same photo, and how much
  attention the evidence regions receive. At the end, **Descriptions and
  photos** shows which short descriptions UP-CLIP matches with the photo,
  and which example photos it matches with a description you choose. None
  of it is an expert judgement.
- **Areas:** automatic areas for the example photos, with how much of each
  map's attention falls inside them relative to their size.
- **Match with …** (inspector): each layer's correlation with the reference,
  highest first (0 = unrelated, 1 = same pattern).
- **How much the models agree** (below the workspace): a table of
  correlations between each pair of maps for this photo (n/a where a model
  does not cover the photo).

## Example: three design comparisons

**Example** in the top bar opens three illustrations: a coloured entrance
surround, low planting along a building base, and opaque against transparent
ground-floor windows, each on a Zürich photo edited with AI image editing.
Choose one to see its question, background, conditions and two possible
outcomes. Images A and B and the difference between them appear side by side
for the model you choose, with colour bars; A and B share one colour scale.
"Highlight manipulated area" outlines the area that is measured. For the
chosen model, the predicted attention in that area is summed into one value
for A and one for B, and the contrast B − A shows the direction of the effect.
The table lists the same numbers for every model. All maps here are
predictions; measured gaze for the untouched originals is in the workspace.
The links under the table open either image there.

The About section explains the models, their scores on a standard lab test,
and what the maps cannot tell you.

## For raters

If you were asked to rate the photos, open
<https://eelkedevries.com/eek-a-look/rate.html>. Enter your initials, then
judge each photo on the three design principles: present, ambiguous or
absent, in your own judgement ("What to look at" explains the principles).
Your answers stay in your browser, so you can stop and continue later. When
you are done, press **Download ratings (CSV)** and send the file back. The
page shows none of the site's results, so they cannot steer you.

## The first UNISAL map takes a moment

The neural network and its runtime (about 10 MB together) are downloaded
the first time they are needed. After that, each photo takes well under a
second on a typical laptop.
