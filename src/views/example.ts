import { COMPARISON_CAVEAT, COMPARISON_INTRO, COMPARISONS, MEASURED_NOTE, type ComparisonText, type Measure } from '../content/comparisons';
import type { ComparisonManifest, ExamplePhoto } from '../examples';
import { attentionShares, decodeAreas, decodeRle, type Area, type AreaFile } from '../maps/areas';
import { difference, pearson, type SaliencyMap } from '../maps/saliency-map';
import { decodeMap, type PrecomputedMap } from '../models/deepgaze';
import { loadFixations } from '../models/measured';
import { models } from '../models/registry';
import { mapLabel, type ModelSpec } from '../models/types';
import { drawFixations } from '../render/fixations';
import { drawDifference, drawGreyed, drawHeatmap } from '../render/heatmap';

/** Content hashes of the data folders, set by vite.config.ts, so a stale cached copy is never used. */
declare const __COMPARISONS_VERSION__: string;
declare const __AREAS_VERSION__: string;

const BASE = import.meta.env.BASE_URL;
const WIDTH = 640;

type MapChoice = 'photo' | (string & {});
type Mode = 'pair' | 'slider' | 'difference';

interface RegionFile {
  example: string;
  width: number;
  height: number;
  method: string;
  regions: { id: string; label: string; share: number; rle: number[] }[];
}

