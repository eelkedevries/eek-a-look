#!/usr/bin/env node
// Checks public/examples/examples.json against the ExamplePhoto schema in the
// specification, and that every photo and thumbnail it names exists.
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'public/examples';
const AREAS = { Zuidas: 'Amsterdam', Weena: 'Rotterdam', Wilhelminapier: 'Rotterdam', Beatrixkwartier: 'The Hague', Zürich: 'Zürich' };
// Images from published eye-tracking studies form one group across several cities.
const STUDY_AREA = 'From published studies';
const STUDY_CITIES = ['Qinyang'];
// Prompt 069: photos with measured gaze from a lab study; a place is named only where the photo shows it beyond doubt.
const MEASURED_AREA = 'Andersson et al. (2017)';
const MEASURED_AREA_CITIES = ['Rome'];
const isCount = (n) => Number.isInteger(n) && n > 0;
const IMAGE_KINDS = ['render', 'panorama'];
const LICENCES = /^(CC0 1\.0|Public domain|CC BY(-SA)? [0-9.]+|GNU GPL 3\.0)$/;
const FIELDS = ['id', 'area', 'city', 'title', 'file', 'width', 'height', 'author', 'licence', 'licenceUrl', 'sourceUrl', 'changes'];

const photos = JSON.parse(await readFile(join(DIR, 'examples.json'), 'utf8'));
const errors = [];
const ids = new Set();

for (const [index, photo] of photos.entries()) {
  const where = `entry ${index} (${photo.id ?? 'no id'})`;
  for (const field of FIELDS) {
    if (field === 'city' && photo.area === MEASURED_AREA && photo.city === undefined) continue;
    if (photo[field] === undefined || photo[field] === '') errors.push(`${where}: missing ${field}`);
  }
  if (ids.has(photo.id)) errors.push(`${where}: duplicate id`);
  ids.add(photo.id);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(photo.id)) errors.push(`${where}: id is not kebab-case`);
  if (photo.area === STUDY_AREA) {
    if (!STUDY_CITIES.includes(photo.city)) errors.push(`${where}: unknown study city ${photo.city}`);
    const { citation, heatmapFigure, heatmapUrl, viewing } = photo.study ?? {};
    for (const [name, value] of Object.entries({ citation, heatmapFigure, heatmapUrl, viewing })) {
      if (typeof value !== 'string' || value === '') errors.push(`${where}: study.${name} is missing`);
    }
    if (!/^https:\/\//.test(heatmapUrl ?? '')) errors.push(`${where}: study.heatmapUrl is not https`);
    if (photo.measured !== undefined) errors.push(`${where}: a study image cannot have measured gaze`);
    // Prompt 051: renderings and 360° panoramas are named, so the area tool can treat them apart.
    if (!IMAGE_KINDS.includes(photo.imageKind)) errors.push(`${where}: imageKind must be one of ${IMAGE_KINDS.join(', ')}`);
  } else if (photo.study !== undefined) errors.push(`${where}: study is only for ${STUDY_AREA}`);
  else if (photo.area === MEASURED_AREA) {
    if (photo.city !== undefined && !MEASURED_AREA_CITIES.includes(photo.city)) errors.push(`${where}: unknown city ${photo.city}`);
    if (photo.measured === undefined) errors.push(`${where}: ${MEASURED_AREA} photos need measured gaze`);
  }
  else if (AREAS[photo.area] === undefined) errors.push(`${where}: unknown area ${photo.area}`);
  else if (AREAS[photo.area] !== photo.city) errors.push(`${where}: ${photo.area} is not in ${photo.city}`);
  if (photo.imageKind !== undefined && !IMAGE_KINDS.includes(photo.imageKind)) errors.push(`${where}: unknown imageKind ${photo.imageKind}`);
  if (!LICENCES.test(photo.licence)) errors.push(`${where}: licence "${photo.licence}" is not allowed`);
  if (!/^https:\/\//.test(photo.sourceUrl)) errors.push(`${where}: sourceUrl is not https`);
  if (Math.max(photo.width, photo.height) > 1600) errors.push(`${where}: larger than 1600 px`);
  if (photo.measured !== undefined) {
    const { observers, fixations, viewingSeconds, citation } = photo.measured;
    if (!isCount(observers)) errors.push(`${where}: measured.observers is not a positive integer`);
    if (!isCount(fixations)) errors.push(`${where}: measured.fixations is not a positive integer`);
    if (!(typeof viewingSeconds === 'number' && viewingSeconds > 0)) errors.push(`${where}: measured.viewingSeconds is not positive`);
    if (typeof citation !== 'string' || citation === '') errors.push(`${where}: measured.citation is missing`);
  }
  for (const file of [photo.file, photo.file.replace(/\.jpg$/, '-thumb.jpg')]) {
    try {
      await access(join(DIR, file));
    } catch {
      errors.push(`${where}: file ${file} not found`);
    }
  }
}

// Prompt 058: the Example section's edited images and comparisons. Edited images never carry measured gaze.
const comparisons = JSON.parse(await readFile(join(DIR, 'comparisons.json'), 'utf8'));
const byId = new Map(photos.map((p) => [p.id, p]));
for (const [index, image] of comparisons.images.entries()) {
  const where = `comparisons.json image ${index} (${image.id ?? 'no id'})`;
  for (const field of [...FIELDS, 'editOf', 'condition']) {
    if (image[field] === undefined || image[field] === '') errors.push(`${where}: missing ${field}`);
  }
  if (byId.has(image.id) || ids.has(image.id)) errors.push(`${where}: duplicate id`);
  ids.add(image.id);
  const source = byId.get(image.editOf);
  if (!source) errors.push(`${where}: editOf ${image.editOf} is not an example photo`);
  else if (source.width !== image.width || source.height !== image.height) errors.push(`${where}: not the size of ${image.editOf}`);
  if (image.measured !== undefined || image.study !== undefined) errors.push(`${where}: an edited image cannot have measured gaze or a study`);
  for (const file of [image.file, image.file.replace(/\.jpg$/, '-thumb.jpg')]) {
    try {
      await access(join(DIR, file));
    } catch {
      errors.push(`${where}: file ${file} not found`);
    }
  }
}
for (const example of comparisons.examples) {
  for (const key of ['a', 'b', 'reference']) {
    if (example[key] !== undefined && !ids.has(example[key])) errors.push(`comparison ${example.id}: ${key} ${example[key]} is unknown`);
  }
}

if (errors.length) {
  console.error(`Example manifest has ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`Example manifest OK: ${photos.length} photos, ${comparisons.images.length} edited images in ${comparisons.examples.length} comparisons.`);
