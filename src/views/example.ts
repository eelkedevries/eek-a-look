import { COMPARISON_CAVEAT, COMPARISON_INTRO, COMPARISONS, MEASURED_NOTE, SCANPATH_NOTE, type ComparisonText } from '../content/comparisons';
import type { ComparisonManifest, ExamplePhoto } from '../examples';
import { attentionShares, decodeRle, type Area } from '../maps/areas';
import { difference, type SaliencyMap } from '../maps/saliency-map';
import { decodeMap, type PrecomputedMap } from '../models/deepgaze';
import type { Scanpaths } from '../models/measured';
import { models } from '../models/registry';
import { mapLabel, type ModelSpec } from '../models/types';
import { BLUE_ORANGE, cssColour } from '../render/colormaps';
import { drawScanpath } from '../render/fixations';
import { drawDifference, drawGreyed, drawHeatmap, sharedRange, type HeatRange } from '../render/heatmap';

/** Content hashes of the data folders, set by vite.config.ts, so a stale cached copy is never used. */
declare const __COMPARISONS_VERSION__: string;
/** The images that have DeepGaze3.5-VL scanpaths, set by vite.config.ts. */
declare const __SCANPATH_PHOTOS__: string[];

const BASE = import.meta.env.BASE_URL;
const WIDTH = 640;
/** A difference smaller than this (0.05 percentage points) counts as no change. */
const NO_CHANGE = 0.0005;

type MapChoice = 'photo' | (string & {});
/** The predicted points over A and B (prompt 076): none, MSDB's sampled fixations or DeepGaze3.5-VL's scanpaths. */
type Overlay = 'none' | 'fixations' | 'scanpaths';

/** The scanpath measure counts the first K fixations after the starting one, numbered 1 to K in a Path. */
const K = 7;
/** Scanpaths drawn per image: the first ones of the stored set, not selected. */
const PATHS_SHOWN = 3;
// Orange, magenta and green: never the blue of measured gaze.
const PATH_COLOURS = ['#ff9f1c', '#ff4fd8', '#9be15d'];
const SCANPATH_MODEL = 'DeepGaze3.5-VL';
const SCANPATH_SHORT = 'DG3.5-VL';

/**
 * Only DeepGaze MSDB is shown here (prompt 073). Measured gaze exists for the untouched originals only, so it cannot
 * show an edit's effect; it appears only as one chosen participant's gaze path over A (prompt 077).
 */
const predictions = models.filter((m) => m.id === 'deepgaze-msdb');

interface RegionFile {
  example: string;
  width: number;
  height: number;
  method: string;
  regions: { id: string; label: string; share: number; rle: number[] }[];
}

interface FixationFile {
  width: number;
  height: number;
  points: [number, number][];
}

interface ScanpathFile {
  width: number;
  height: number;
  grid: number;
  scanpaths: [number, number][][];
}

/** Each participant's last fixation number within the first 3 s of viewing (tools/scanpaths/window.py). */
interface WindowFile {
  windowMs: number;
  lastFix: [index: number, fix: number][];
}

/** A gaze path in image pixels; n numbers the fixations from 1 for the first after the starting one (prompts 076, 077). */
type Path = { n: number; x: number; y: number }[];

/**
 * Everything one condition needs: its photo, the prediction's map (null where it has none), MSDB's sampled fixations,
 * DeepGaze3.5-VL's scanpaths and, for an original, the measured gaze paths.
 */
interface Condition {
  photo: ExamplePhoto;
  bitmap: ImageBitmap;
  maps: Map<string, SaliencyMap | null>;
  scanpaths: Scanpaths | null;
  window: WindowFile | null;
  fixations: FixationFile | null;
  predicted: Path[] | null;
}

interface Loaded {
  text: ComparisonText;
  a: Condition;
  b: Condition;
  regions: Area[];
  maskSize: { width: number; height: number };
}

const fetchJson = <T>(url: string): Promise<T | null> =>
  fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null);


