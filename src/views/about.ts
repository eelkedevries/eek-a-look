import { titleAndPlace, type ExamplePhoto } from '../examples';
import { loadPanel } from './panel';
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
    'eek-a-look shows four predictions of where people would look in a photo. Nobody’s eyes were measured for these maps: each one is the output of a model. The exceptions are the photos with measured eye tracking: for the Zürich photos and those from Andersson et al. (2017), an extra layer, “Measured gaze”, shows where people actually looked, recorded with an eye tracker (48 people per Zürich photo, two to five per photo in the second set). In the Example section, the untouched Zürich photo of each comparison can also show one person’s measured gaze path: their fixations in order. The images under “From published studies” are taken from two eye-tracking articles: they show predictions only, and each links to the heat map its study measured, which is not turned into a layer here. How each method works is explained at the bottom of the page.',
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
    `, retrieved ${retrievedDate()}. Classic salience here is our own implementation and has no score; published versions of this approach score well below the neural models on the same test. `,
    el('strong', 'None of these models were tested on Dutch street photos.'),
  );

  const limits = el('h3', 'What these maps cannot tell you');
  const limitList = el('ul', undefined, 'about-list');
  for (const text of [
    'The models learned from people looking at photos on a screen for a few seconds, not from people walking down a real street.',
    'They predict an average viewer, not any one person.',
    'What people are doing changes where they look: finding an entrance is not the same as taking in the view.',
    'In “Contrast”, a sharp peak in one map shows strongly; a difference that is spread thinly over a large area shows only faintly.',
  ]) limitList.append(el('li', text));

  const areasHeading = el('h3', 'Automatic areas');
  const areasText = el('p');
  const areasCredit = el('li');
  const panelHeading = el('h3', 'Simulated panel');
  const panelText = el('p');
  const panelCredit = el('li');
  const qualitiesHeading = el('h3', 'Architectural qualities');
  const qualitiesText = el(
    'p',
    'For every example photo, the Qualities view measures three design principles an HvA expert panel used (rhythm and variety, an active ground floor, tactile materials) from the photo itself: how regularly windows and balconies repeat, how much of the ground floor opens to the street, and which materials are visible near eye level. The definitions are this project’s, not the panel’s, and each rule was fixed before it ran on the photos. Parts of each measure were checked against people’s labels of other photos; the principles themselves were not, as no experts judged these photos.',
  );
  const upclipHeading = el('h3', 'UP-CLIP');
  const upclipText = el(
    'p',
    'UP-CLIP (Huang, Song and Jiao 2026) fine-tunes the CLIP model so that street photos and descriptions of how a street feels end up close together. Its trained model is not published, so the Qualities view uses the authors’ own training script re-run on their public sample of 1,000 street-view pairs from Wuhan, next to plain CLIP. Matching photos with perception words is what the authors tested; scoring the three design principles is our adaptation. Neither has been checked against people’s judgements of these photos, and CLIP cannot show where in a photo a match comes from.',
  );
  const upclipCredit = el('li');
  upclipCredit.append(
    'UP-CLIP: Huang, Song and Jiao (2026), ',
    link('https://doi.org/10.1080/17538947.2026.2677402', 'International Journal of Digital Earth 19, 2677402'),
    ' (CC BY 4.0); training script and sample from ',
    link('https://github.com/19883120121i-afk/UP-CLIP', 'their repository'),
    ' (no licence stated), re-run locally; nothing from it is redistributed. CLIP ViT-L/14 by OpenAI (code MIT); its model card rules out deployed use, so only scores computed in advance are published.',
  );
  const materialsCredit = el('li');
  materialsCredit.append(
    'Materials: DMS46 by Paul Upchurch and Ransen Niu (',
    link('https://github.com/apple/ml-dms-dataset', 'ECCV 2022'),
    '; Apple sample-code licence, trained on labels under CC BY-NC 4.0), run locally; only its masks are published.',
  );

  const privacy = el('h3', 'Privacy');
  const privacyText = el(
    'p',
    'Your photo is processed on your own device and is never uploaded or stored. The page sends no requests to other sites and uses no analytics and no cookies. The UNISAL model (6.4 MB) and its runtime (3.7 MB) are downloaded from this site the first time they are needed; the DeepGaze maps and the areas for the examples are small files from this site too.',
  );

  const credits = el('h3', 'Credits');
  const creditList = el('ul', undefined, 'about-list about-credits');
  for (const photo of photos) {
    const item = el('li');
    const changes = photo.changes.charAt(0).toLowerCase() + photo.changes.slice(1);
    item.append(`${titleAndPlace(photo)}: `, link(photo.sourceUrl, photo.author), ', ', link(photo.licenceUrl, photo.licence), ` (${changes}).`);
    creditList.append(item);
  }
  const dataset = el('li');
  dataset.append(
    'Measured gaze and the Zürich photos: Wilming et al. (2017), “An extensive dataset of eye movements during viewing of complex images”, ',
    link('https://doi.org/10.1038/sdata.2016.126', 'Scientific Data 4, 160126'),
    '; data and photos ',
    link('https://creativecommons.org/publicdomain/zero/1.0/', 'CC0 1.0'),
    ', from ',
    link('https://doi.org/10.5061/dryad.9pf75', 'Dryad'),
    '. The eye tracking comes from the study by Onat, Açık, Schumann and König (2014), ',
    link('https://doi.org/10.1371/journal.pone.0093254', 'PLoS ONE 9, e93254'),
    '.',
  );
  const andersson = el('li');
  andersson.append(
    'Measured gaze and photos from Andersson, Larsson, Holmqvist, Stridh and Nyström (2017), “One algorithm to rule them all? An evaluation and discussion of ten eye movement event-detection algorithms”, ',
    link('https://doi.org/10.3758/s13428-016-0738-9', 'Behavior Research Methods 49, 616–637'),
    '; data and photos ',
    link('https://www.gnu.org/licenses/gpl-3.0.html', 'GNU GPL 3.0'),
    ', from ',
    link('https://github.com/richardandersson/EyeMovementDetectorEvaluation/tree/3e12416ab3fd6254c81811cf03f8e5d67c5d7129', 'the authors’ repository'),
    ', with the fixations hand-labelled by coder MN and one file corrected by Zemblys et al. (2018). The photos and every file derived from them here are under the same licence (',
    link(`${base}examples/andersson-2017-NOTICE.txt`, 'notice'),
    ').',
  );
  creditList.append(dataset, andersson);
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
  creditList.append(software, areasCredit, panelCredit, materialsCredit, upclipCredit);
  fillAreas(areasText, areasCredit);
  fillPanel(panelText, panelCredit);

  section.replaceChildren(
    heading, intro, quality, qualityText, table, large, source, limits, limitList,
    areasHeading, areasText, panelHeading, panelText, qualitiesHeading, qualitiesText, upclipHeading, upclipText, privacy, privacyText, credits, creditList,
  );
}

