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
  /** Ground floor only (prompt 062): a frontage grade adapted from the Urban Design Compendium. */
  grade?: { value: string | null; source: string; byFieldOfView: Record<string, string | null> | null };
}

interface QualityFile {
  photo: string;
  width: number;
  height: number;
  /** Study images (prompt 052): a design rendering or a 360° panorama. */
  imageKind?: 'render' | 'panorama';
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
  imageKind?: 'render' | 'panorama';
}

const KIND_TEXT: Record<'render' | 'panorama', string> = { render: 'Design rendering', panorama: '360° panorama' };

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
    'The ground floor is the façade up to 4 m above the street, from the horizon and an eye-height camera. Per image column: open where entrances or shopfronts cover at least 30% of it, transparent where windows do, closed otherwise. Glazing the window model misses counts as closed. Frontage grade: entrances, shopfronts and windows per 100 m of frontage within 60 m, and the blind or passive share, graded A–E after the Urban Design Compendium (Table 5.3); entrances stand in for premises. Lengths assume a 60° lens (45° and 75° give the range). A check by eye found doors missed and first-floor windows counted.',
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
  countedFrontageM: 'Frontage counted (within 60 m)',
  entrancesPer100m: 'Entrances per 100 m',
  openingsPer100m: 'Entrances, shopfronts and windows per 100 m',
  blindPassiveShare: 'Blind or passive (closed or windows only)',
  shopfronts: 'Shopfronts found',
  groundFloorWindows: 'Ground-floor windows found',
};
const COUNTS = new Set(['entrances', 'facadeCells', 'distinctZones', 'windowInstances', 'balconyInstances', 'shopfronts', 'groundFloorWindows']);

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
  if (key === 'countedFrontageM') return `${Math.round(value)} m`;
  if (key.endsWith('Per100m')) return value.toFixed(1);
  return COUNTS.has(key) ? String(value) : percent(value);
}

/** The ground floor's adapted frontage grade (prompt 062), or why there is none. */
function gradeLine(r: PrincipleResult): HTMLElement | null {
  if (!r.grade) return null;
  const line = el('p', 'quality-grade');
  if (!r.grade.value) {
    line.textContent = 'No frontage grade: less than 20 m of frontage within 60 m of the camera.';
    return line;
  }
  line.append(
    'Frontage grade ',
    el('strong', undefined, r.grade.value),
    el(
      'small',
      undefined,
      ` · adapted from the Urban Design Compendium (Table 5.3), estimated from the photo${r.grade.value.includes('–') ? '; the range depends on the assumed lens' : ''}. Not an expert grade; doors are often missed, so it tends to be low.`,
    ),
  );
  return line;
}

/** Evidence regions decoded to masks; line evidence keeps its segments. */
type Layer = Evidence & { mask?: Uint8Array };

function decodeLayers(file: QualityFile, result: PrincipleResult): Layer[] {
  return result.evidence.map((e) => (e.rle ? { ...e, mask: decodeRle(e.rle, file.width * file.height) } : { ...e }));
}

/** Line style per principle, so all three can be drawn at once (prompt 055): solid, dashed, dotted. */
const STYLE: Record<PrincipleId, { name: string; on: (x: number, y: number) => boolean; swatch: string }> = {
  rhythm: { name: 'solid lines', on: () => true, swatch: 'solid' },
  groundFloor: { name: 'dashed', on: (x, y) => (x + y) % 6 < 4, swatch: 'dashed' },
  materials: { name: 'dotted', on: (x, y) => (x + y) % 4 < 2, swatch: 'dotted' },
};

type Keyed = Layer & { principle: PrincipleId; key: string };

/**
 * Draw the evidence of all three principles at twice the mask size: the regions that support or count against a
 * principle as outlines in its line style, filled only when highlighted; context regions and lines only when
 * highlighted.
 */
