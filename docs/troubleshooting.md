# Troubleshooting

## UNISAL stays on "Downloading the model" or "Starting the model"

The model and its WebAssembly runtime are about 10 MB together. On a slow
connection the first map can take a while; later photos reuse the download.
If it never finishes, reload the page.

## "UNISAL could not run"

UNISAL needs a browser with WebAssembly, Web Workers and OffscreenCanvas:
current Chrome, Edge, Firefox and Safari (16.4 or later). Older browsers still
show classic salience where OffscreenCanvas is available.

UNISAL runs on the processor (CPU), not the graphics card, so it works the
same everywhere. On an older phone a map can take a few seconds.

## My photo does not open

Use a JPEG or PNG under 25 MB. Some browsers cannot read HEIC photos from
iPhones; export the photo as JPEG first.

## Development server

- `npm ci`, then `npm run dev`; the page is at
  `http://localhost:5173/eek-a-look/`.
- `?check=unisal` on the development server compares the browser's UNISAL
  output with the reference saved by `tools/unisal-export` (expect r ≥ 0.98).