/** Everything one condition needs: its photo, every layer's map (null where it has none) and its automatic areas. */
interface Condition {
  photo: ExamplePhoto;
  bitmap: ImageBitmap;
  maps: Map<string, SaliencyMap | null>;
  areas: Area[];
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
  const areaFile = await fetchJson<AreaFile>(`${BASE}precomputed/areas/${photo.id}.json?v=${__AREAS_VERSION__}`);
  return { photo, bitmap: await bitmap, maps, areas: areaFile ? decodeAreas(areaFile) : [] };
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

/**
 * The mask of a measure for one condition: a changed region, an automatic area or the lower third. All are the
 * same pixels in A and B, except an automatic area marked perImage, which comes from each image itself.
 */
function measureMask(loaded: Loaded, measure: Measure, condition: Condition): Area | undefined {
  const { width, height } = loaded.maskSize;
  if (measure.source === 'region') return loaded.regions.find((r) => r.id === measure.id);
  if (measure.source === 'area') return (measure.perImage || condition === loaded.reference ? condition : loaded.a).areas.find((a) => a.id === measure.id);
  const mask = new Uint8Array(width * height);
  mask.fill(1, Math.ceil((height * 2) / 3) * width);
  return { id: measure.id, label: measure.label, group: 'category', share: 1 / 3, rle: [], mask };
}

/** Share of a map's attention inside a measure's mask, as the Areas view computes it. */
function share(loaded: Loaded, measure: Measure, condition: Condition, layer: string): number | null {
  const map = condition.maps.get(layer);
  const area = measureMask(loaded, measure, condition);
  if (!map || !area) return null;
  const { width, height } = loaded.maskSize;
  return attentionShares(map, [area], width, height).get(area.id) ?? null;
}

/** The sentence under "What the models predict" for one measure, built from the numbers so it always matches the table. */
function verdict(loaded: Loaded, measure: Measure): string {
  const predictions = models.filter((m) => m.kind !== 'measured');
  const rows = predictions
    .map((m) => ({ m, a: share(loaded, measure, loaded.a, m.id), b: share(loaded, measure, loaded.b, m.id) }))
    .filter((r): r is { m: ModelSpec; a: number; b: number } => r.a !== null && r.b !== null);
  if (!rows.length) return `${measure.label}: not available.`;
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
  const where = `on ${measure.phrase} in B`;
  if (more.length === n) return `${measure.label}: all ${n} models predict a larger share of attention ${where} (${range(more)}).`;
  if (less.length === n) return `${measure.label}: all ${n} models predict a smaller share of attention ${where} (${range(less)}).`;
  const same = rows.filter((r) => delta(r) === 0);
  const [lead, other, leadWord, otherWord] = more.length >= less.length ? [more, less, 'larger', 'smaller'] : [less, more, 'smaller', 'larger'];
  const parts = [`${lead.length} of ${n} models predict a ${leadWord} share of attention ${where} (${names(lead)}: ${range(lead)})`];
  if (other.length) parts.push(`${verb(other, 'predicts', 'predict')} a ${otherWord} share (${range(other)})`);
  if (same.length) parts.push(`${verb(same, 'shows', 'show')} no change`);
  return `${measure.label}: ${parts.join('; ')}.`;
}

/** Outlines a mask on a canvas twice its size; a dashed line for automatic areas, which differ per image. */
function drawOutline(canvas: HTMLCanvasElement, mask: Uint8Array | undefined, width: number, height: number, dashed: boolean): void {
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
      if (!edge || (dashed && (x + y) % 6 >= 4)) continue;
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

/** Draws one condition with the chosen map, its measured fixations where it has them, and the measure's outline. */
function paint(fig: Figure, loaded: Loaded, condition: Condition, choice: MapChoice, measure: Measure, outlined: boolean): void {
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

  const area = measureMask(loaded, measure, condition);
  fig.outline.hidden = !outlined;
  drawOutline(fig.outline, outlined ? area?.mask : undefined, loaded.maskSize.width, loaded.maskSize.height, measure.source === 'area');
}

/**
 * The Example section (prompt 058): an overview of three design comparisons and, for the chosen one, its
 * question, the change, the expected pattern, what the models predict, and the two images with any map side
 * by side, as a slider or as a difference. Measured gaze appears only on untouched originals.
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
    let mode: Mode = 'pair';
    let measure = text.measures[0];
    let outlined = true;

    const head = el('header', 'comparison-head');
    head.append(el('p', 'photo-place', `Example ${text.number} · ${text.place}`), el('h3', 'comparison-title', text.title));
    const question = el('p', 'comparison-question', text.question);
    const explanation = el('p', '', text.explanation);
    const facts = el('dl', 'comparison-facts');
    const result = el('dd', 'comparison-result');
    for (const m of text.measures) result.append(el('span', '', verdict(loaded, m)));
    const expected = el('dd', '', text.expected);
    expected.append(' ', el('span', 'muted', '(a hypothesis)'));
    facts.append(el('dt', '', 'What changed'), el('dd', '', text.changed), el('dt', '', 'Expected pattern'), expected, el('dt', '', 'What the models predict'), result);

    // Controls: which map, how to compare, and which measure is outlined and tabulated.
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
    const modeGroup = el('div', 'view-tabs comparison-modes');
    modeGroup.setAttribute('role', 'group');
    modeGroup.setAttribute('aria-label', 'Compare');
    const modes: [Mode, string][] = [
      ['pair', 'Side by side'],
      ['slider', 'Slider'],
      ['difference', 'Difference B − A'],
    ];
    const modeButtons = modes.map(([id, label]) => {
      const button = el('button', 'view-tab', label);
      button.type = 'button';
      button.addEventListener('click', () => {
        mode = id;
        update();
      });
      modeGroup.append(button);
      return { id, button };
    });
    const measureGroup = el('div', 'filters comparison-measures');
    measureGroup.setAttribute('role', 'group');
    measureGroup.setAttribute('aria-label', 'Area');
    const measureButtons = text.measures.map((m) => {
      const button = el('button', 'filter', m.label);
      button.type = 'button';
      button.addEventListener('click', () => {
        measure = m;
        update();
      });
      measureGroup.append(button);
      return { m, button };
    });
    const outlineToggle = el('label', 'toggle');
    const outlineBox = el('input');
    outlineBox.type = 'checkbox';
    outlineBox.checked = true;
    outlineBox.addEventListener('change', () => {
      outlined = outlineBox.checked;
      update();
    });
    outlineToggle.append(outlineBox, ' Outline the area');
    controls.append(mapGroup, modeGroup, measureGroup, outlineToggle);

    // Side by side, slider and difference share one stage.
    const stage = el('div', 'comparison-stage');
    const figA = figure();
    const figB = figure();
    const pair = el('div', 'comparison-pair');
    pair.append(figA.root, figB.root);
    const slider = el('div', 'comparison-slider');
    const sliderFigA = figure();
    const sliderFigB = figure();
    sliderFigB.root.classList.add('comparison-slider-top');
    const sliderFrame = el('div', 'comparison-slider-frame');
    sliderFrame.append(sliderFigA.root, sliderFigB.root);
    const range = el('input', 'comparison-range');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.value = '50';
    range.setAttribute('aria-label', `Show more of ${text.labelA} or ${text.labelB}`);
    const rangeLabels = el('div', 'comparison-range-labels');
    rangeLabels.append(el('span', '', text.labelA), el('span', '', text.labelB));
    const applyRange = () => sliderFrame.style.setProperty('--split', `${range.value}%`);
    range.addEventListener('input', applyRange);
    applyRange();
    slider.append(sliderFrame, range, rangeLabels);
    const diff = el('figure', 'comparison-figure comparison-difference');
    const diffFrame = el('div', 'frame');
    const diffPhoto = el('canvas', 'photo');
    const diffLayer = el('canvas', 'layer');
    const diffTag = el('span', 'predicted-tag');
    const diffNote = el('span', 'cell-note');
    diffFrame.append(diffPhoto, diffLayer, diffTag, diffNote);
    const diffCaption = el('figcaption');
    diff.append(diffFrame, diffCaption);
    stage.append(pair, slider, diff);

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

    detail.replaceChildren(head, question, explanation, facts, controls, stage, caption, tableWrap, notes, links, credit);

    function update() {
      const model = models.find((m) => m.id === choice);
      for (const { id, button } of mapButtons) button.setAttribute('aria-pressed', String(id === choice));
      for (const { id, button } of modeButtons) button.setAttribute('aria-pressed', String(id === mode));
      for (const { m, button } of measureButtons) button.setAttribute('aria-pressed', String(m === measure));
      pair.hidden = mode !== 'pair';
      slider.hidden = mode !== 'slider';
      diff.hidden = mode !== 'difference';

      if (mode === 'pair') {
        paint(figA, loaded, loaded.a, choice, measure, outlined);
        paint(figB, loaded, loaded.b, choice, measure, outlined);
        figA.caption.textContent = text.labelA;
        figB.caption.textContent = text.labelB;
      } else if (mode === 'slider') {
        paint(sliderFigA, loaded, loaded.a, choice, measure, outlined);
        paint(sliderFigB, loaded, loaded.b, choice, measure, outlined);
        sliderFigA.caption.textContent = '';
        sliderFigB.caption.textContent = '';
      } else {
        const h = Math.round((WIDTH * loaded.b.photo.height) / loaded.b.photo.width);
        drawGreyed(diffPhoto, loaded.b.bitmap, WIDTH, h);
        const mapA = model && model.kind !== 'measured' ? loaded.a.maps.get(model.id) : null;
        const mapB = model && model.kind !== 'measured' ? loaded.b.maps.get(model.id) : null;
        diffLayer.hidden = !(mapA && mapB);
        if (mapA && mapB) drawDifference(diffLayer, difference(mapB, mapA), WIDTH, h);
        diffTag.hidden = !(mapA && mapB);
        diffTag.textContent = model ? `Predicted B − A · ${short(model)}` : '';
        diffNote.textContent = mapA && mapB ? '' : 'Choose a prediction: measured gaze exists for one image at most.';
        diffCaption.textContent = `Orange: more predicted attention in B (${text.labelB.replace(/^B · /, '')}); blue: less. Shown over B.`;
      }

      caption.textContent =
        mode === 'difference'
          ? 'The difference of two predicted maps on the same grid. Pale or no colour means little change.'
          : model?.kind === 'measured'
            ? 'Measured gaze with its fixation points, on the untouched original only.'
            : model
              ? 'Brighter = more predicted attention. Both images use the same model.'
              : 'Choose a map to see where people are predicted to look.';

      renderTable();
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
          const a = share(loaded, measure, loaded.a, m.id);
          const b = share(loaded, measure, loaded.b, m.id);
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
      table.replaceChildren(el('caption', 'visually-hidden', `Share of attention on ${measure.phrase}`), el('thead'), el('tbody'));
      table.tHead!.append(head);
      table.tBodies[0].append(...rows);

      const area = measureMask(loaded, measure, loaded.a);
      const covered = pct(area ? area.mask.reduce((s, v) => s + v, 0) / area.mask.length : 0);
      const size = measure.perImage
        ? 'an automatic area found in each image separately, so the planting in B counts'
        : measure.source === 'area'
          ? `${covered} of the image: the automatic area found in A, used for both`
          : `${covered} of the image, the same pixels in A and B`;
      notes.replaceChildren(
        el('p', 'agreement-caption', `Share of all attention on ${measure.phrase} (${size}). B − A in percentage points. Match A–B: Pearson r between the two maps (1 = same pattern).`),
      );
      if (measure.source === 'region')
        notes.append(el('p', 'agreement-caption', 'The area is where the edit changed the image, found from the pixel difference between A and B.'));
      if (loaded.reference) {
        const msdb = share(loaded, measure, loaded.reference, 'deepgaze-msdb');
        const measured = share(loaded, measure, loaded.reference, 'measured');
        if (measured !== null && msdb !== null)
          notes.append(
            el('p', 'agreement-caption', `On the untouched original photograph, without the edits, measured gaze puts ${pct(measured)} of attention on ${measure.phrase}; DeepGaze MSDB predicts ${pct(msdb)}.`),
          );
      } else {
        const measured = share(loaded, measure, loaded.a, 'measured');
        const msdb = share(loaded, measure, loaded.a, 'deepgaze-msdb');
        if (measured !== null && msdb !== null)
          notes.append(el('p', 'agreement-caption', `On the original (A), measured gaze puts ${pct(measured)} of attention there and DeepGaze MSDB predicts ${pct(msdb)}: a check of the model on this scene, not of the change.`));
      }
      notes.append(el('p', 'agreement-caption', MEASURED_NOTE), el('p', 'agreement-caption', COMPARISON_CAVEAT));
    }

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
