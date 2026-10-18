# Installation

eek-a-look is a website; visitors install nothing. These steps are for
running it locally.

## Prerequisites

- Node.js 22 or later, with npm.
- Only to regenerate the UNISAL model: [uv](https://docs.astral.sh/uv/)
  (see `tools/unisal-export/README.md`). The converted model is committed.

## Install and run

```bash
git clone https://github.com/eelkedevries/eek-a-look.git
cd eek-a-look
npm ci
npm run dev
```

Open `http://localhost:5173/eek-a-look/`.

## Example photos

`scripts/prepare-photos.mjs <source-dir> public/examples` resizes photos,
strips their metadata and writes thumbnails. Add each photo to
`public/examples/examples.json` with its credit; `npm run check` validates the
manifest.
