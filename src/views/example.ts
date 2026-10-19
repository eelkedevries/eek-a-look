import { COMPARISON_CAVEAT, COMPARISON_INTRO, COMPARISONS, MEASURED_NOTE, type ComparisonText } from '../content/comparisons';
import type { ComparisonManifest, ExamplePhoto } from '../examples';
import { attentionShares, decodeRle, type Area } from '../maps/areas';
import { difference, pearson, type SaliencyMap } from '../maps/saliency-map';
import { decodeMap, type PrecomputedMap } from '../models/deepgaze';
import { loadFixations } from '../models/measured';
import { models } from '../models/registry';
import { mapLabel, type ModelSpec } from '../models/types';
import { drawFixations } from '../render/fixations';
import { drawDifference, drawGreyed, drawHeatmap } from '../render/heatmap';

/** Content hashes of the data folders, set by vite.config.ts, so a stale cached copy is never used. */
declare const __COMPARISONS_VERSION__: string;

const BASE = import.meta.env.BASE_URL;
const WIDTH = 640;

type MapChoice = 'photo' | (string & {});

interface RegionFile {
  example: string;
  width: number;
  height: number;
  method: string;
  regions: { id: string; label: string; share: number; rle: number[] }[];
}

/** Everything one condition needs: its photo and every layer's map (null where it has none). */
interface Condition {
  photo: ExamplePhoto;
  bitmap: ImageBitmap;
  maps: Map<string, SaliencyMap | null>;
}

interface Loaded {
  text: ComparisonText;
  a: Condition;
  b: Condition;
  reference?: Condition;
  regions: Area[];
  maskSize: { width: number; height: number };
}

const fetchJson = <T>(url: string): Promise<T | null> =>
  fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null);

/** Classic salience and UNISAL run in the browser elsewhere; for these images their maps were saved by tools/comparisons/. */
function mapUrl(layer: string, id: string): string {
  if (layer === 'classic-salience' || layer === 'unisal') return `${BASE}precomputed/comparisons/${layer}/${id}.json?v=${__COMPARISONS_VERSION__}`;
  return `${BASE}precomputed/${layer}/${id}.json`;
}

