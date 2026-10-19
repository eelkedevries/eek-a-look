import { attentionShares, decodeRle, type Area } from '../maps/areas';
import { drawGreyed } from '../render/heatmap';
import { modelsFor, onResults, type Results } from '../results';
import { loadPanel, type PanelFile } from './panel';

/** Content hashes of the pre-computed folders, set by vite.config.ts, so a stale cached copy is never used. */
declare const __QUALITIES_VERSION__: string;
declare const __PANEL_VERSION__: string;
declare const __UPCLIP_VERSION__: string;

const BASE = import.meta.env.BASE_URL;
const WIDTH = 1200;
const MIN_SHARE = 0.005;

export type PrincipleId = 'rhythm' | 'groundFloor' | 'materials';
type Outcome = 'likely-present' | 'likely-absent' | 'unclear';
type Role = 'supports' | 'against' | 'context';

interface Evidence {
  id: string;
  label: string;
  role: Role;
  share: number;
  rle?: number[];
  lines?: number[][];
}

interface PrincipleResult {
  outcome: Outcome;
  reasons: string[];
  indicators: Record<string, number | null>;
  evidence: Evidence[];
}

interface QualityFile {
  photo: string;
  width: number;
  height: number;
  models: Record<string, string>;
  principles: Partial<Record<PrincipleId, PrincipleResult>>;
}

interface GradedFile {
  model: string;
  krippendorffAlphaOrdinal: Record<PrincipleId, number | null>;
  discrimination: Record<PrincipleId, { distinctMedians: number; min: number; max: number }>;
  photos: Record<
    string,
    Record<
      PrincipleId,
      {
        ratings: (number | null)[];
        median: number | null;
        iqr: number | null;
        evidence: string | null;
        boxes: { member: number; label: string; box: number[] | null }[];
      }
    >
  >;
}

interface ChecksFile {
  rhythm: { families: Record<'vertical' | 'layer', { balancedAccuracy: number }> };
  frontage: { openShareSpearman: number; outcomeAgreement: number };
  materials: { dmsTest?: { groupPixelAccuracy: number; images: number } };
  discrimination: Record<
    PrincipleId,
    {
      outcomes: Record<Outcome, number>;
      sameOnAllPhotos: boolean;
      perPhoto: Record<string, { outcome: Outcome; value: number | null }>;
    }
  >;
}

export interface UpClipFile {
  models: { id: string; name: string; source: string; retrieval: unknown }[];
  descriptions: { id: string; text: string; kind: 'perception' | 'principle'; use: 'supported' | 'adaptation'; principle?: PrincipleId; polarity?: string }[];
  photos: string[];
  similarity: Record<string, number[][]>;
  principleScores: Record<string, Record<string, Record<PrincipleId, number>>>;
}

export interface PhotoInfo {
  id: string;
  title: string;
  city: string;
  file: string;
  width: number;
  height: number;
}

const PRINCIPLES: { id: PrincipleId; name: string }[] = [
  { id: 'rhythm', name: 'Rhythm and variety' },
  { id: 'groundFloor', name: 'Active ground floor' },
  { id: 'materials', name: 'Tactile materials' },
];

const OUTCOME_TEXT: Record<Outcome, string> = {
  'likely-present': 'Likely present',
  'likely-absent': 'Likely absent',
  unclear: 'Unclear',
};

// Okabe–Ito: bluish green for evidence that supports the principle, vermilion against, sky blue for context.
const ROLE_COLOUR: Record<Role, string> = { supports: '#009E73', against: '#D55E00', context: '#56B4E9' };
const ROLE_TEXT: Record<Role, string> = { supports: 'For', against: 'Against', context: 'Context' };
const BOX_COLOUR = '#F0E442';

