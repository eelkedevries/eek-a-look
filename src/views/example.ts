import { COMPARISON_CAVEAT, COMPARISON_INTRO, COMPARISONS, MEASURED_NOTE, type ComparisonText } from '../content/comparisons';
import type { ComparisonManifest, ExamplePhoto } from '../examples';
import { attentionShares, decodeRle, type Area } from '../maps/areas';
import { difference, type SaliencyMap } from '../maps/saliency-map';
import { decodeMap, type PrecomputedMap } from '../models/deepgaze';
import { models } from '../models/registry';
import { mapLabel, type ModelSpec } from '../models/types';
import { BLUE_ORANGE, cssColour } from '../render/colormaps';
import { drawDifference, drawGreyed, drawHeatmap, sharedRange, type HeatRange } from '../render/heatmap';

/** Content hashes of the data folders, set by vite.config.ts, so a stale cached copy is never used. */
declare const __COMPARISONS_VERSION__: string;

const BASE = import.meta.env.BASE_URL;
const WIDTH = 640;
/** A difference smaller than this (0.05 percentage points) counts as no change. */
const NO_CHANGE = 0.0005;

type MapChoice = 'photo' | (string & {});

/**
 * Only DeepGaze MSDB is shown here (prompt 073). Measured gaze is left out: it exists for untouched originals only, so it
 * cannot show an edit's effect.
 */
const predictions = models.filter((m) => m.id === 'deepgaze-msdb');

interface RegionFile {
  example: string;
  width: number;
  height: number;
  method: string;
  regions: { id: string; label: string; share: number; rle: number[] }[];
}

/** Everything one condition needs: its photo and the prediction's map (null where it has none). */
interface Condition {
  photo: ExamplePhoto;
  bitmap: ImageBitmap;
  maps: Map<string, SaliencyMap | null>;
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
  const maps = new Map<string, SaliencyMap | null>(
    await Promise.all(
      predictions.map(async (m) => {
        const payload = await fetchJson<PrecomputedMap>(`${BASE}precomputed/${m.id}/${photo.id}.json`);
        return [m.id, payload && decodeMap(payload)] as [string, SaliencyMap | null];
      }),
    ),
  );
  return { photo, bitmap: await bitmap, maps };
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
  tag: HTMLElement;
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
  const tag = el('span', 'predicted-tag');
  const note = el('span', 'cell-note');
  frame.append(photo, heat, outline, tag, note);
  const colours = withColourBar ? colourBar() : undefined;
  const caption = el('figcaption');
  root.append(frame, ...(colours ? [colours.root] : []), caption);
  for (const canvas of [heat, outline]) canvas.setAttribute('aria-hidden', 'true');
  return { root, frame, photo, heat, outline, tag, note, colours, caption };
}

const DIFFERENCE_GRADIENT = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => cssColour(BLUE_ORANGE, t)).join(', ')})`;

/** Draws one condition with the chosen prediction on the scale shared by A and B, and the manipulated area. */
function paint(fig: Figure, loaded: Loaded, condition: Condition, model: ModelSpec | undefined, range: HeatRange | undefined, highlighted: boolean): void {
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
  fig.tag.hidden = !map;
  fig.tag.textContent = model ? `${mapLabel(model)} · ${short(model)}` : '';
  fig.note.textContent = model && !map ? 'Not available' : '';

  fig.outline.hidden = !highlighted;
  drawOutline(fig.outline, highlighted ? areaMask(loaded)?.mask : undefined, loaded.maskSize.width, loaded.maskSize.height);
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
 * manipulated area in A and in B, whose contrast B − A gives the direction of the effect. Predictions only.
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
    controls.append(mapGroup, highlightToggle);

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
      const mapA = model ? loaded.a.maps.get(model.id) : null;
      const mapB = model ? loaded.b.maps.get(model.id) : null;
      const range = mapA && mapB ? sharedRange([mapA, mapB]) : undefined;
      paint(figA, loaded, loaded.a, model, range, highlighted);
      paint(figB, loaded, loaded.b, model, range, highlighted);
      paintDifference(figDiff, loaded, model, highlighted);
      caption.textContent = model
        ? 'A and B use one colour scale, so their colours compare: brighter = higher predicted gaze density. Difference B − A, over B: orange where the density is higher in B, blue where it is higher in A; the colour bar is in multiples of the image average density.'
        : 'Choose DG MSDB to see where people are predicted to look.';
      renderResult(model);
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
        el('p', 'agreement-caption', MEASURED_NOTE),
        el('p', 'agreement-caption', COMPARISON_CAVEAT),
      );
    }

    renderNotes();
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
