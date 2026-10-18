import type { ExamplePhoto } from '../examples';
import { models } from '../models/registry';
import { MIT300_RETRIEVED, MIT300_SOURCE } from '../models/types';

// Larger models shown for comparison only; same source and date as the registry's figures.
const LARGER = [
  { name: 'DeepGaze IIE', cc: 0.8242, aucJudd: 0.8829 },
  { name: 'DeepGaze MSDB', cc: 0.8832, aucJudd: 0.8942 },
];

const two = (x: number) => (Math.round(x * 100) / 100).toFixed(2);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(href: string, text: string): HTMLAnchorElement {
  const a = el('a', text);
  a.href = href;
  a.rel = 'noopener';
  return a;
}

function retrievedDate(): string {
  return new Date(`${MIT300_RETRIEVED}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The About section: what the maps are, the models, their quality, limits, privacy and credits. */
export function renderAbout(section: HTMLElement, photos: ExamplePhoto[]): void {
  const base = import.meta.env.BASE_URL;
  const heading = el('h2', 'About', 'section-label');
  heading.id = 'about-heading';

  const intro = el(
    'p',
    'eek-a-look shows three predictions of where people would look in a photo. Nobody’s eyes were measured for these maps: each one is the output of a model.',
    'about-lead',
  );

  const modelList = el('dl', undefined, 'about-models');
  for (const model of models) {
    const term = el('dt', model.subtitle ? `${model.name} · ${model.subtitle}` : model.name);
    const description = el('dd');
    description.append(`${model.oneLine} `, el('span', `${model.citation}; ${model.licence === 'own implementation' ? 'our own implementation' : `${model.licence} licence`}.`, 'muted'));
    modelList.append(term, description);
  }

  const quality = el('h3', 'How good are they?');
  const qualityText = el(
    'p',
    'Scores on MIT300, a lab test in which people looked freely at 300 everyday photos for a few seconds. CC is the correlation with where those people actually looked (1 would be perfect); AUC is how well a map separates looked-at from ignored places (0.5 is chance).',
  );
  const table = el('table', undefined, 'about-table');
  const head = el('tr');
  for (const label of ['Model', 'CC', 'AUC']) head.append(el('th', label));
  table.append(el('thead'), el('tbody'));
  table.tHead!.append(head);
  const row = (name: string, cc: number, auc: number, note?: string) => {
    const tr = el('tr');
    const cell = el('td', name);
    if (note) cell.append(' ', el('span', note, 'muted'));
    tr.append(cell, el('td', two(cc)), el('td', two(auc)));
    table.tBodies[0].append(tr);
  };
  for (const model of models) if (model.benchmark) row(model.name, model.benchmark.cc, model.benchmark.aucJudd, model.kind === 'neural' ? '(on this page)' : undefined);
  for (const larger of LARGER) row(larger.name, larger.cc, larger.aucJudd, '(larger model, not on this page)');

  const source = el('p', undefined, 'about-source');
  source.append(
    'Source: ',
    link(MIT300_SOURCE, 'MIT/Tübingen Saliency Benchmark'),
    `, retrieved ${retrievedDate()}. Classic salience here is our own implementation and has no score; published versions of this approach score at or below centre bias on the same test. `,
    el('strong', 'None of these models were tested on Dutch street photos.'),
  );

  const limits = el('h3', 'What these maps cannot tell you');
  const limitList = el('ul', undefined, 'about-list');
  for (const text of [
    'The models learned from people looking at photos on a screen for a few seconds, not from people walking down a real street.',
    'They predict an average viewer, not any one person.',
    'What people are doing changes where they look: finding an entrance is not the same as taking in the view.',
    'In “What AI adds”, UNISAL mostly adds sharp peaks; where it expects less, the change is small and spread out, so the blue is faint.',
  ]) limitList.append(el('li', text));

  const privacy = el('h3', 'Privacy');
  const privacyText = el(
    'p',
    'Your photo is processed on your own device and is never uploaded or stored. The page sends no requests to other sites and uses no analytics and no cookies. The UNISAL model (6.4 MB) and its runtime (3.7 MB) are downloaded from this site the first time they are needed.',
  );

  const credits = el('h3', 'Credits');
  const creditList = el('ul', undefined, 'about-list about-credits');
  for (const photo of photos) {
    const item = el('li');
    item.append(`${photo.title}, ${photo.city}: `, link(photo.sourceUrl, photo.author), ', ', link(photo.licenceUrl, photo.licence), ` (${photo.changes.toLowerCase()}).`);
    creditList.append(item);
  }
  const software = el('li');
  software.append(
    'UNISAL © Richard Droste, Jianbo Jiao and J. Alison Noble, ',
    link('https://github.com/rdroste/unisal', 'Apache-2.0'),
    ', converted for the browser (',
    link(`${base}models/unisal/NOTICE`, 'notice'),
    '). ONNX Runtime Web (MIT). Fonts Lexend, Spectral and JetBrains Mono (SIL Open Font License). Heatmap colours YlOrRd (ColorBrewer, Apache-2.0). ',
    link('https://github.com/eelkedevries/eek-a-look', 'Source code on GitHub'),
    '.',
  );
  creditList.append(software);

  section.replaceChildren(heading, intro, modelList, quality, qualityText, table, source, limits, limitList, privacy, privacyText, credits, creditList);
}