/** This project's operational definitions (specification, Architectural qualities). */
const DEFINITIONS: Record<PrincipleId, string> = {
  rhythm:
    'Façades divided into horizontal layers (floors, bands, cornices, rows of windows or balconies) and vertical units (bays, columns of windows) that repeat, with visible variation between façade zones. Rhythm is a relation between elements, so one window says nothing about it.',
  groundFloor:
    'A street-level frontage that opens to the street through entrances and shopfronts. Windows are shown, but transparency alone does not make a frontage active; blank, closed stretches count against it.',
  materials:
    'Surfaces near eye level, on the façade and in the street space, whose material shows texture or detail: brick, natural stone, wood, tiles and setts, planting. This is visible texture in a photo, not how a surface feels to the touch.',
};

const HOW: Record<PrincipleId, string> = {
  rhythm:
    'Windows and balconies found by SAM 3. In each part of the façade: do their positions repeat at regular intervals across (bays) and up (floors)? The threshold was set on 189 façades labelled by people. Variety: façade zones of clearly different colour. Glass curtain walls and arcades, where no windows are found, read as plain; sun and shade can split one façade into two zones.',
  groundFloor:
    'The ground floor is the façade up to 4 m above the street, from the horizon and an eye-height camera. Per image column: open where entrances or shopfronts cover at least 30% of it, transparent where windows do, closed otherwise. Glazing the window model misses counts as closed.',
  materials:
    'Materials from DMS46, a model that recognises 46 materials, near eye level: the ground floor and everything below the horizon. Textured: brick, natural stone, wood, tiles, wicker, planting. Smooth: glass, mirror, metal, polished stone, plaster or paint, plastic, ceramic. Dark brick sometimes comes out as plaster.',
};

const ORIGINAL =
  'Spanjar & Suurenbroek (2020) asked 14 experts in architecture, landscape architecture, planning and urban design to judge 15 photos of high-rise streets: was each principle present, absent or ambiguous? They named the principles without defining them, judged whole photos rather than parts of them, and did not judge these photos.';

const INDICATORS: Record<string, string> = {
  frontageShare: 'Visible frontage (share of the photo’s width)',
  openShare: 'Open: entrances or shopfronts',
  transparentShare: 'Transparent only: windows',
  closedShare: 'Closed',
  entrances: 'Entrances found',
  longestClosedRun: 'Longest closed stretch',
  useCues: 'People, signs or furniture in front (context)',
  facadeCells: 'Façade cells judged',
  rhythmicShare: 'Repeating layers and bays',
  layersOnlyShare: 'Layers only',
  baysOnlyShare: 'Bays only',
  plainShare: 'Plain (fewer than three elements)',
  irregularShare: 'Irregular',
  distinctZones: 'Visibly different façade zones',
  windowInstances: 'Windows found',
  balconyInstances: 'Balconies found',
  zoneShare: 'Eye-level zone (share of the photo)',
  texturedShare: 'Textured',
  smoothShare: 'Smooth',
  neutralShare: 'Neutral (concrete, asphalt, other)',
  plantingShare: 'Planting',
  facadeTexturedShare: 'Textured on the ground floor',
  facadeSmoothShare: 'Smooth on the ground floor',
  facadeNeutralShare: 'Neutral on the ground floor',
  streetTexturedShare: 'Textured in the street space',
  streetSmoothShare: 'Smooth in the street space',
  streetNeutralShare: 'Neutral in the street space',
  texturedFurniture: 'Textured street furniture',
};
const COUNTS = new Set(['entrances', 'facadeCells', 'distinctZones', 'windowInstances', 'balconyInstances']);

const percent = (x: number) => `${(x * 100).toFixed(x < 0.1 && x > 0 ? 1 : 0)}%`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function cached<T>(url: string): () => Promise<T | null> {
  let promise: Promise<T | null> | null = null;
  return () =>
    (promise ??= fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .catch(() => null));
}

