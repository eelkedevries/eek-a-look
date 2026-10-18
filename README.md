# eek-a-look

*Where are people likely to look in a street? Predicted gaze heatmaps for
streetscape photos, running entirely in your browser.*

**Live:** <https://eelkedevries.com/eek-a-look/>

## What it does

Choose an example photo of a Dutch high-rise street, or upload your own. The
page shows up to five predictions of where people would look:

- **Centre bias:** people tend to look at the middle of a picture (Clarke and
  Tatler, 2014).
- **Classic salience:** spots that stand out in brightness, colour or edge
  direction (after Itti, Koch and Niebur, 1998).
- **UNISAL:** a small neural network trained on eye- and mouse-tracking data
  (Droste, Jiao and Noble, 2020).
- **DeepGaze IIE** and **DeepGaze MSDB:** the strongest open models (Linardos
  et al., 2021; Kümmerer, Khanuja and Bethge, 2025). They are too large for a
  browser, so their maps were computed in advance on a laptop GPU and cover
  the example photos only.

You can view them as an overlay, side by side, as "What AI adds" (the best
neural model minus centre bias), and as agreement scores between the models.

These are **predictions, not measured gaze**. The models were trained and
tested on lab data, not on Dutch street photos.

## Privacy

Photos are processed on your own device and are never uploaded. The page uses
no analytics and no cookies, and sends no requests to other sites.

## Development

Vite + TypeScript, built as a static site; UNISAL runs with ONNX Runtime Web.
User documentation is in [`docs/`](docs/), and the development workflow and plan
are in [`docs-dev/`](docs-dev/) (start with [`docs-dev/plan.md`](docs-dev/plan.md)).

```bash
npm ci          # install exact dependencies from the lockfile
npm run dev     # development server at http://localhost:5173/eek-a-look/
npm run check   # type-check, build and safety checks
npm run deploy  # publish what is on GitHub (see docs/deployment.md)
```