function drawEvidence(canvas: HTMLCanvasElement, layers: Keyed[], width: number, height: number, highlighted?: string): void {
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const image = new ImageData(canvas.width, canvas.height);
  const d = image.data;
  const paint = (x: number, y: number, rgb: number[], alpha: number) => {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const k = ((y * scale + dy) * canvas.width + x * scale + dx) * 4;
        if (d[k + 3] >= alpha) continue;
        d[k] = rgb[0];
        d[k + 1] = rgb[1];
        d[k + 2] = rgb[2];
        d[k + 3] = alpha;
      }
    }
  };
  for (const layer of layers) {
    const on = layer.key === highlighted;
    if (!layer.mask || (layer.role === 'context' && !on)) continue;
    const rgb = [1, 3, 5].map((i) => parseInt(ROLE_COLOUR[layer.role].slice(i, i + 2), 16));
    const style = STYLE[layer.principle].on;
    const m = layer.mask;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!m[i]) continue;
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1 || !m[i - 1] || !m[i + 1] || !m[i - width] || !m[i + width];
        if (edge && (on || style(x, y))) paint(x, y, rgb, 255);
        else if (on) paint(x, y, rgb, 130);
      }
    }
  }
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(image, 0, 0);
  const lines = layers.find((l) => l.lines && l.key === highlighted);
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
    if (label) ctx.fillText(label.slice(0, 36), x0 + 4, Math.max(20, y0 - 6));
  }
}