async function loadCondition(photo: ExamplePhoto): Promise<Condition> {
  const bitmap = createImageBitmap(await (await fetch(`${BASE}examples/${photo.file}`)).blob());
  const version = `?v=${__COMPARISONS_VERSION__}`;
  const [maps, fixations, predicted, scanpaths, window] = await Promise.all([
    Promise.all(
      predictions.map(async (m) => {
        const payload = await fetchJson<PrecomputedMap>(`${BASE}precomputed/${m.id}/${photo.id}.json`);
        return [m.id, payload && decodeMap(payload)] as [string, SaliencyMap | null];
      }),
    ),
    fetchJson<FixationFile>(`${BASE}precomputed/deepgaze-msdb-fixations/${photo.id}.json${version}`),
    __SCANPATH_PHOTOS__.includes(photo.id) ? fetchJson<ScanpathFile>(`${BASE}precomputed/deepgaze35-vl/${photo.id}.json${version}`) : null,
    photo.measured ? fetchJson<Scanpaths>(`${BASE}precomputed/measured/${photo.id}.scanpaths.json`) : null,
    // Only the A images of the comparisons have one; an edited image has no measured gaze at all.
    photo.measured && !photo.editOf ? fetchJson<WindowFile>(`${BASE}precomputed/measured/${photo.id}.window3s.json${version}`) : null,
  ]);
  return {
    photo,
    bitmap: await bitmap,
    maps: new Map(maps),
    scanpaths,
    window,
    fixations,
    // The model's 0–99 grid to pixels as predict_scanpath.py of the DeepGaze3.5-VL repository (x × width / 100). Its
    // first fixation is the starting point, left out as the fixation on the cross is for measured paths (prompt 077).
    predicted:
      predicted &&
      predicted.scanpaths.map((path) => path.slice(1).map(([gx, gy], i) => ({ n: i + 1, x: (gx * predicted.width) / predicted.grid, y: (gy * predicted.height) / predicted.grid }))),
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const points = (d: number) => `${d >= NO_CHANGE ? '+' : d <= -NO_CHANGE ? '−' : '±'}${Math.abs(d * 100).toFixed(2)}`;
const short = (m: ModelSpec) => m.shortName ?? m.name;
/** A density as a multiple of the image average (1 / number of cells), for the colour bars. */
const times = (x: number) => `${x.toFixed(x < 10 ? 1 : 0)}×`;

/** The manipulated area: the same pixels in A and B. */
const areaMask = (loaded: Loaded): Area | undefined => loaded.regions.find((r) => r.id === loaded.text.area.id);

/** The sum of a map's predicted gaze density over the manipulated area: the share of predicted fixations in it, as the Areas view computes it. */
function share(loaded: Loaded, condition: Condition, layer: string): number | null {
  const map = condition.maps.get(layer);
  const area = areaMask(loaded);
  if (!map || !area) return null;
  const { width, height } = loaded.maskSize;
  return attentionShares(map, [area], width, height).get(area.id) ?? null;
}

/** Whether a point in image pixels lies in the area; as inside() in tools/scanpaths/summary.py. */
function inArea(area: Area, mask: { width: number; height: number }, photo: ExamplePhoto, x: number, y: number): boolean {
  const mx = Math.floor((x * mask.width) / photo.width);
  const my = Math.floor((y * mask.height) / photo.height);
  return mx >= 0 && mx < mask.width && my >= 0 && my < mask.height && area.mask[my * mask.width + mx] === 1;
}

/** How many of the paths have a fixation in the manipulated area among their first `last` after the start, and of how many. */
function reach(loaded: Loaded, condition: Condition, paths: Path[] | null, last = K): { hits: number; n: number } | null {
  const area = areaMask(loaded);
  if (!paths || !paths.length || !area) return null;
  const hits = paths.filter((path) => path.some(({ n, x, y }) => n >= 1 && n <= last && inArea(area, loaded.maskSize, condition.photo, x, y))).length;
  return { hits, n: paths.length };
}

/**
 * The measured gaze paths of prompt 077 within their first 3 s (the owner's decision of 2026-10-25: DeepGaze3.5-VL
 * predicts 3 s), numbered as drawn there: the database's fixation number minus one.
 */
function measuredPaths(condition: Condition): Path[] | null {
  const { scanpaths, window } = condition;
  if (!scanpaths || !window) return null;
  const last = new Map(window.lastFix);
  return scanpaths.participants.map((p) => p.fixations.filter(([fix]) => fix <= (last.get(p.index) ?? 1)).map(([fix, x, y]) => ({ n: fix - 1, x, y })));
}

/** The binomial standard error of a share. */
const standardError = ({ hits, n }: { hits: number; n: number }) => Math.sqrt(((hits / n) * (1 - hits / n)) / n);
const share1 = (x: number) => `${(x * 100).toFixed(1)}%`;

/** The direction of the effect, from the sign of B − A. */
function direction(d: number): string {
  if (Math.abs(d) < NO_CHANGE) return 'no change (|B − A| under 0.05 points)';
  return d > 0 ? 'higher predicted gaze density in B' : 'lower predicted gaze density in B';
}

/** Outlines a mask on a canvas twice its size. */
function drawOutline(canvas: HTMLCanvasElement, mask: Uint8Array | undefined, width: number, height: number): void {
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!mask) return;
  const image = context.createImageData(canvas.width, canvas.height);
  const d = image.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - width] || !mask[i + width];
      if (!edge) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const k = ((y * scale + dy) * canvas.width + x * scale + dx) * 4;
          d[k] = 127;
          d[k + 1] = 255;
          d[k + 2] = 212;
          d[k + 3] = 255;
        }
      }
    }
  }
  context.putImageData(image, 0, 0);
}

