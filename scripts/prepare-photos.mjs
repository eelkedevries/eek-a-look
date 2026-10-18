#!/usr/bin/env node
// Prepares example photos for the site: every JPEG or PNG in <source-dir> is
// rotated upright, resized to at most 1600 px on the long side, saved as JPEG
// (quality 82) with all metadata (EXIF, GPS) stripped, and given a 320 px
// thumbnail. The output name is the source file name, so name sources by
// their manifest id.
//
//   node scripts/prepare-photos.mjs <source-dir> <dest-dir>
import { readdir, mkdir } from 'node:fs/promises';
import { extname, basename, join } from 'node:path';
import sharp from 'sharp';

const [sourceDir, destDir] = process.argv.slice(2);
if (!sourceDir || !destDir) {
  console.error('Usage: node scripts/prepare-photos.mjs <source-dir> <dest-dir>');
  process.exit(1);
}

await mkdir(destDir, { recursive: true });
const sources = (await readdir(sourceDir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();

for (const file of sources) {
  const id = basename(file, extname(file));
  const upright = sharp(join(sourceDir, file)).rotate();
  const photo = await upright
    .clone()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(destDir, `${id}.jpg`));
  await upright
    .clone()
    .resize({ width: 320, height: 320, fit: 'inside' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(join(destDir, `${id}-thumb.jpg`));
  console.log(JSON.stringify({ id, width: photo.width, height: photo.height, bytes: photo.size }));
}