async function loadCondition(photo: ExamplePhoto): Promise<Condition> {
  const bitmap = createImageBitmap(await (await fetch(`${BASE}examples/${photo.file}`)).blob());
  const layers = models.filter((m) => m.kind !== 'measured' || photo.measured);
  const maps = new Map<string, SaliencyMap | null>(
    await Promise.all(
      layers.map(async (m) => {
        const payload = await fetchJson<PrecomputedMap>(mapUrl(m.id, photo.id));
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

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const points = (d: number) => `${d >= 0.0005 ? '+' : d <= -0.0005 ? '−' : '±'}${Math.abs(d * 100).toFixed(1)}`;
const short = (m: ModelSpec) => m.shortName ?? m.name;

/** The manipulated area: the same pixels in every image of the comparison. */
const areaMask = (loaded: Loaded): Area | undefined => loaded.regions.find((r) => r.id === loaded.text.area.id);

/** Share of a map's attention inside the manipulated area, as the Areas view computes it. */
function share(loaded: Loaded, condition: Condition, layer: string): number | null {
  const map = condition.maps.get(layer);
  const area = areaMask(loaded);
  if (!map || !area) return null;
  const { width, height } = loaded.maskSize;
  return attentionShares(map, [area], width, height).get(area.id) ?? null;
}

/** The sentence under "What the models predict", built from the numbers so it always matches the table. */
function verdict(loaded: Loaded): string {
  const area = loaded.text.area;
  const predictions = models.filter((m) => m.kind !== 'measured');
  const rows = predictions
    .map((m) => ({ m, a: share(loaded, loaded.a, m.id), b: share(loaded, loaded.b, m.id) }))
    .filter((r): r is { m: ModelSpec; a: number; b: number } => r.a !== null && r.b !== null);
  if (!rows.length) return `${area.label}: not available.`;
  const delta = (r: { a: number; b: number }) => Math.round((r.b - r.a) * 1000) / 1000;
  const more = rows.filter((r) => delta(r) > 0);
  const less = rows.filter((r) => delta(r) < 0);
  const range = (list: typeof rows) => {
    const ds = list.map(delta).sort((x, y) => x - y);
    return ds.length === 1 ? `${points(ds[0])} points` : `${points(ds[0])} to ${points(ds[ds.length - 1])} points`;
  };
  const names = (list: typeof rows) => list.map((r) => r.m.name).join(', ');
  const verb = (list: typeof rows, one: string, many: string) => `${names(list)} ${list.length === 1 ? one : many}`;
  const n = rows.length;
  const where = `on ${area.phrase} in B`;
  if (more.length === n) return `${area.label}: all ${n} models predict a larger share of attention ${where} (${range(more)}).`;
  if (less.length === n) return `${area.label}: all ${n} models predict a smaller share of attention ${where} (${range(less)}).`;
  const same = rows.filter((r) => delta(r) === 0);
  const [lead, other, leadWord, otherWord] = more.length >= less.length ? [more, less, 'larger', 'smaller'] : [less, more, 'smaller', 'larger'];
  const parts = [`${lead.length} of ${n} models predict a ${leadWord} share of attention ${where} (${names(lead)}: ${range(lead)})`];
  if (other.length) parts.push(`${verb(other, 'predicts', 'predict')} a ${otherWord} share (${range(other)})`);
  if (same.length) parts.push(`${verb(same, 'shows', 'show')} no change`);
  return `${area.label}: ${parts.join('; ')}.`;
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

interface Figure {
  root: HTMLElement;
  frame: HTMLElement;
  photo: HTMLCanvasElement;
  heat: HTMLCanvasElement;
  dots: HTMLCanvasElement;
  outline: HTMLCanvasElement;
  tag: HTMLElement;
  note: HTMLElement;
  caption: HTMLElement;
}

function figure(): Figure {
  const root = el('figure', 'comparison-figure');
  const frame = el('div', 'frame');
  const photo = el('canvas', 'photo');
  const heat = el('canvas', 'layer');
  const dots = el('canvas', 'layer fixations');
  dots.style.opacity = '0.65';
  const outline = el('canvas', 'layer comparison-outline');
  const tag = el('span', 'predicted-tag');
  const note = el('span', 'cell-note');
  frame.append(photo, heat, dots, outline, tag, note);
  const caption = el('figcaption');
  root.append(frame, caption);
  for (const canvas of [heat, dots, outline]) canvas.setAttribute('aria-hidden', 'true');
  return { root, frame, photo, heat, dots, outline, tag, note, caption };
}

/** Draws one condition with the chosen map, its measured fixations where it has them, and the manipulated area. */
function paint(fig: Figure, loaded: Loaded, condition: Condition, choice: MapChoice, highlighted: boolean): void {
  const h = Math.round((WIDTH * condition.photo.height) / condition.photo.width);
  const model = models.find((m) => m.id === choice);
  fig.photo.setAttribute('role', 'img');
  fig.photo.setAttribute('aria-label', condition.photo.title);
  if (!model) {
    fig.photo.width = WIDTH;
    fig.photo.height = h;
    fig.photo.getContext('2d')!.drawImage(condition.bitmap, 0, 0, WIDTH, h);
  } else drawGreyed(fig.photo, condition.bitmap, WIDTH, h);

  const map = model ? condition.maps.get(model.id) : undefined;
  fig.heat.hidden = !map;
  if (map) drawHeatmap(fig.heat, map, WIDTH, h);
  fig.tag.hidden = !map;
  fig.tag.className = model?.kind === 'measured' ? 'predicted-tag measured' : 'predicted-tag';
  fig.tag.textContent = model ? (model.kind === 'measured' ? model.name : `${mapLabel(model)} · ${short(model)}`) : '';
  fig.note.textContent = model && !map ? (model.kind === 'measured' ? 'No measured gaze: edited image' : 'Not available') : '';

  fig.dots.hidden = !(model?.kind === 'measured' && map);
  if (!fig.dots.hidden) {
    fig.dots.width = WIDTH;
    fig.dots.height = h;
    loadFixations(condition.photo.id).then(
      (fixations) => drawFixations(fig.dots, fixations, WIDTH, h, fig.frame.clientWidth),
      () => (fig.dots.hidden = true),
    );
  }

  fig.outline.hidden = !highlighted;
  drawOutline(fig.outline, highlighted ? areaMask(loaded)?.mask : undefined, loaded.maskSize.width, loaded.maskSize.height);
}

/** Draws the difference B − A of the chosen prediction over B; measured gaze has none, as B is always edited. */
function paintDifference(fig: Figure, loaded: Loaded, choice: MapChoice, highlighted: boolean): void {
  const h = Math.round((WIDTH * loaded.b.photo.height) / loaded.b.photo.width);
  const model = models.find((m) => m.id === choice);
  drawGreyed(fig.photo, loaded.b.bitmap, WIDTH, h);
  fig.photo.setAttribute('role', 'img');
  fig.photo.setAttribute('aria-label', `Difference between the maps of B and A, over ${loaded.b.photo.title}`);
  const mapA = model && model.kind !== 'measured' ? loaded.a.maps.get(model.id) : null;
  const mapB = model && model.kind !== 'measured' ? loaded.b.maps.get(model.id) : null;
  fig.heat.hidden = !(mapA && mapB);
  if (mapA && mapB) drawDifference(fig.heat, difference(mapB, mapA), WIDTH, h);
  fig.tag.hidden = !(mapA && mapB);
  fig.tag.className = 'predicted-tag';
  fig.tag.textContent = model ? `Predicted B − A · ${short(model)}` : '';
  fig.note.textContent = mapA && mapB ? '' : !model ? 'Choose a model to see the difference' : model.kind === 'measured' ? 'No difference: B has no measured gaze' : 'Not available';
  fig.dots.hidden = true;
  fig.outline.hidden = !highlighted;
  drawOutline(fig.outline, highlighted ? areaMask(loaded)?.mask : undefined, loaded.maskSize.width, loaded.maskSize.height);
}

/**
 * The Example section (prompts 058, 066, 067): an overview of three design comparisons and, for the chosen one,
 * its question, background, conditions, two possible outcomes, what the models predict in the manipulated area,
 * and A, B and their difference side by side for any map. Measured gaze appears only on untouched originals.
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
    return entry && a && b ? [{ text, entry, a, b, reference: entry.reference ? photoById(entry.reference) : undefined }] : [];
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
        const [a, b, reference, regionFile] = await Promise.all([
          loadCondition(found.a),
          loadCondition(found.b),
          found.reference ? loadCondition(found.reference) : Promise.resolve(undefined),
          fetchJson<RegionFile>(`${BASE}precomputed/comparisons/${id}.json?v=${__COMPARISONS_VERSION__}`),
        ]);
        if (!regionFile) throw new Error('The regions could not be loaded.');
        const length = regionFile.width * regionFile.height;
        const regions: Area[] = regionFile.regions.map((r) => ({ ...r, group: 'element', mask: decodeRle(r.rle, length) }));
        return { text: found.text, a, b, reference, regions, maskSize: { width: regionFile.width, height: regionFile.height } };
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
    result.append(el('span', '', verdict(loaded)));
    facts.append(
      el('dt', '', 'Question'),
      el('dd', 'comparison-question', text.question),
      el('dt', '', 'Background'),
      el('dd', '', text.background),
      el('dt', '', 'Conditions'),
      conditions,
      el('dt', '', 'Possible outcomes'),
      outcomes,
      el('dt', '', 'What the models predict'),
      result,
    );

    // Controls: which map, and whether the manipulated area is highlighted.
    const controls = el('div', 'comparison-controls');
    const mapGroup = el('div', 'view-tabs comparison-maps');
    mapGroup.setAttribute('role', 'group');
    mapGroup.setAttribute('aria-label', 'Map');
    const hasMeasured = [loaded.a, loaded.b].some((c) => c.photo.measured);
    const mapChoices: [MapChoice, string][] = [
      ['photo', 'Photo'],
      ...models.filter((m) => m.kind !== 'measured' || hasMeasured).map((m): [MapChoice, string] => [m.id, m.kind === 'measured' ? 'Measured' : short(m)]),
    ];
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
    const figDiff = figure();
    figA.caption.textContent = text.labelA;
    figB.caption.textContent = text.labelB;
    figDiff.caption.textContent = 'B − A · Difference';
    const stage = el('div', 'comparison-trio');
    stage.append(figA.root, figB.root, figDiff.root);

    const caption = el('p', 'agreement-caption');
    const tableWrap = el('div', 'agreement-wrap');
    const table = el('table', 'agreement-matrix comparison-table');
    tableWrap.append(table);
    const notes = el('div', 'comparison-notes');
    const links = el('p', 'comparison-links');
    const workspaceLink = (photo: ExamplePhoto, label: string) => {
      const button = el('button', 'link-button', label);
      button.type = 'button';
      button.addEventListener('click', () => open(photo.id));
      return button;
    };
    links.append('Open in the workspace (all views and the Areas tab): ', workspaceLink(loaded.a.photo, text.labelA), ' · ', workspaceLink(loaded.b.photo, text.labelB));
    if (loaded.reference) links.append(' · ', workspaceLink(loaded.reference.photo, 'Untouched original'));
    const credit = el('p', 'credit');
    const source = loaded.a.photo.editOf ?? loaded.a.photo.id;
    credit.textContent = `Photo: ${photoById(source)?.title ?? source}, Zürich; Wilming et al. (2017), CC0 1.0. ${[loaded.a.photo, loaded.b.photo]
      .filter((p) => p.editOf)
      .map((p) => `${p.condition}: ${p.changes}.`)
      .join(' ')}`;

    detail.replaceChildren(head, facts, controls, stage, caption, tableWrap, notes, links, credit);

    function update() {
      const model = models.find((m) => m.id === choice);
      for (const { id, button } of mapButtons) button.setAttribute('aria-pressed', String(id === choice));
      paint(figA, loaded, loaded.a, choice, highlighted);
      paint(figB, loaded, loaded.b, choice, highlighted);
      paintDifference(figDiff, loaded, choice, highlighted);
      caption.textContent =
        model?.kind === 'measured'
          ? 'Measured gaze with its fixation points, on the untouched original only.'
          : model
            ? 'Brighter = more predicted attention; A and B use the same model. Difference: orange = more predicted attention in B, blue = less, shown over B.'
            : 'Choose a map to see where people are predicted to look.';
    }

    function renderTable() {
      const head = el('tr');
      head.append(el('th', '', ''), el('th', '', 'A'), el('th', '', 'B'), el('th', '', 'B − A'), el('th', '', 'Match A–B (r)'));
      const rows = models
        .filter((m) => m.kind !== 'measured' || hasMeasured)
        .map((m) => {
          const tr = el('tr');
          const name = el('th', m.kind === 'measured' ? 'measured' : '', m.name);
          name.scope = 'row';
          const a = share(loaded, loaded.a, m.id);
          const b = share(loaded, loaded.b, m.id);
          const mapA = loaded.a.maps.get(m.id);
          const mapB = loaded.b.maps.get(m.id);
          const cell = (value: string, title?: string) => {
            const td = el('td', value === '–' ? 'agreement-empty' : '', value);
            if (title) td.title = title;
            return td;
          };
          const none = 'No measured gaze: edited image';
          tr.append(
            name,
            cell(a === null ? '–' : pct(a), a === null ? none : undefined),
            cell(b === null ? '–' : pct(b), b === null ? none : undefined),
            cell(a === null || b === null ? '–' : points(b - a)),
            cell(mapA && mapB ? pearson(mapA, mapB).toFixed(2) : '–'),
          );
          return tr;
        });
      const { phrase, note } = text.area;
      table.replaceChildren(el('caption', 'visually-hidden', `Share of attention on ${phrase}`), el('thead'), el('tbody'));
      table.tHead!.append(head);
      table.tBodies[0].append(...rows);

      const area = areaMask(loaded);
      const covered = pct(area ? area.mask.reduce((s, v) => s + v, 0) / area.mask.length : 0);
      notes.replaceChildren(
        el('p', 'agreement-caption', `Share of all attention on ${phrase} (${covered} of the image, the same pixels in A and B). B − A in percentage points. Match A–B: Pearson r between the two maps (1 = same pattern).`),
        el('p', 'agreement-caption', note),
      );
      if (loaded.reference) {
        const msdb = share(loaded, loaded.reference, 'deepgaze-msdb');
        const measured = share(loaded, loaded.reference, 'measured');
        if (measured !== null && msdb !== null)
          notes.append(
            el('p', 'agreement-caption', `On the untouched original photograph, without the edits, measured gaze puts ${pct(measured)} of attention on ${phrase}; DeepGaze MSDB predicts ${pct(msdb)}.`),
          );
      } else {
        const measured = share(loaded, loaded.a, 'measured');
        const msdb = share(loaded, loaded.a, 'deepgaze-msdb');
        if (measured !== null && msdb !== null)
          notes.append(el('p', 'agreement-caption', `On the original (A), measured gaze puts ${pct(measured)} of attention there and DeepGaze MSDB predicts ${pct(msdb)}: a check of the model on this scene, not of the change.`));
      }
      notes.append(el('p', 'agreement-caption', MEASURED_NOTE), el('p', 'agreement-caption', COMPARISON_CAVEAT));
    }

    renderTable();
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
