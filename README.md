# eek-a-look

*Where are people likely to look in a street? Predicted gaze heatmaps for
streetscape photos, running entirely in your browser.*

**Status:** in development. It will be live at
<https://eelkedevries.com/eek-a-look/>.

## What it does

Choose an example photo of a Dutch high-rise street, or upload your own. The
page shows three predictions of where people would look, side by side:

- **Centre bias:** people tend to look at the middle of a picture.
- **Classic salience:** spots that stand out in brightness, colour or edge
  direction (after Itti, Koch and Niebur, 1998).
- **UNISAL:** a small neural network trained on eye-tracking data (Droste,
  Jiao and Noble, 2020).

These are **predictions, not measured gaze**. The models were trained and
tested on lab data, not on Dutch street photos.

## Privacy

Photos are processed on your own device and are never uploaded. The page uses
no analytics and no cookies.

## Development

Vite + TypeScript, built as a static site. The development workflow and plan
are in [`docs-dev/`](docs-dev/); start with [`docs-dev/plan.md`](docs-dev/plan.md).

Running locally:

```bash
npm ci          # install exact dependencies from the lockfile
npm run dev     # development server at http://localhost:5173/eek-a-look/
npm run check   # type-check, build and safety checks
```
