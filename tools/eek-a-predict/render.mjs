// Renders the eek-a-predict heatmap and contrast figures with the site's drawing code.
// Usage: node tools/eek-a-predict/render.mjs <eek-a-predict/img folder of the eelkedevries.com repository>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createServer } from 'vite';

const EXAMPLES = [
  ['greenery', 'zurich-33', 'zurich-33-low-hedge'],
  ['glazing', 'zurich-53', 'zurich-53-glass-frontage'],
  ['entrance', 'zurich-42', 'zurich-42-entrance-block'],
];
const out = process.argv[2];
if (!out) throw new Error('Give the output folder.');
mkdirSync(out, { recursive: true });

const server = await createServer({ server: { port: 4180, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error(error));
  await page.goto('http://localhost:4180/eek-a-look/tools/eek-a-predict/harness.html');
  await page.waitForFunction(() => document.title === 'ready');
  for (const [example, original, manipulated] of EXAMPLES) {
    const figures = await page.evaluate(([e, a, b]) => window.render(e, a, b), [example, original, manipulated]);
    for (const [name, url] of Object.entries(figures)) {
      const file = join(out, `${example}-${name}.jpg`);
      await sharp(Buffer.from(url.split(',')[1], 'base64')).jpeg({ quality: 84, progressive: true }).toFile(file);
      console.log(file);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
