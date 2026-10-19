#!/usr/bin/env node
// Runs the two browser models (Classic salience, UNISAL) on the images of the
// Example section with the app's own code, in headless Chromium, and saves
// their maps in public/precomputed/comparisons/<model-id>/<image-id>.json, in
// the format of the DeepGaze maps. The Example section then opens with every
// map ready, and the numbers it shows do not vary between visits.
//
//   node tools/comparisons/browser-models.mjs
//
// Needs Playwright with Chromium (`npm i -g playwright`); it is not a project
// dependency.
import { execSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch {
    return require(join(execSync('npm root -g').toString().trim(), 'playwright'));
  }
};
const { chromium } = loadPlaywright();

const BASE = '/eek-a-look/';
const OUT = 'public/precomputed/comparisons';
const manifest = JSON.parse(await readFile('public/examples/comparisons.json', 'utf8'));
const ids = [...new Set(manifest.examples.flatMap((e) => [e.a, e.b, e.reference].filter(Boolean)))];

/** Little-endian uint16 scaled to the maximum, in base64: encode() in tools/deepgaze-local/common.py. */
function encode(values) {
  const max = Math.max(...values);
  const bytes = Buffer.alloc(values.length * 2);
  values.forEach((v, i) => bytes.writeUInt16LE(Math.round((v / max) * 65535), i * 2));
  return bytes.toString('base64');
}

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error(error));
  await page.goto(`http://localhost:5199${BASE}`);
  const maps = await page.evaluate(
    async ({ base, ids }) => {
      const { classicSalience } = await import(`${base}src/models/classic-salience/index.ts`);
      const { unisal } = await import(`${base}src/models/unisal/index.ts`);
      const { gridFor } = await import(`${base}src/maps/saliency-map.ts`);
      const out = {};
      for (const id of ids) {
        const bitmap = await createImageBitmap(await (await fetch(`${base}examples/${id}.jpg`)).blob());
        const grid = gridFor(bitmap.width, bitmap.height);
        out[id] = {};
        for (const model of [classicSalience, unisal]) {
          const map = await model.predict(bitmap, grid);
          out[id][model.id] = { grid, data: Array.from(map.data) };
        }
      }
      return out;
    },
    { base: BASE, ids },
  );
  for (const [id, byModel] of Object.entries(maps)) {
    for (const [model, { grid, data }] of Object.entries(byModel)) {
      await mkdir(join(OUT, model), { recursive: true });
      const payload = { model, photo: id, grid, encoding: 'uint16-base64', data: encode(data) };
      await writeFile(join(OUT, model, `${id}.json`), JSON.stringify(payload));
      console.log(`${model} ${id} ${grid.width}×${grid.height}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