/** MSDB's sampled fixations as small dots, sized for the displayed width. */
function drawDots(context: CanvasRenderingContext2D, file: FixationFile, scale: number, cssPx: number): void {
  const r = 1.6 * cssPx;
  context.beginPath();
  for (const [x, y] of file.points) {
    const cx = x * scale;
    const cy = y * scale;
    context.moveTo(cx + r, cy);
    context.arc(cx, cy, r, 0, 2 * Math.PI);
  }
  context.lineWidth = 0.8 * cssPx;
  context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  context.stroke();
  context.fillStyle = 'rgb(255, 228, 92)';
  context.fill();
}

/** Scanpaths as numbered circles joined by lines, in the manner of the gaze paths of Suurenbroek & Spanjar (2023). */
function drawPaths(context: CanvasRenderingContext2D, paths: Path[], scale: number, cssPx: number): void {
  const r = 8 * cssPx;
  context.lineJoin = 'round';
  paths.forEach((path, i) => {
    const colour = PATH_COLOURS[i % PATH_COLOURS.length];
    const at = path.map(({ x, y }) => [x * scale, y * scale] as const);
    for (const [width, style] of [[4.5 * cssPx, 'rgba(0, 0, 0, 0.7)'], [2 * cssPx, colour]] as const) {
      context.beginPath();
      at.forEach(([x, y], j) => (j ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.lineWidth = width;
      context.strokeStyle = style;
      context.stroke();
    }
    context.font = `700 ${10 * cssPx}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    path.forEach(({ n }, j) => {
      const [x, y] = at[j];
      context.beginPath();
      context.arc(x, y, r, 0, 2 * Math.PI);
      context.fillStyle = colour;
      context.fill();
      context.lineWidth = 1.5 * cssPx;
      context.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      context.stroke();
      context.fillStyle = '#111';
      context.fillText(String(n), x, y + 0.5 * cssPx);
    });
  });
}

/** Draws the chosen points over one condition; returns its tag, or the reason there is nothing to show. */
function drawOverlay(fig: Figure, condition: Condition, overlay: Overlay): { tag: string } | { note: string } | null {
  const canvas = fig.points;
  const photo = condition.photo;
  canvas.width = WIDTH * 2;
  canvas.height = Math.round((canvas.width * photo.height) / photo.width);
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const scale = canvas.width / photo.width;
  const cssPx = canvas.width / (fig.frame.clientWidth || 360);
  if (overlay === 'fixations') {
    if (!condition.fixations) return { note: 'Not available' };
    drawDots(context, condition.fixations, scale, cssPx);
    return { tag: `Predicted fixations · DG MSDB` };
  }
  if (overlay === 'scanpaths') {
    if (!condition.predicted) return { note: 'Not yet computed' };
    drawPaths(context, condition.predicted.slice(0, PATHS_SHOWN), scale, cssPx);
    return { tag: `Predicted scanpaths · ${SCANPATH_SHORT} · ${PATHS_SHOWN} of ${condition.predicted.length}` };
  }
  return null;
}

interface ColourBar {
  root: HTMLElement;
  ticks: [HTMLElement, HTMLElement, HTMLElement];
  key: [HTMLElement, HTMLElement];
}

/** The difference's colour bar: the scale, and which colour means which image. */
function colourBar(): ColourBar {
  const root = el('div', 'comparison-colourbar');
  const bar = el('span', 'comparison-colourbar-bar');
  bar.style.background = DIFFERENCE_GRADIENT;
  const scale = el('div', 'comparison-colourbar-ticks');
  const ticks: ColourBar['ticks'] = [el('span'), el('span'), el('span')];
  scale.append(...ticks);
  const keys = el('div', 'comparison-colourbar-key');
  const key: ColourBar['key'] = [el('span', 'comparison-key-a'), el('span', 'comparison-key-b')];
  keys.append(...key);
  root.append(bar, scale, keys);
  return { root, ticks, key };
}

interface Figure {
  root: HTMLElement;
  frame: HTMLElement;
  photo: HTMLCanvasElement;
  heat: HTMLCanvasElement;
  outline: HTMLCanvasElement;
  path: HTMLCanvasElement;
  points: HTMLCanvasElement;
  tag: HTMLElement;
  pathTag: HTMLElement;
  note: HTMLElement;
  colours?: ColourBar;
  caption: HTMLElement;
}

function figure(withColourBar = false): Figure {
  const root = el('figure', 'comparison-figure');
  const frame = el('div', 'frame');
  const photo = el('canvas', 'photo');
  const heat = el('canvas', 'layer');
  const outline = el('canvas', 'layer comparison-outline');
  const points = el('canvas', 'layer comparison-points');
  const path = el('canvas', 'layer');
  const tag = el('span', 'predicted-tag');
  const note = el('span', 'cell-note');
  path.hidden = true;
  frame.append(photo, heat, outline, points, path, tag, note);
  const colours = withColourBar ? colourBar() : undefined;
  const caption = el('figcaption');
  // Under the image, so it never covers a fixation.
  const pathTag = el('p', 'comparison-path-tag');
  pathTag.hidden = true;
  root.append(frame, ...(colours ? [colours.root] : []), caption, pathTag);
  for (const canvas of [heat, outline, points, path]) canvas.setAttribute('aria-hidden', 'true');
  return { root, frame, photo, heat, outline, points, path, tag, pathTag, note, colours, caption };
}

const DIFFERENCE_GRADIENT = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => cssColour(BLUE_ORANGE, t)).join(', ')})`;

/**
 * Draws one condition with the chosen prediction on the scale shared by A and B, the manipulated area, the chosen
 * participant's measured gaze path (originals only) and the chosen predicted points.
 */
function paint(fig: Figure, loaded: Loaded, condition: Condition, model: ModelSpec | undefined, range: HeatRange | undefined, highlighted: boolean, participant: number | null, overlay: Overlay): void {
  const h = Math.round((WIDTH * condition.photo.height) / condition.photo.width);
  fig.photo.setAttribute('role', 'img');
  fig.photo.setAttribute('aria-label', condition.photo.title);
  if (!model) {
    fig.photo.width = WIDTH;
    fig.photo.height = h;
    fig.photo.getContext('2d')!.drawImage(condition.bitmap, 0, 0, WIDTH, h);
  } else drawGreyed(fig.photo, condition.bitmap, WIDTH, h);

  const map = model ? condition.maps.get(model.id) : undefined;
  fig.heat.hidden = !map;
  if (map) drawHeatmap(fig.heat, map, WIDTH, h, undefined, range);
  const path = condition.scanpaths?.participants.find((p) => p.index === participant);
  fig.path.hidden = !path;
  fig.pathTag.hidden = !path;
  if (path) {
    drawScanpath(fig.path, path, condition.scanpaths!, WIDTH * 2, h * 2);
    fig.pathTag.textContent = `Measured · participant ${path.index} of ${condition.scanpaths!.observers}`;
  }

  fig.tag.hidden = !map;
  fig.tag.textContent = model ? `${mapLabel(model)} · ${short(model)}${path ? ' · with measured gaze path' : ''}` : '';
  fig.note.textContent = model && !map ? 'Not available' : '';

  fig.outline.hidden = !highlighted;
  drawOutline(fig.outline, highlighted ? areaMask(loaded)?.mask : undefined, loaded.maskSize.width, loaded.maskSize.height);

  const points = drawOverlay(fig, condition, overlay);
  fig.points.hidden = !points || !('tag' in points);
  if (points && 'tag' in points) {
    fig.tag.hidden = false;
    fig.tag.textContent = map ? `${fig.tag.textContent}\n${points.tag}` : points.tag;
  } else if (points) fig.note.textContent = points.note;
}

/** Draws the difference B − A of the chosen prediction over B, with its colour bar: orange where B is higher, blue where A is. */
function paintDifference(fig: Figure, loaded: Loaded, model: ModelSpec | undefined, highlighted: boolean): void {
  const h = Math.round((WIDTH * loaded.b.photo.height) / loaded.b.photo.width);
  drawGreyed(fig.photo, loaded.b.bitmap, WIDTH, h);
  fig.photo.setAttribute('role', 'img');
  fig.photo.setAttribute('aria-label', `Difference between the predicted maps of B and A, over ${loaded.b.photo.title}`);
  const mapA = model ? loaded.a.maps.get(model.id) : null;
  const mapB = model ? loaded.b.maps.get(model.id) : null;
  fig.heat.hidden = !(mapA && mapB);
  const colours = fig.colours!;
  colours.root.hidden = !(mapA && mapB);
  if (mapA && mapB) {
    const top = drawDifference(fig.heat, difference(mapB, mapA), WIDTH, h);
    const cells = mapA.width * mapA.height;
    const [low, mid, high] = colours.ticks;
    low.textContent = `−${times(top * cells)}`;
    mid.textContent = '0';
    high.textContent = `+${times(top * cells)}`;
    const [keyA, keyB] = colours.key;
    keyA.textContent = `Blue: higher in ${loaded.text.labelA}`;
    keyB.textContent = `Orange: higher in ${loaded.text.labelB}`;
  }
  fig.tag.hidden = !(mapA && mapB);
  fig.tag.textContent = model ? `Predicted B − A · ${short(model)}` : '';
  fig.note.textContent = mapA && mapB ? '' : model ? 'Not available' : 'Choose DG MSDB to see the difference';
  fig.outline.hidden = !highlighted;
  drawOutline(fig.outline, highlighted ? areaMask(loaded)?.mask : undefined, loaded.maskSize.width, loaded.maskSize.height);
}

/**
 * The Example section (prompts 058, 066–068, 070): an overview of three design comparisons and, for the chosen one,
 * its question, background, conditions and two possible outcomes; A, B and their difference side by side, the
 * difference with a colour bar; and DeepGaze MSDB's predicted gaze density (prompt 073: the only model shown) summed over the
 * manipulated area in A and in B, whose contrast B − A gives the direction of the effect. The only measured data is one
 * chosen participant's gaze path over A (prompt 077).
 */
export function mountExample(section: HTMLElement, manifest: ComparisonManifest, photoById: (id: string) => ExamplePhoto | undefined, open: (id: string) => void): void {
  const heading = el('h2', 'section-label', 'Example · three design comparisons');
  heading.id = 'example-heading';
  const lead = el('p', 'comparison-lead', COMPARISON_INTRO);
  const cards = el('div', 'comparison-cards');
  const detail = el('article', 'comparison');
  detail.setAttribute('aria-live', 'polite');
  section.replaceChildren(heading, lead, cards, detail);

  const examples = COMPARISONS.flatMap((text) => {
    const entry = manifest.examples.find((e) => e.id === text.id);
    const a = entry && photoById(entry.a);
    const b = entry && photoById(entry.b);
    return entry && a && b ? [{ text, entry, a, b }] : [];
  });

  const cardLinks = examples.map(({ text, a, b }) => {
    const link = el('a', 'comparison-card');
    link.href = `#example-${text.id}`;
    const thumbs = el('span', 'comparison-thumbs');
    for (const [photo, label] of [
      [a, 'A'],
      [b, 'B'],
    ] as const) {
      const img = el('img');
      img.src = `${BASE}examples/${photo.file.replace(/\.jpg$/, '-thumb.jpg')}`;
      img.alt = '';
      img.width = 320;
      img.height = 240;
      img.loading = 'lazy';
      const wrap = el('span', 'comparison-thumb');
      wrap.append(img, el('span', 'comparison-thumb-label', label));
      thumbs.append(wrap);
    }
    const name = el('span', 'comparison-card-title', `${text.number} · ${text.title}`);
    name.append(el('small', '', text.place));
    link.append(thumbs, name, el('span', 'comparison-card-question', text.question));
    link.addEventListener('click', (event) => {
      event.preventDefault();
      history.replaceState(null, '', link.href);
      void select(text.id, true);
    });
    cards.append(link);
    return link;
  });

  const cache = new Map<string, Promise<Loaded>>();
  function load(id: string): Promise<Loaded> {
    if (!cache.has(id)) {
      const found = examples.find((e) => e.text.id === id)!;
      const pending = (async () => {
        const [a, b, regionFile] = await Promise.all([
          loadCondition(found.a),
          loadCondition(found.b),
          fetchJson<RegionFile>(`${BASE}precomputed/comparisons/${id}.json?v=${__COMPARISONS_VERSION__}`),
        ]);
        if (!regionFile) throw new Error('The regions could not be loaded.');
        const length = regionFile.width * regionFile.height;
        const regions: Area[] = regionFile.regions.map((r) => ({ ...r, group: 'element', mask: decodeRle(r.rle, length) }));
        return { text: found.text, a, b, regions, maskSize: { width: regionFile.width, height: regionFile.height } };
      })();
      pending.catch(() => cache.delete(id));
      cache.set(id, pending);
    }
    return cache.get(id)!;
  }

  let shown: string | undefined;
  async function select(id: string, scroll: boolean) {
    if (!examples.some((e) => e.text.id === id)) return;
    shown = id;
    cardLinks.forEach((link, i) => link.setAttribute('aria-current', String(examples[i].text.id === id)));
    if (scroll) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!detail.firstChild || detail.dataset.id !== id) detail.replaceChildren(el('p', 'stage-empty', 'Loading the example…'));
    try {
      const loaded = await load(id);
      if (shown === id) render(loaded);
    } catch {
      if (shown === id) detail.replaceChildren(el('p', 'stage-empty', 'This example could not be loaded.'));
    }
  }

  function render(loaded: Loaded) {
    const { text } = loaded;
    detail.dataset.id = text.id;
    let choice: MapChoice = 'deepgaze-msdb';
    let highlighted = true;
    let participant: number | null = null;
    let overlay: Overlay = 'none';

    const head = el('header', 'comparison-head');
    head.append(el('p', 'photo-place', `Example ${text.number} · ${text.place}`), el('h3', 'comparison-title', text.title));
    const facts = el('dl', 'comparison-facts');
    const conditions = el('dd');
    const conditionList = el('ul', 'comparison-list');
    for (const [label, description] of [['A', text.conditionA], ['B', text.conditionB]] as const) {
      const item = el('li');
      item.append(el('strong', '', label), ` ${description}`);
      conditionList.append(item);
    }
    const manipulated = el('p');
    manipulated.append(el('em', '', 'Manipulated:'), ` ${text.manipulated}`);
    conditions.append(conditionList, manipulated);
    const outcomes = el('dd');
    const outcomeList = el('ol', 'comparison-list');
    for (const outcome of text.outcomes) outcomeList.append(el('li', '', outcome));
    outcomes.append(outcomeList, el('p', 'muted', 'Hypotheses, not results.'));
    const result = el('dd', 'comparison-result');
    const scanResult = el('dd', 'comparison-result');
    facts.append(
      el('dt', '', 'Question'),
      el('dd', 'comparison-question', text.question),
      el('dt', '', 'Background'),
      el('dd', '', text.background),
      el('dt', '', 'Conditions'),
      conditions,
      el('dt', '', 'Possible outcomes'),
      outcomes,
      el('dt', '', 'What DeepGaze MSDB predicts'),
      result,
      el('dt', '', `What ${SCANPATH_MODEL} predicts`),
      scanResult,
    );

    // Controls: which map, and whether the manipulated area is highlighted.
    const controls = el('div', 'comparison-controls');
    const mapGroup = el('div', 'view-tabs comparison-maps');
    mapGroup.setAttribute('role', 'group');
    mapGroup.setAttribute('aria-label', 'Map');
    const mapChoices: [MapChoice, string][] = [['photo', 'Photo'], ...predictions.map((m): [MapChoice, string] => [m.id, short(m)])];
    const mapButtons = mapChoices.map(([id, label]) => {
      const button = el('button', 'view-tab', label);
      button.type = 'button';
      button.addEventListener('click', () => {
        choice = id;
        update();
      });
      mapGroup.append(button);
      return { id, button };
    });
    const highlightToggle = el('label', 'toggle');
    const highlightBox = el('input');
    highlightBox.type = 'checkbox';
    highlightBox.checked = true;
    highlightBox.addEventListener('change', () => {
      highlighted = highlightBox.checked;
      update();
    });
    highlightToggle.append(highlightBox, ' Highlight manipulated area');
    // Prompt 076: predicted points over A and B.
    const overlayGroup = el('div', 'view-tabs comparison-overlays');
    overlayGroup.setAttribute('role', 'group');
    overlayGroup.setAttribute('aria-label', 'Predicted points');
    const overlayChoices: [Overlay, string][] = [
      ['none', 'No points'],
      ['fixations', 'Fixations · DG MSDB'],
      ['scanpaths', `Scanpaths · ${SCANPATH_SHORT}`],
    ];
    const overlayButtons = overlayChoices.map(([id, label]) => {
      const button = el('button', 'view-tab', label);
      button.type = 'button';
      button.addEventListener('click', () => {
        overlay = id;
        update();
      });
      overlayGroup.append(button);
      return { id, button };
    });
    controls.append(mapGroup, overlayGroup, highlightToggle);
    const scanpaths = loaded.a.scanpaths;
    if (scanpaths) {
      const pathPick = el('label', 'comparison-path-pick', 'Measured gaze path on A');
      const pathSelect = el('select');
      pathSelect.append(new Option('Off', ''));
      for (const p of scanpaths.participants) pathSelect.append(new Option(`Participant ${p.index} · ${p.fixations.length} fixations`, String(p.index)));
      pathSelect.addEventListener('change', () => {
        participant = pathSelect.value ? Number(pathSelect.value) : null;
        update();
      });
      pathPick.append(pathSelect);
      controls.append(pathPick);
    }

    // A, B and the difference B − A, side by side.
    const figA = figure();
    const figB = figure();
    const figDiff = figure(true);
    figA.caption.textContent = text.labelA;
    figB.caption.textContent = text.labelB;
    figDiff.caption.textContent = 'B − A · Difference';
    const stage = el('div', 'comparison-trio');
    stage.append(figA.root, figB.root, figDiff.root);

    const caption = el('p', 'agreement-caption');
    const notes = el('div', 'comparison-notes');
    const links = el('p', 'comparison-links');
    const workspaceLink = (photo: ExamplePhoto, label: string) => {
      const button = el('button', 'link-button', label);
      button.type = 'button';
      button.addEventListener('click', () => open(photo.id));
      return button;
    };
    links.append('Open in the workspace: ', workspaceLink(loaded.a.photo, text.labelA), ' · ', workspaceLink(loaded.b.photo, text.labelB));
    const credit = el('p', 'credit');
    const source = loaded.a.photo.editOf ?? loaded.a.photo.id;
    credit.textContent = `Photo: ${photoById(source)?.title ?? source}, Zürich; Wilming et al. (2017), CC0 1.0. ${[loaded.a.photo, loaded.b.photo]
      .filter((p) => p.editOf)
      .map((p) => `${p.condition}: ${p.changes}.`)
      .join(' ')}`;

    detail.replaceChildren(head, facts, controls, stage, caption, notes, links, credit);

    function update() {
      const model = predictions.find((m) => m.id === choice);
      for (const { id, button } of mapButtons) button.setAttribute('aria-pressed', String(id === choice));
      for (const { id, button } of overlayButtons) button.setAttribute('aria-pressed', String(id === overlay));
      const mapA = model ? loaded.a.maps.get(model.id) : null;
      const mapB = model ? loaded.b.maps.get(model.id) : null;
      const range = mapA && mapB ? sharedRange([mapA, mapB]) : undefined;
      paint(figA, loaded, loaded.a, model, range, highlighted, participant, overlay);
      paint(figB, loaded, loaded.b, model, range, highlighted, null, overlay);
      paintDifference(figDiff, loaded, model, highlighted);
      const path = scanpaths?.participants.find((p) => p.index === participant);
      caption.textContent = [
        model
          ? 'A and B use one colour scale, so their colours compare: brighter = higher predicted gaze density. Difference B − A, over B: orange where the density is higher in B, blue where it is higher in A; the colour bar is in multiples of the image average density.'
          : 'Choose DG MSDB to see where people are predicted to look.',
        {
          none: '',
          fixations: `Yellow dots: ${loaded.a.fixations?.points.length ?? 0} fixations drawn at random from DeepGaze MSDB's map of each image, in no order.`,
          scanpaths: `Numbered circles: the first ${PATHS_SHOWN} of the ${SCANPATH_MODEL} scanpaths of each image, in the predicted order, numbered from 1 for the first fixation after the model's starting point.`,
        }[overlay],
        overlay !== 'none' ? 'The difference B − A shows maps only.' : '',
        path && scanpaths
          ? `Measured gaze path over A: participant ${path.index} of the ${scanpaths.observers} people who viewed the untouched original (Wilming et al. 2017), ${path.fixations.length} fixations in their order.`
          : '',
      ]
        .filter(Boolean)
        .join(' ');
      renderResult(model);
    }

    /** The share of scanpaths that reach the manipulated area among their first K fixations after the start, in A and B, and the measured share in A. */
    function renderScanResult() {
      const { phrase } = text.area;
      const a = reach(loaded, loaded.a, loaded.a.predicted);
      const b = reach(loaded, loaded.b, loaded.b.predicted);
      const measured = reach(loaded, loaded.a, measuredPaths(loaded.a), Infinity);
      const count = (r: { hits: number; n: number }, unit: string) => `${r.hits} of ${r.n} ${unit} · ${share1(r.hits / r.n)}`;
      const sums = el('dl', 'comparison-sums');
      const children: HTMLElement[] = [el('p', 'comparison-result-head', `${SCANPATH_MODEL} · predicted scanpaths with a fixation on ${phrase} among their first ${K} fixations after the start`)];
      if (a && b) {
        const d = b.hits / b.n - a.hits / a.n;
        const se = Math.hypot(standardError(a), standardError(b));
        sums.append(
          el('dt', '', 'A'),
          el('dd', '', count(a, 'scanpaths')),
          el('dt', '', 'B'),
          el('dd', '', count(b, 'scanpaths')),
          el('dt', '', 'B − A'),
          el('dd', '', `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d * 100).toFixed(1)} percentage points (standard error ${(se * 100).toFixed(1)})`),
        );
        children.push(
          sums,
          el(
            'p',
            'comparison-direction',
            Math.abs(d) < 2 * se
              ? 'Within sampling error: the difference is smaller than twice its standard error.'
              : `${d > 0 ? 'More' : 'Fewer'} predicted scanpaths reach the area in B; the difference exceeds twice its standard error.`,
          ),
        );
      } else children.push(el('p', 'muted', `Not yet computed: the ${SCANPATH_MODEL} scanpaths are computed on a laptop graphics card (tools/scanpaths/).`));
      if (measured) {
        const check = el('dl', 'comparison-sums');
        check.append(el('dt', '', 'A, measured, first 3 s'), el('dd', '', count(measured, 'people')));
        children.push(check);
      }
      children.push(
        el(
          'p',
          'muted',
          `How: ${SCANPATH_MODEL} writes a scanpath as eight fixations in order, for about three seconds of free viewing; ${a?.n ?? 100} were drawn per image. Its first fixation is the starting point, which in the model's training data lies at the centre of the image, so it is left out, as the fixation on the central cross is for measured paths. A scanpath counts when any of the next ${K} fixations (1–${K} in the drawing) lands in the outlined area. The model predicts the order of fixations, not their timing. The measured share counts the people who viewed the original photograph (Wilming et al. 2017) with a fixation in the area within the first three seconds of their measured gaze path, the span the model predicts: every fixation after the central cross that starts within 3 s, a median of nine per person rather than the model's seven; there is none for B.`,
        ),
      );
      scanResult.replaceChildren(...children);
    }

    /** DeepGaze MSDB's sums over the manipulated area in A and B, their contrast and its direction. */
    function renderResult(model: ModelSpec | undefined) {
      const { phrase } = text.area;
      if (!model) return result.replaceChildren(el('p', 'muted', 'Choose DG MSDB above the images to see its prediction.'));
      const a = share(loaded, loaded.a, model.id);
      const b = share(loaded, loaded.b, model.id);
      if (a === null || b === null) return result.replaceChildren(el('p', 'muted', `${model.name}: not available.`));
      const sums = el('dl', 'comparison-sums');
      sums.append(
        el('dt', '', 'Σ A'),
        el('dd', '', pct(a)),
        el('dt', '', 'Σ B'),
        el('dd', '', pct(b)),
        el('dt', '', 'B − A'),
        el('dd', '', `${points(b - a)} percentage points`),
      );
      result.replaceChildren(
        el('p', 'comparison-result-head', `${model.name} · predicted gaze density summed over ${phrase}`),
        sums,
        el('p', 'comparison-direction', `Direction: ${direction(b - a)}.`),
        el(
          'p',
          'muted',
          `How: the model’s map is a predicted gaze density that sums to 100% over the whole image. Summing it over that area gives one value per condition, Σ\u00a0A and Σ\u00a0B: the share of predicted fixations that land in the area. Their contrast B\u00a0−\u00a0A gives the direction of the effect: positive means a higher predicted gaze density in B, negative a lower one; under 0.05 points counts as no change.`,
        ),
      );
    }

    function renderNotes() {
      const { phrase, note } = text.area;
      const area = areaMask(loaded);
      const covered = pct(area ? area.mask.reduce((s, v) => s + v, 0) / area.mask.length : 0);
      notes.replaceChildren(
        el('p', 'agreement-caption', `The outlined area, ${phrase}, covers ${covered} of the image: the same pixels in A and B.`),
        el('p', 'agreement-caption', note),
        el('p', 'agreement-caption', SCANPATH_NOTE),
        el('p', 'agreement-caption', MEASURED_NOTE),
        el('p', 'agreement-caption', COMPARISON_CAVEAT),
      );
    }

    renderNotes();
    renderScanResult();
    update();
  }

  const fromHash = () => {
    const match = /^#example-([a-z]+)$/.exec(location.hash);
    if (match) void select(match[1], true);
  };
  window.addEventListener('hashchange', fromHash);

  // The first example loads when the section comes near the screen, so it never slows the first paint.
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      if (!shown) void select(examples[0]?.text.id ?? '', false);
    },
    { rootMargin: '400px' },
  );
  observer.observe(section);
  fromHash();
}
