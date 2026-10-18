#!/usr/bin/env node
// Checks that every model in the registry has a method paragraph of 90–115
// words in src/content/methods.ts.
import { readFile } from 'node:fs/promises';

const registry = await readFile('src/models/registry.ts', 'utf8');
const sources = await Promise.all(
  ['src/models/centre-bias.ts', 'src/models/classic-salience/index.ts', 'src/models/unisal/index.ts', 'src/models/deepgaze.ts'].map((f) =>
    readFile(f, 'utf8'),
  ),
);
const ids = [...sources.join('\n').matchAll(/^\s*id: '([a-z-]+)'/gm)].map((m) => m[1]);
const texts = await readFile('src/content/methods.ts', 'utf8');
const paragraphs = Object.fromEntries(
  [...texts.matchAll(/^\s*'?([a-z-]+)'?:\s*\n\s*'((?:[^'\\]|\\.)*)'/gm)].map((m) => [m[1], m[2]]),
);

const errors = [];
if (!registry.includes('models')) errors.push('registry not found');
for (const id of ids) {
  const text = paragraphs[id];
  if (!text) {
    errors.push(`${id}: no paragraph`);
    continue;
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 90 || words > 115) errors.push(`${id}: ${words} words (expected 90–115)`);
}
if (errors.length) {
  console.error(`Method texts: ${errors.join('; ')}`);
  process.exit(1);
}
console.log(`Method texts OK: ${ids.map((id) => `${id} ${paragraphs[id].split(/\s+/).length}`).join(', ')} words.`);
