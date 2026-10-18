#!/usr/bin/env node
// Writes a gzip copy next to each WebAssembly file in dist/assets. The host
// does not compress .wasm itself; public/.htaccess serves these copies to
// browsers that accept gzip (all current ones), cutting the 14 MB runtime to
// about 4 MB.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = 'dist/assets';
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.wasm'))) {
  const raw = await readFile(join(dir, file));
  const gz = gzipSync(raw, { level: 9 });
  await writeFile(join(dir, `${file}.gz`), gz);
  console.log(`${file}: ${(raw.length / 1e6).toFixed(1)} MB → ${(gz.length / 1e6).toFixed(1)} MB gzip`);
}