const qualityFiles = new Map<string, Promise<QualityFile | null>>();
function loadQuality(photoId: string): Promise<QualityFile | null> {
  if (!qualityFiles.has(photoId)) {
    qualityFiles.set(
      photoId,
      fetch(`${BASE}precomputed/qualities/${photoId}.json?v=${__QUALITIES_VERSION__}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  return qualityFiles.get(photoId)!;
}
const loadChecks = cached<ChecksFile>(`${BASE}precomputed/qualities/checks.json?v=${__QUALITIES_VERSION__}`);
const loadGraded = cached<GradedFile>(`${BASE}precomputed/vlm-panel/panel-graded.json?v=${__PANEL_VERSION__}`);
export const loadUpClip = cached<UpClipFile>(`${BASE}precomputed/up-clip/scores.json?v=${__UPCLIP_VERSION__}`);

function formatIndicator(key: string, value: number | null): string {
  if (value === null) return '–';
  return COUNTS.has(key) ? String(value) : percent(value);
}

/** Evidence regions decoded to masks; line evidence keeps its segments. */
type Layer = Evidence & { mask?: Uint8Array };

function decodeLayers(file: QualityFile, result: PrincipleResult): Layer[] {
  return result.evidence.map((e) => (e.rle ? { ...e, mask: decodeRle(e.rle, file.width * file.height) } : { ...e }));
}

/** Draw evidence at twice the mask size: supports and against filled lightly, context only when highlighted. */
function drawEvidence(canvas: HTMLCanvasElement, layers: Layer[], width: number, height: number, highlighted?: string): void {
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const image = new ImageData(canvas.width, canvas.height);
  const d = image.data;
  for (const layer of layers) {
    const shown = layer.id === highlighted || layer.role !== 'context';
    if (!layer.mask || !shown) continue;
    const rgb = [1, 3, 5].map((i) => parseInt(ROLE_COLOUR[layer.role].slice(i, i + 2), 16));
    const alpha = layer.id === highlighted ? 150 : 70;
    const m = layer.mask;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!m[i]) continue;
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1 || !m[i - 1] || !m[i + 1] || !m[i - width] || !m[i + width];
        const a = edge ? 255 : alpha;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const k = ((y * scale + dy) * canvas.width + x * scale + dx) * 4;
            if (d[k + 3] >= a) continue;
            d[k] = rgb[0];
            d[k + 1] = rgb[1];
            d[k + 2] = rgb[2];
            d[k + 3] = a;
          }
        }
      }
    }
  }
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(image, 0, 0);
  const lines = layers.find((l) => l.lines && l.id === highlighted);
  if (lines?.lines) {
    ctx.strokeStyle = ROLE_COLOUR[lines.role];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of lines.lines) {
      ctx.moveTo(x1 * scale, y1 * scale);
      ctx.lineTo(x2 * scale, y2 * scale);
    }
    ctx.stroke();
  }
}

function drawBoxes(canvas: HTMLCanvasElement, boxes: { label: string; box: number[] | null }[], width: number, height: number): void {
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = BOX_COLOUR;
  ctx.fillStyle = BOX_COLOUR;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.font = '20px "JetBrains Mono", monospace';
  for (const { label, box } of boxes) {
    if (!box) continue;
    const [x0, y0, x1, y1] = box.map((v) => v * scale);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    if (label) ctx.fillText(label.slice(0, 28), x0 + 4, Math.max(20, y0 - 6));
  }
}

const rank = (values: number[], value: number) => values.filter((v) => v > value).length + 1;

/**
 * The Qualities view: per example photo and design principle, the image measure with its evidence,
 * the definitions behind it, the other methods' verdicts on the same photo, and attention ÷ size
 * for the evidence regions. Uploads get a short message.
 */
export function mountQualities(panel: HTMLElement, pickPhoto: (id: string) => void, photos: () => Map<string, PhotoInfo>): HTMLElement {
  let principle: PrincipleId = 'rhythm';
  let showBoxes = false;
  let highlighted: string | undefined;
  let current: { results: Results; file: QualityFile; layers: Layer[] } | null = null;
  let extras: { checks: ChecksFile | null; panelV1: PanelFile | null; graded: GradedFile | null; upclip: UpClipFile | null } = {
    checks: null,
    panelV1: null,
    graded: null,
    upclip: null,
  };
  const shareCache = new Map<string, Map<string, number>>();

  const switcher = el('div', 'area-switch quality-switch');
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', 'Design principle');
  const switchButtons = PRINCIPLES.map(({ id, name }) => {
    const button = el('button', 'model-button', name);
    button.type = 'button';
    button.addEventListener('click', () => {
      principle = id;
      highlighted = undefined;
      render();
    });
    switcher.append(button);
    return button;
  });

  const stage = el('div', 'stage');
  const frame = el('div', 'frame');
  const photo = el('canvas', 'photo');
  const evidenceLayer = el('canvas', 'layer');
  const boxLayer = el('canvas', 'layer');
  const tag = el('span', 'predicted-tag areas-tag', 'Image measure · not an expert judgement');
  frame.append(photo, evidenceLayer, boxLayer, tag);
  const empty = el('p', 'stage-empty');

  const boxToggle = el('button', 'model-button quality-box-toggle', 'Show the AI judgement’s boxes');
  boxToggle.type = 'button';
  boxToggle.setAttribute('aria-pressed', 'false');
  boxToggle.addEventListener('click', () => {
    showBoxes = !showBoxes;
    renderBoxes();
  });

  const legend = el('ul', 'area-legend');
  const outcome = el('div', 'quality-outcome');
  const definitions = el('details', 'quality-definitions');
  const methods = el('div', 'quality-methods');
  const attention = el('div', 'quality-attention');
  const all = el('div', 'quality-all');
  const panelBlock = el('div', 'areas-panel');
  const upclipBlock = el('div', 'quality-upclip');
  const body = el('div', 'quality-body');
  body.append(switcher, stage, boxToggle, legend, outcome, definitions, methods, attention, all, panelBlock, upclipBlock);
  panel.replaceChildren(body);

  function result(): PrincipleResult | undefined {
    return current?.file.principles[principle];
  }

  function drawStage() {
    if (!current) return;
    const { results, file } = current;
    const scale = Math.min(1, WIDTH / results.image.width);
    drawGreyed(photo, results.image.bitmap, Math.round(results.image.width * scale), Math.round(results.image.height * scale));
    drawEvidence(evidenceLayer, current.layers, file.width, file.height, highlighted);
    renderBoxes();
    stage.replaceChildren(frame);
  }

  function renderBoxes() {
    boxToggle.setAttribute('aria-pressed', String(showBoxes));
    const graded = extras.graded?.photos[current?.file.photo ?? '']?.[principle];
    boxToggle.hidden = !graded?.boxes.length;
    if (!current) return;
    drawBoxes(boxLayer, showBoxes && graded ? graded.boxes : [], current.file.width, current.file.height);
    tag.textContent = showBoxes ? 'Image measure · boxes: AI judgement · neither is an expert judgement' : 'Image measure · not an expert judgement';
  }

  function renderLegend() {
    const r = result();
    if (!r || !current) return legend.replaceChildren();
    legend.replaceChildren(
      ...current.layers.map((layer) => {
        const item = el('li');
        const button = el('button', 'area-legend-item');
        button.type = 'button';
        const swatch = el('span', 'area-swatch');
        swatch.style.background = ROLE_COLOUR[layer.role];
        if (layer.lines) swatch.classList.add('quality-swatch-line');
        const share = layer.lines ? '' : ` ${percent(layer.share)}`;
        button.append(swatch, `${layer.label} `, el('span', 'area-percent', `${ROLE_TEXT[layer.role]}${share}`));
        const show = (on: boolean) => {
          highlighted = on ? layer.id : undefined;
          if (current) drawEvidence(evidenceLayer, current.layers, current.file.width, current.file.height, highlighted);
        };
        button.addEventListener('mouseenter', () => show(true));
        button.addEventListener('mouseleave', () => show(false));
        button.addEventListener('focus', () => show(true));
        button.addEventListener('blur', () => show(false));
        item.append(button);
        return item;
      }),
    );
  }

  function renderOutcome() {
    const r = result();
    if (!r) return outcome.replaceChildren();
    const heading = el('h3', 'quality-verdict');
    heading.append(el('span', 'quality-verdict-label', 'Image measure: '), el('strong', undefined, OUTCOME_TEXT[r.outcome]));
    const reasons = el('ul', 'quality-reasons');
    for (const reason of r.reasons) reasons.append(el('li', undefined, reason));
    const list = el('dl', 'quality-indicators');
    for (const [key, value] of Object.entries(r.indicators)) {
      const name = key.startsWith('material: ') ? `Common material: ${key.slice(10)}` : INDICATORS[key] ?? key;
      list.append(el('dt', undefined, name), el('dd', undefined, formatIndicator(key, value)));
    }
    const how = el('p', 'agreement-caption', HOW[principle]);
    outcome.replaceChildren(heading, reasons, list, how);
  }

  function renderDefinitions() {
    const summary = el('summary', undefined, 'Definitions');
    const ours = el('div', 'quality-definition');
    ours.append(el('h4', undefined, 'Our definition'), el('p', undefined, DEFINITIONS[principle]));
    const theirs = el('div', 'quality-definition');
    theirs.append(el('h4', undefined, 'In the original study'), el('p', undefined, ORIGINAL));
    const grid = el('div', 'quality-definition-grid');
    grid.append(ours, theirs);
    definitions.replaceChildren(summary, grid);
  }

  function upclipScore(modelId: string): { score: number; rank: number; of: number } | null {
    const u = extras.upclip;
    const id = current?.file.photo;
    const scores = u?.principleScores[modelId];
    if (!scores || !id || !scores[id]) return null;
    const values = Object.values(scores).map((s) => s[principle]);
    return { score: scores[id][principle], rank: rank(values, scores[id][principle]), of: values.length };
  }

  function renderMethods() {
    const r = result();
    const id = current?.file.photo;
    if (!r || !id) return methods.replaceChildren();
    const c = extras.checks;
    const checked: Record<PrincipleId, string> = {
      rhythm: c ? `Parts checked against human labels: repetition agrees on held-out façades (balanced accuracy ${c.rhythm.families.vertical.balancedAccuracy.toFixed(2)} across, ${c.rhythm.families.layer.balancedAccuracy.toFixed(2)} up)` : '',
      groundFloor: c ? `Parts checked against human labels: open share from the model against people’s labels, ρ = ${c.frontage.openShareSpearman.toFixed(2)}` : '',
      materials: c?.materials.dmsTest ? `Parts checked against human labels: material groups right on ${percent(c.materials.dmsTest.groupPixelAccuracy)} of pixels in ${c.materials.dmsTest.images} test photos` : '',
    };
    const rows: [string, string, string][] = [['Image measure (this project’s rule)', OUTCOME_TEXT[r.outcome], checked[principle]]];
    const v1 = extras.panelV1?.photos[id]?.[principle];
    if (v1) {
      const total = v1.votes.present + v1.votes.absent + v1.votes.missing;
      const text = v1.consensus === 'ambiguous' ? 'No consensus' : `${v1.consensus === 'present' ? 'Present' : 'Absent'} (${v1.votes[v1.consensus]} of ${total})`;
      const flat = extras.panelV1?.fleissKappa[principle] === null ? 'Said the same for every example photo' : 'AI judgement';
      rows.push(['Simulated panel, present or absent', text, flat]);
    }
    const g = extras.graded?.photos[id]?.[principle];
    if (g && g.median !== null) {
      const rated = g.ratings.filter((x): x is number => x !== null);
      rows.push(['Simulated panel, rated 0–4', `${g.median} (range ${Math.min(...rated)}–${Math.max(...rated)})`, 'AI judgement']);
    }
    for (const m of extras.upclip?.models ?? []) {
      const s = upclipScore(m.id);
      if (s) rows.push([m.name, `${s.score >= 0 ? '+' : ''}${s.score.toFixed(3)} · rank ${s.rank} of ${s.of}`, 'Adaptation: not tested on these principles']);
    }
    const table = el('table', 'agreement-matrix quality-methods-table');
    const head = el('tr');
    for (const h of ['Method', 'For this photo', 'Checked against experts?']) head.append(el('th', undefined, h));
    table.append(head);
    for (const [name, value, note] of rows) {
      const tr = el('tr');
      const th = el('th', undefined, name);
      th.scope = 'row';
      const expert = el('td', 'quality-expert');
      expert.append(el('strong', undefined, 'No'), note ? el('span', undefined, ` · ${note}`) : '');
      tr.append(th, el('td', 'quality-value', value), expert);
      table.append(tr);
    }
    const wrap = el('div', 'agreement-wrap');
    wrap.append(table);
    methods.replaceChildren(
      el('h3', 'panel-heading', 'Methods for this photo'),
      wrap,
      el('p', 'agreement-caption', 'These methods are compared with each other, not with experts. No expert has judged these photos.'),
    );
  }

  function shares(modelId: string): Map<string, number> | undefined {
    if (!current) return undefined;
    const key = `${current.file.photo}:${principle}:${modelId}`;
    const status = current.results.status.get(modelId);
    if (status?.state !== 'ready') return undefined;
    if (!shareCache.has(key)) {
      const regions = current.layers.filter((l) => l.mask) as unknown as Area[];
      shareCache.set(key, attentionShares(status.map, regions, current.file.width, current.file.height));
    }
    return shareCache.get(key);
  }

  function renderAttention() {
    if (!current) return attention.replaceChildren();
    const layers = modelsFor(current.results).filter((m) => current!.results.status.get(m.id)?.state === 'ready');
    const table = el('table', 'agreement-matrix areas-table');
    const head = el('tr');
    head.append(el('th', undefined, 'Evidence'), el('th', undefined, '% of photo'));
    for (const m of layers) {
      const th = el('th', undefined, m.shortName ?? m.name);
      th.scope = 'col';
      th.title = m.name;
      head.append(th);
    }
    table.append(head);
    for (const layer of current.layers.filter((l) => l.mask)) {
      const tr = el('tr');
      const name = el('th', undefined, layer.label);
      name.scope = 'row';
      tr.append(name, el('td', 'areas-share', percent(layer.share)));
      for (const m of layers) {
        const td = el('td');
        const share = shares(m.id)?.get(layer.id);
        if (share === undefined || layer.share < MIN_SHARE) {
          td.textContent = '–';
          td.className = 'agreement-empty';
          if (layer.share < MIN_SHARE) td.title = 'Under 0.5% of the photo: too small to judge';
        } else {
          const ratio = share / layer.share;
          td.textContent = `${ratio.toFixed(1)}×`;
          td.className = 'agreement-cell';
          td.dataset.ratio = String(ratio);
          td.title = `${m.name}: ${percent(share)} of the attention on ${percent(layer.share)} of the photo`;
          td.style.setProperty('--r', String(Math.max(0, Math.min(1, Math.log2(ratio) / 2))));
        }
        tr.append(td);
      }
      table.append(tr);
    }
    const wrap = el('div', 'agreement-wrap');
    wrap.append(table);
    attention.replaceChildren(
      el('h3', 'panel-heading', 'Attention ÷ size of the evidence'),
      wrap,
      el('p', 'agreement-caption', '1.0× = as much as the region’s size alone predicts. Only the image measure’s regions are shown here; the AI judgements and UP-CLIP are never combined with gaze.'),
    );
  }

  function renderAll() {
    const c = extras.checks?.discrimination[principle];
    if (!c) return all.replaceChildren();
    const info = photos();
    const table = el('table', 'agreement-matrix quality-all-table');
    const head = el('tr');
    const reproduction = extras.upclip?.models.find((m) => m.id === 'up-clip-reproduction');
    for (const h of ['Photo', 'Image measure', 'Panel, present/absent', 'Panel, 0–4', reproduction ? 'UP-CLIP reproduction' : '']) {
      if (h) head.append(el('th', undefined, h));
    }
    table.append(head);
    for (const [id, row] of Object.entries(c.perPhoto)) {
      const tr = el('tr');
      if (id === current?.file.photo) tr.className = 'quality-current';
      const th = el('th');
      th.scope = 'row';
      const button = el('button', 'quality-photo-link', info.get(id)?.title ?? id);
      button.type = 'button';
      button.addEventListener('click', () => pickPhoto(id));
      th.append(button);
      const v1 = extras.panelV1?.photos[id]?.[principle];
      const g = extras.graded?.photos[id]?.[principle];
      const u = reproduction ? extras.upclip?.principleScores[reproduction.id]?.[id]?.[principle] : undefined;
      tr.append(
        th,
        el('td', `quality-outcome-${row.outcome}`, OUTCOME_TEXT[row.outcome]),
        el('td', undefined, v1 ? (v1.consensus === 'ambiguous' ? 'No consensus' : v1.consensus === 'present' ? 'Present' : 'Absent') : '–'),
        el('td', undefined, g?.median !== null && g?.median !== undefined ? String(g.median) : '–'),
      );
      if (reproduction) tr.append(el('td', undefined, u === undefined ? '–' : `${u >= 0 ? '+' : ''}${u.toFixed(3)}`));
      table.append(tr);
    }
    const counts = c.outcomes;
    const notes: string[] = [
      `Image measure: ${counts['likely-present']} likely present, ${counts.unclear} unclear, ${counts['likely-absent']} likely absent.`,
    ];
    if (c.sameOnAllPhotos) notes.push('The image measure gives the same outcome on every photo, so it does not tell them apart.');
    if (extras.panelV1?.fleissKappa[principle] === null) notes.push('The present/absent panel gave the same verdict for every photo.');
    const d = extras.graded?.discrimination[principle];
    if (d) notes.push(`The 0–4 panel used ${d.distinctMedians} different medians, from ${d.min} to ${d.max}.`);
    const wrap = el('div', 'agreement-wrap');
    wrap.append(table);
    all.replaceChildren(el('h3', 'panel-heading', 'All example photos'), wrap, el('p', 'agreement-caption', notes.join(' ')));
  }

  function render() {
    switchButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(PRINCIPLES[i].id === principle)));
    if (!current) return;
    const r = result();
    current.layers = r ? decodeLayers(current.file, r) : [];
    drawStage();
    renderLegend();
    renderOutcome();
    renderDefinitions();
    renderMethods();
    renderAttention();
    renderAll();
  }

  function showEmpty(text: string) {
    current = null;
    empty.textContent = text;
    stage.replaceChildren(empty);
    for (const node of [legend, outcome, definitions, methods, attention, all]) node.replaceChildren();
    for (const node of [switcher, boxToggle, upclipBlock]) node.hidden = true;
  }

  let requested: Results | null = null;
  onResults(async (results, changedModelId) => {
    const id = results.image.exampleId;
    if (!id) {
      requested = results;
      showEmpty('Qualities are computed in advance for the example photos only.');
      return;
    }
    if (current?.results === results) {
      if (changedModelId) renderAttention();
      return;
    }
    if (requested === results) return;
    requested = results;
    const [file, checks, panelV1, graded, upclip] = await Promise.all([loadQuality(id), loadChecks(), loadPanel(), loadGraded(), loadUpClip()]);
    if (requested !== results) return;
    if (!file) {
      showEmpty('Qualities are computed in advance for the 24 Dutch and Zürich example photos only.');
      return;
    }
    for (const node of [switcher, upclipBlock]) node.hidden = false;
    extras = { checks, panelV1, graded, upclip };
    current = { results, file, layers: [] };
    highlighted = undefined;
    render();
  });
  render();
  panelBlock.id = 'qualities-panel';
  return upclipBlock;
}