const SHORT_NAMES: Record<string, string> = { rhythm: 'rhythm and variety', groundFloor: 'the ground floor', materials: 'materials' };

/** The "Simulated panel" paragraph and credit, with the agreement and stability figures from panel.json. */
async function fillPanel(text: HTMLElement, credit: HTMLElement): Promise<void> {
  const panel = await loadPanel();
  const intro =
    'For each example photo, a vision-language model (Qwen3-VL) was asked eight times, as an architect, landscape architect, urban designer or planner, to judge the three principles an HvA expert panel used: rhythm and variety, an active ground floor and tactile materials. A verdict needs six of eight to agree. ';
  const outro = 'Such models favour European and North American views of cities (Zhao et al. 2026). An AI judgement, not validated against experts.';
  if (!panel) {
    text.textContent = intro + outro;
    return;
  }
  const keys = Object.keys(panel.fleissKappa);
  const agreed = keys.filter((k) => panel.fleissKappa[k] !== null).map((k) => `${SHORT_NAMES[k] ?? k} (kappa ${two(panel.fleissKappa[k]!)})`);
  const flat = keys.filter((k) => panel.fleissKappa[k] === null).map((k) => SHORT_NAMES[k] ?? k);
  const join = (items: string[]) => items.join(' and ');
  text.textContent =
    intro +
    (agreed.length ? `Runs agreed closely on ${join(agreed)} and ` : '') +
    `${Math.round(panel.stability.sameConsensus * 100)}% of verdicts held on a rerun` +
    (flat.length ? `, but every photo got the same verdict for ${join(flat)}. ` : '. ') +
    outro;
  credit.textContent = `Simulated panel: ${panel.model.split('@')[0]} by the Qwen team (${panel.licence}), run locally (${panel.quantisation}).`;
}

