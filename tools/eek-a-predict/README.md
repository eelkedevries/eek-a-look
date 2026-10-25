# eek-a-predict figures

Renders the heatmap and contrast figures of the eek-a-predict page
(`eek-a-predict/img/` in the eelkedevries.com repository) with this site's
own drawing code (`src/render/heatmap.ts`), so the two pages show the same
colour scales (prompt 079).

```sh
npm ci
node tools/eek-a-predict/render.mjs ../eelkedevries.com/eek-a-predict/img
```

It starts the Vite dev server, opens `harness.html` in Playwright's
Chromium (Playwright must be installed and resolvable from this folder) and
writes fifteen 1024 × 768 JPEGs, five per example:

| File | Contents |
|---|---|
| `<example>-measured.jpg` | measured gaze with its fixations (cyan, at the site's default 65 % opacity) |
| `<example>-predicted-original.jpg` | DeepGaze MSDB on the original |
| `<example>-predicted-manipulated.jpg` | DeepGaze MSDB on the edited image |
| `<example>-contrast-measured-predicted.jpg` | predicted minus measured: orange where the model predicts more, blue where people looked more |
| `<example>-contrast-manipulated-original.jpg` | edited minus original, both predicted |

The three heatmaps of an example share one colour scale, so they compare. The
contrasts use the site's fixed difference scale. Every figure outlines the
edited area. The photographs and scanpath figures of the page are not drawn
here.
