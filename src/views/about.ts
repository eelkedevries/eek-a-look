import type { ExamplePhoto } from '../examples';
import { models } from '../models/registry';
import { MIT300_RETRIEVED, MIT300_SOURCE } from '../models/types';

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
    'eek-a-look shows five predictions of where people would look in a photo. Nobody’s eyes were measured for these maps: each one is the output of a model. How each method works is explained at the bottom of the page.',
    'about-lead',
  );

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
  for (const model of models) {
    if (!model.benchmark) continue;
    const note =
      model.runtime === 'precomputed' ? '(computed in advance; example photos only)'
      : model.kind === 'neural' ? '(runs in your browser)'
      : undefined;
    row(model.name, model.benchmark.cc, model.benchmark.aucJudd, note);
  }

  const large = el(
    'p',
    'The two DeepGaze models are too large to run in a browser. Their maps were computed in advance on the author’s laptop graphics card, so they cover the example photos only. For your own photo, UNISAL is the strongest model on this page.',
  );

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
    'In “What AI adds”, the neural model mostly adds sharp peaks; where it expects less, the change is small and spread out, so the blue is faint.',
  ]) limitList.append(el('li', text));

  const privacy = el('h3', 'Privacy');
  const privacyText = el(
    'p',
    'Your photo is processed on your own device and is never uploaded or stored. The page sends no requests to other sites and uses no analytics and no cookies. The UNISAL model (6.4 MB) and its runtime (3.7 MB) are downloaded from this site the first time they are needed; the DeepGaze maps for the examples are small files from this site too.',
  );

  const credits = el('h3', 'Credits');
  const creditList = el('ul', undefined, 'about-list about-credits');
  for (const photo of photos) {
    const item = el('li');
    item.append(`${photo.title}, ${photo.city}: `, link(photo.sourceUrl, photo.author), ', ', link(photo.licenceUrl, photo.licence), ` (${photo.changes.toLowerCase()}).`);
    creditList.append(item);
  }
  const deepgaze = el('li');
  deepgaze.append(
    'DeepGaze IIE and DeepGaze MSDB by Matthias Kümmerer and colleagues (',
    link('https://github.com/matthias-k/DeepGaze', 'DeepGaze on GitHub'),
    '). Their maps were computed locally; their code and weights are not redistributed here, as the repository carries no licence.',
  );
  creditList.append(deepgaze);
  const software = el('li');
  software.append(
    'UNISAL © Richard Droste, Jianbo Jiao and J. Alison Noble, ',
    link('https://github.com/rdroste/unisal', 'Apache-2.0'),
    ', converted for the browser (',
    link(`${base}models/unisal/NOTICE`, 'notice'),
    '). ONNX Runtime Web (MIT). Fonts Lexend, Spectral and JetBrains Mono (SIL Open Font License). Heatmap colours inferno (matplotlib, CC0). ',
    link('https://github.com/eelkedevries/eek-a-look', 'Source code on GitHub'),
    '.',
  );
  creditList.append(software);

  section.replaceChildren(heading, intro, quality, qualityText, table, large, source, limits, limitList, privacy, privacyText, credits, creditList);
}