/** Content hash of public/precomputed/areas/, set by vite.config.ts. */
declare const __AREAS_VERSION__: string;

interface Validation {
  categories: { etrims: { categories: Record<string, { iou: number | null }> } };
  groundFloor: { etrimsDoors: { pixelShareInside: number | null } };
  elements: {
    candidates: Record<string, { name: string; licence?: string }>;
    winners: Record<string, { candidate: string; meanTestIou: number }>;
  } | null;
}

/** The "Automatic areas" paragraph and credit, with the checking numbers from validation.json. */
async function fillAreas(text: HTMLElement, credit: HTMLElement): Promise<void> {
  const base = import.meta.env.BASE_URL;
  let v: Validation | null = null;
  try {
    const response = await fetch(`${base}precomputed/areas/validation.json?v=${__AREAS_VERSION__}`);
    if (response.ok) v = await response.json();
  } catch {
    v = null;
  }
  const winners = v?.elements?.winners ?? {};
  const used = [...new Set(Object.values(winners).map((w) => w.candidate))].map((key) => v!.elements!.candidates[key]);
  const elementModels = used.map((c) => c.name).join(' and ') || 'a text-prompted model';
  const iou = (id: string) => (winners[id] ? two(winners[id].meanTestIou) : '–');
  const facade = v?.categories.etrims.categories.facade?.iou;
  const doors = v?.groundFloor.etrimsDoors.pixelShareInside;
  text.textContent =
    `For the example photos, a segmentation model (OneFormer) sorts every pixel into street categories such as façade, sky and street surface, and ${elementModels} finds windows, entrances, balconies and shopfronts from those words alone. ` +
    'The ground floor is the lowest 4 m of each façade, worked out from the horizon and a camera at eye height. ' +
    (v
      ? `Checked against hand-drawn labels in other street photos, the façades overlapped by ${facade != null ? two(facade) : '–'} (1 = identical) and ${doors != null ? Math.round(doors * 100) : '–'}% of labelled doors fell inside the ground floor; windows reached ${iou('windows')}, balconies ${iou('balconies')}, entrances ${iou('entrances')} and shopfronts only ${iou('shopfronts')}. `
      : '') +
    'A share of pixels is not a share of what people see, and these areas are automatic, not an expert judgement.';

  const sam3 = used.some((c) => c.name.startsWith('SAM 3'));
  credit.replaceChildren(
    'Automatic areas: OneFormer (Jain et al., CVPR 2023; ',
    link('https://huggingface.co/shi-labs/oneformer_ade20k_swin_large', 'MIT'),
    '), trained on ADE20K (Zhou et al.). ',
    ...used.map((c) => `${c.name} (${(c.licence ?? 'see its licence').replace(/\s*\(.*\)$/, '')}). `),
    sam3 ? 'This page acknowledges its use of SAM 3 by Meta (Carion et al., 2025). ' : '',
    'Checked against the eTRIMS Image Database (Korč and Förstner, 2009) and the ',
    link('https://cmp.felk.cvut.cz/~tylecr1/facade/', 'CMP Facade Database'),
    ' (Tyleček and Šára, 2013; CC BY-SA). No model weights or dataset images are published here.',
  );
}
