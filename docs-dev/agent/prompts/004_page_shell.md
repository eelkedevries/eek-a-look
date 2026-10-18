# Task: Page shell, site look and photo upload

## Goal

Build the page layout in the eelkedevries.com look, with self-hosted fonts, an
honest header, an image stage and local-only photo upload.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

`specification.md`: *Architecture* (fonts, no third-party requests), *Domain
rules* (Privacy, Images) and *Naming and voice* (tokens, voice).

## Required changes

1. Self-host the fonts with `@fontsource/lexend` (300, 400, 600),
   `@fontsource/spectral` (400, 500) and `@fontsource/jetbrains-mono` (400).
   Import only these weights.
2. Define CSS custom properties for the colour tokens in the spec. Layout:
   mobile-first, content width up to about 1200 px, 16 px side gutter, no
   horizontal scroll at 360 px.
3. Page structure, top to bottom:
   - header: "eek-a-look"; the tagline "Where are people likely to look in a
     street?"; the notice "These maps are predictions, not measured gaze.";
   - photo picker area: an empty container for prompt 005, plus a
     "Use your own photo" button;
   - image stage on neutral dark grey;
   - views area: a placeholder;
   - About: a placeholder;
   - footer: "Photos stay on your device. No analytics, no cookies." and a link
     to eelkedevries.com.
4. Upload:
   - use `<input type="file" accept="image/*">` (no `capture` attribute);
   - decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`;
   - downscale to at most 1600 px on the long side;
   - show the photo on the stage;
   - reject non-images and files over 25 MB with a friendly message.
   No network request may carry image data.
5. Add a small app-state module holding the current image (`ImageBitmap`,
   width, height, source `'example' | 'upload'`) and notifying listeners when it
   changes.
6. Set `<title>eek-a-look</title>`, a meta description, `theme-color` and a
   simple SVG favicon.

## Do not implement

Do not implement:
- example photos (005), models or heatmaps (006 onwards);
- About text (011);
- a UI framework, router, or camera capture.

## Acceptance criteria

The task is complete when:
- the page reads as part of eelkedevries.com: same dark palette and fonts;
- uploading a JPEG or PNG (including a rotated phone photo) shows it upright on
  the stage;
- the DevTools network panel shows only same-origin requests, and none after an
  upload;
- the upload button can be used by keyboard and has a visible focus state;
- `npm run check` passes.

## Checks

`npm run check`; manual test in Chrome and Firefox, at desktop and 360 px width.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
