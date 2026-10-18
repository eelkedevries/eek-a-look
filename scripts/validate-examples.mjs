#!/usr/bin/env node
// Checks public/examples/examples.json against the ExamplePhoto schema in the
// specification, and that every photo and thumbnail it names exists.
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'public/examples';
const AREAS = { Zuidas: 'Amsterdam', Weena: 'Rotterdam', Wilhelminapier: 'Rotterdam', Beatrixkwartier: 'The Hague' };
const LICENCES = /^(CC0 1\.0|Public domain|CC BY(-SA)? [0-9.]+)$/;
const FIELDS = ['id', 'area', 'city', 'title', 'file', 'width', 'height', 'author', 'licence', 'licenceUrl', 'sourceUrl', 'changes'];

const photos = JSON.parse(await readFile(join(DIR, 'examples.json'), 'utf8'));
const errors = [];
const ids = new Set();

for (const [index, photo] of photos.entries()) {
  const where = `entry ${index} (${photo.id ?? 'no id'})`;
  for (const field of FIELDS) {
    if (photo[field] === undefined || photo[field] === '') errors.push(`${where}: missing ${field}`);
  }
  if (ids.has(photo.id)) errors.push(`${where}: duplicate id`);
  ids.add(photo.id);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(photo.id)) errors.push(`${where}: id is not kebab-case`);
  if (AREAS[photo.area] === undefined) errors.push(`${where}: unknown area ${photo.area}`);
  else if (AREAS[photo.area] !== photo.city) errors.push(`${where}: ${photo.area} is not in ${photo.city}`);
  if (!LICENCES.test(photo.licence)) errors.push(`${where}: licence "${photo.licence}" is not allowed`);
  if (!/^https:\/\//.test(photo.sourceUrl)) errors.push(`${where}: sourceUrl is not https`);
  if (Math.max(photo.width, photo.height) > 1600) errors.push(`${where}: larger than 1600 px`);
  for (const file of [photo.file, photo.file.replace(/\.jpg$/, '-thumb.jpg')]) {
    try {
      await access(join(DIR, file));
    } catch {
      errors.push(`${where}: file ${file} not found`);
    }
  }
}

if (errors.length) {
  console.error(`Example manifest has ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`Example manifest OK: ${photos.length} photos.`);