const rank = (values: number[], value: number) => values.filter((v) => v > value).length + 1;
const SHORT: Record<PrincipleId, string> = { rhythm: 'Rhythm', groundFloor: 'Ground floor', materials: 'Materials' };
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`;
const verdictV1 = (v: { consensus: string }) => (v.consensus === 'ambiguous' ? 'No consensus' : v.consensus === 'present' ? 'Present' : 'Absent');

/**
 * The Qualities view: per example photo, the image measures of all three design principles at once (prompt 055),
 * with their evidence on the photo and one legend, the definitions behind them, the other methods' verdicts on the
 * same photo, and attention ÷ size for the evidence regions. Uploads get a short message.
 */
export function mountQualities(panel: HTMLElement, pickPhoto: (id: string) => void, photos: () => Map<string, PhotoInfo>): HTMLElement {
  let showBoxes = false;
  let highlighted: string | undefined;
  let current: { results: Results; file: QualityFile; layers: Keyed[] } | null = null;
  let extras: { checks: ChecksFile | null; panelV1: PanelFile | null; graded: GradedFile | null; upclip: UpClipFile | null } = {
    checks: null,
    panelV1: null,
    graded: null,
    upclip: null,
  };
  const shareCache = new Map<string, Map<string, number>>();

  const stage = el('div', 'stage');
  const frame = el('div', 'frame');
  const photo = el('canvas', 'photo');
  const evidenceLayer = el('canvas', 'layer');
  const boxLayer = el('canvas', 'layer');
  const tag = el('span', 'predicted-tag areas-tag', 'Image measures · not an expert judgement');
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
  const outcome = el('div', 'quality-outcomes');
  const definitions = el('details', 'quality-definitions');
  const methods = el('div', 'quality-methods');
  const attention = el('div', 'quality-attention');
  const all = el('div', 'quality-all');
  const panelBlock = el('div', 'areas-panel');
  const upclipBlock = el('div', 'quality-upclip');
  const body = el('div', 'quality-body');
  body.append(stage, boxToggle, legend, outcome, definitions, methods, attention, all, panelBlock, upclipBlock);
  panel.replaceChildren(body);

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
    const graded = extras.graded?.photos[current?.file.photo ?? ''];
    const boxes = graded ? PRINCIPLES.flatMap(({ id }) => (graded[id]?.boxes ?? []).map((b) => ({ ...b, label: `${SHORT[id]}: ${b.label}` }))) : [];
    boxToggle.hidden = !boxes.length;
    if (!current) return;
    drawBoxes(boxLayer, showBoxes ? boxes : [], current.file.width, current.file.height);
    tag.textContent = showBoxes ? 'Image measures · boxes: AI judgement · neither is an expert judgement' : 'Image measures · not an expert judgement';
  }

  /** One legend in three labelled parts, one per principle, with its line style (prompt 055). */
  function renderLegend() {
    if (!current) return legend.replaceChildren();
    const items: HTMLElement[] = [];
    for (const { id, name } of PRINCIPLES) {
      const layers = current.layers.filter((l) => l.principle === id);
      if (!layers.length) continue;
      items.push(el('li', 'area-legend-heading', `${name} · ${STYLE[id].name}`));
      for (const layer of layers) {
        const item = el('li');
        const button = el('button', 'area-legend-item');
        button.type = 'button';
        const swatch = el('span', `area-swatch quality-swatch-${layer.lines ? 'line' : STYLE[id].swatch}`);
        swatch.style.color = ROLE_COLOUR[layer.role];
        swatch.style.background = layer.lines || STYLE[id].swatch === 'solid' ? ROLE_COLOUR[layer.role] : 'none';
        const share = layer.lines ? '' : ` ${percent(layer.share)}`;
        button.append(swatch, `${layer.label} `, el('span', 'area-percent', `${ROLE_TEXT[layer.role]}${share}`));
        const show = (on: boolean) => {
          highlighted = on ? layer.key : undefined;
          if (current) drawEvidence(evidenceLayer, current.layers, current.file.width, current.file.height, highlighted);
        };
        button.addEventListener('mouseenter', () => show(true));
        button.addEventListener('mouseleave', () => show(false));
        button.addEventListener('focus', () => show(true));
        button.addEventListener('blur', () => show(false));
        item.append(button);
        items.push(item);
      }
    }
    legend.replaceChildren(...items);
  }

  /** The three outcomes side by side, each with its reasons, its numbers (collapsed) and how it was found. */
  function renderOutcome() {
    if (!current) return outcome.replaceChildren();
    const kind = current.file.imageKind;
    const cards = PRINCIPLES.map(({ id, name }) => {
      const r = current!.file.principles[id];
      const card = el('section', 'quality-card');
      card.append(el('h3', 'quality-card-title', name));
      if (!r) return card;
      const verdict = el('p', 'quality-verdict');
      verdict.append(el('strong', undefined, OUTCOME_TEXT[r.outcome]));
      const reasons = el('ul', 'quality-reasons');
      for (const reason of r.reasons) reasons.append(el('li', undefined, reason));
      const numbers = el('details', 'quality-numbers');
      numbers.append(el('summary', undefined, 'The numbers'));
      const list = el('dl', 'quality-indicators');
      for (const [key, value] of Object.entries(r.indicators)) {
        const label = key.startsWith('material: ') ? `Common material: ${key.slice(10)}` : INDICATORS[key] ?? key;
        list.append(el('dt', undefined, label), el('dd', undefined, formatIndicator(key, value)));
      }
      numbers.append(list, el('p', 'agreement-caption', HOW[id]));
      const grade = id === 'groundFloor' ? gradeLine(r) : null;
      card.append(verdict, reasons, ...(grade ? [grade] : []), numbers);
      return card;
    });
    const grid = el('div', 'quality-card-grid');
    grid.append(...cards);
    outcome.replaceChildren(
      ...(kind ? [el('p', 'quality-kind', KIND_TEXT[kind])] : []),
      el('p', 'quality-verdict-label', 'Image measures'),
      grid,
    );
  }

  function renderDefinitions() {
    const summary = el('summary', undefined, 'Definitions');
    const grid = el('div', 'quality-definition-grid');
    for (const { id, name } of PRINCIPLES) {
      const ours = el('div', 'quality-definition');
      ours.append(el('h4', undefined, `${name}: our definition`), el('p', undefined, DEFINITIONS[id]));
      grid.append(ours);
    }
    const theirs = el('div', 'quality-definition');
    theirs.append(el('h4', undefined, 'In the original study'), el('p', undefined, ORIGINAL));
    grid.append(theirs);
    definitions.replaceChildren(summary, grid);
  }

  function upclipScore(modelId: string, principle: PrincipleId): string | null {
    const id = current?.file.photo;
    const scores = extras.upclip?.principleScores[modelId];
    if (!scores || !id || !scores[id]) return null;
    const values = Object.values(scores).map((s) => s[principle]);
    return `${signed(scores[id][principle])} · rank ${rank(values, scores[id][principle])} of ${values.length}`;
  }

  /** Methods for this photo: one row per method, one column per principle. */
  function renderMethods() {
    const id = current?.file.photo;
    if (!current || !id) return methods.replaceChildren();
    const file = current.file;
    const rows: [string, (p: PrincipleId) => string | null, string][] = [
      ['Image measure (this project’s rule)', (p) => (file.principles[p] ? OUTCOME_TEXT[file.principles[p]!.outcome] : null), 'No · parts checked against human labels'],
    ];
    const v1 = extras.panelV1?.photos[id];
    if (v1) {
      rows.push(['Simulated panel, present or absent', (p) => {
        const v = v1[p];
        if (!v) return null;
        const total = v.votes.present + v.votes.absent + v.votes.missing;
        return v.consensus === 'ambiguous' ? 'No consensus' : `${verdictV1(v)} (${v.votes[v.consensus]} of ${total})`;
      }, 'No · AI judgement']);
    }
    const g = extras.graded?.photos[id];
    if (g) {
      rows.push(['Simulated panel, rated 0–4', (p) => {
        const v = g[p];
        if (!v || v.median === null) return null;
        const rated = v.ratings.filter((x): x is number => x !== null);
        return `${v.median} (range ${Math.min(...rated)}–${Math.max(...rated)})`;
      }, 'No · AI judgement']);
    }
    for (const m of extras.upclip?.models ?? []) {
      rows.push([m.name, (p) => upclipScore(m.id, p), 'No · adaptation, not tested on these principles']);
    }
    const table = el('table', 'agreement-matrix quality-methods-table');
    const head = el('tr');
    for (const h of ['Method', ...PRINCIPLES.map((p) => p.name), 'Checked against experts?']) head.append(el('th', undefined, h));
    table.append(head);
    for (const [name, value, note] of rows) {
      const tr = el('tr');
      const th = el('th', undefined, name);
      th.scope = 'row';
      tr.append(th, ...PRINCIPLES.map(({ id: p }) => el('td', 'quality-value', value(p) ?? '–')), el('td', 'quality-expert', note));
      table.append(tr);
    }
    const c = extras.checks;
    const checked = c
      ? [
          `Rhythm: repetition agrees with human labels on held-out façades (balanced accuracy ${c.rhythm.families.vertical.balancedAccuracy.toFixed(2)} across, ${c.rhythm.families.layer.balancedAccuracy.toFixed(2)} up).`,
          `Ground floor: the open share from the model against people’s labels, ρ = ${c.frontage.openShareSpearman.toFixed(2)}.`,
          c.materials.dmsTest ? `Materials: the material groups are right on ${percent(c.materials.dmsTest.groupPixelAccuracy)} of pixels in ${c.materials.dmsTest.images} test photos.` : '',
        ].join(' ')
      : '';
    const wrap = el('div', 'agreement-wrap');
    wrap.append(table);
    methods.replaceChildren(
      el('h3', 'panel-heading', 'Methods for this photo'),
      wrap,
      el('p', 'agreement-caption', `These methods are compared with each other, not with experts. No expert has judged these photos. ${checked}`),
    );
  }

  function shares(modelId: string): Map<string, number> | undefined {
    if (!current) return undefined;
    const key = `${current.file.photo}:${modelId}`;
    const status = current.results.status.get(modelId);
    if (status?.state !== 'ready') return undefined;
    if (!shareCache.has(key)) {
      const regions = current.layers.filter((l) => l.mask).map((l) => ({ ...l, id: l.key })) as unknown as Area[];
      shareCache.set(key, attentionShares(status.map, regions, current.file.width, current.file.height));
    }
    return shareCache.get(key);
  }

  /** Attention ÷ size for every evidence region, with a row heading per principle. */
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
    for (const { id, name } of PRINCIPLES) {
      const regions = current.layers.filter((l) => l.principle === id && l.mask);
      if (!regions.length) continue;
      const group = el('tr', 'areas-group-row');
      const groupHead = el('th', undefined, name);
      groupHead.colSpan = head.childElementCount;
      group.append(groupHead);
      table.append(group);
      for (const layer of regions) {
        const tr = el('tr');
        const label = el('th', undefined, layer.label);
        label.scope = 'row';
        tr.append(label, el('td', 'areas-share', percent(layer.share)));
        for (const m of layers) {
          const td = el('td');
          const share = shares(m.id)?.get(layer.key);
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
    }
    const wrap = el('div', 'agreement-wrap');
    wrap.append(table);
    attention.replaceChildren(
      el('h3', 'panel-heading', 'Attention ÷ size of the evidence'),
      wrap,
      el('p', 'agreement-caption', '1.0× = as much as the region’s size alone predicts. Only the image measures’ regions are shown here; the AI judgements and UP-CLIP are never combined with gaze.'),
    );
  }

  /** All example photos: the image measure for each principle, with the panel and UP-CLIP under it. */
  function renderAll() {
    const c = extras.checks?.discrimination;
    if (!c) return all.replaceChildren();
    const info = photos();
    const reproduction = extras.upclip?.models.find((m) => m.id === 'up-clip-reproduction');
    const table = el('table', 'agreement-matrix quality-all-table');
    const head = el('tr');
    for (const h of ['Photo', ...PRINCIPLES.map((p) => p.name)]) head.append(el('th', undefined, h));
    table.append(head);
    // The earlier photos first, then the study images under their own heading (prompt 052).
    const ids = Object.keys(c.rhythm.perPhoto);
    const study = ids.filter((id) => info.get(id)?.imageKind);
    for (const id of [...ids.filter((id) => !info.get(id)?.imageKind), ...study]) {
      if (study.length && id === study[0]) {
        const group = el('tr', 'areas-group-row');
        const th = el('th', undefined, 'From published studies · renderings and 360° panoramas');
        th.colSpan = head.childElementCount;
        group.append(th);
        table.append(group);
      }
      const tr = el('tr');
      if (id === current?.file.photo) tr.className = 'quality-current';
      const th = el('th');
      th.scope = 'row';
      const button = el('button', 'quality-photo-link', info.get(id)?.title ?? id);
      button.type = 'button';
      button.addEventListener('click', () => pickPhoto(id));
      th.append(button);
      tr.append(th);
      for (const { id: p } of PRINCIPLES) {
        const row = c[p].perPhoto[id];
        const td = el('td', 'quality-all-cell');
        td.append(el('span', undefined, row ? OUTCOME_TEXT[row.outcome] : '–'));
        const v1 = extras.panelV1?.photos[id]?.[p];
        const g = extras.graded?.photos[id]?.[p];
        const u = reproduction ? extras.upclip?.principleScores[reproduction.id]?.[id]?.[p] : undefined;
        const others = [
          v1 ? `panel ${verdictV1(v1).toLowerCase()}` : null,
          g && g.median !== null ? `0–4: ${g.median}` : null,
          u !== undefined ? `UP-CLIP ${signed(u)}` : null,
        ].filter(Boolean);
        if (others.length) td.append(el('small', undefined, others.join(' · ')));
        tr.append(td);
      }
      table.append(tr);
    }
    const notes: string[] = [];
    for (const { id: p, name } of PRINCIPLES) {
      const counts = c[p].outcomes;
      notes.push(`${name}: ${counts['likely-present']} likely present, ${counts.unclear} unclear, ${counts['likely-absent']} likely absent.`);
      if (c[p].sameOnAllPhotos) notes.push('The image measure gives the same outcome on every photo, so it does not tell them apart.');
      if (extras.panelV1?.fleissKappa[p] === null) notes.push('The present/absent panel gave the same verdict for every photo it judged.');
      const d = extras.graded?.discrimination[p];
      if (d) notes.push(`The 0–4 panel used ${d.distinctMedians} different medians, from ${d.min} to ${d.max}.`);
    }
    const wrap = el('div', 'agreement-wrap');
    wrap.append(table);
    all.replaceChildren(el('h3', 'panel-heading', 'All example photos'), wrap, el('p', 'agreement-caption', notes.join(' ')));
  }

  function render() {
    if (!current) return;
    current.layers = PRINCIPLES.flatMap(({ id }) => {
      const r = current!.file.principles[id];
      return r ? decodeLayers(current!.file, r).map((l) => ({ ...l, principle: id, key: `${id}:${l.id}` })) : [];
    });
    drawStage();
    renderLegend();
    renderOutcome();
    renderDefinitions();
    renderMethods();
    renderAttention();
    renderAll();
  }

  /** No quality file: a message; the UP-CLIP section stays for example photos, which all have scores (prompt 048). */
  function showEmpty(text: string, keepUpClip = false) {
    current = null;
    empty.textContent = text;
    stage.replaceChildren(empty);
    for (const node of [legend, outcome, definitions, methods, attention, all]) node.replaceChildren();
    boxToggle.hidden = true;
    upclipBlock.hidden = !keepUpClip;
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
      showEmpty('Qualities could not be loaded for this photo.', true);
      return;
    }
    upclipBlock.hidden = false;
    extras = { checks, panelV1, graded, upclip };
    current = { results, file, layers: [] };
    highlighted = undefined;
    render();
  });
  render();
  panelBlock.id = 'qualities-panel';
  return upclipBlock;
}
