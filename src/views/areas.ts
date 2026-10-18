import { attentionShares, decodeAreas, type Area, type AreaFile } from '../maps/areas';
import { drawGreyed } from '../render/heatmap';
import { modelsFor, onResults, type Results } from '../results';

/** Content hash of public/precomputed/areas/, set by vite.config.ts, so a stale cached copy is never used. */
declare const __AREAS_VERSION__: string;

const AREAS_URL = `${import.meta.env.BASE_URL}precomputed/areas/`;
const WIDTH = 1200;
const MIN_SHARE = 0.005;

type Group = 'category' | 'element';
const GROUPS: { id: Group; label: string }[] = [
  { id: 'category', label: 'Street categories' },
  { id: 'element', label: 'Façade elements' },
];

// Okabe–Ito colours (without black), white for street furniture and grey for "Other".
const COLOURS: Record<string, string> = {
  facade: '#E69F00',
  sky: '#56B4E9',
  greenery: '#009E73',
  'street-surface': '#F0E442',
  people: '#D55E00',
  vehicles: '#0072B2',
  signage: '#CC79A7',
  'street-furniture': '#FFFFFF',
  other: '#9A9AA4',
  'ground-floor': '#CC79A7',
  windows: '#56B4E9',
  entrances: '#E69F00',
  balconies: '#009E73',
  shopfronts: '#F0E442',
};

const files = new Map<string, Promise<AreaFile | null>>();

function loadAreas(photoId: string): Promise<AreaFile | null> {
  if (!files.has(photoId)) {
    files.set(
      photoId,
      fetch(`${AREAS_URL}${photoId}.json?v=${__AREAS_VERSION__}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  return files.get(photoId)!;
}

const percent = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
const lowNote = ' (unreliable: low score in the check)';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Outline (and optionally fill) the areas on a canvas at twice the mask size. */
function drawAreas(canvas: HTMLCanvasElement, areas: Area[], width: number, height: number, filled?: string): void {
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const image = new ImageData(canvas.width, canvas.height);
  const d = image.data;
  const paint = (x: number, y: number, rgb: number[], alpha: number) => {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const k = ((y * scale + dy) * canvas.width + x * scale + dx) * 4;
        d[k] = rgb[0];
        d[k + 1] = rgb[1];
        d[k + 2] = rgb[2];
        d[k + 3] = alpha;
      }
    }
  };
  for (const area of areas) {
    const hex = COLOURS[area.id] ?? '#FFFFFF';
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const m = area.mask;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!m[i]) continue;
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1 || !m[i - 1] || !m[i + 1] || !m[i - width] || !m[i + width];
        if (edge) paint(x, y, rgb, 255);
        else if (area.id === filled) paint(x, y, rgb, 110);
      }
    }
  }
  canvas.getContext('2d')!.putImageData(image, 0, 0);
}

/** The Areas view: automatic areas on the greyed photo and attention ÷ size per area and layer. */
export function mountAreas(panel: HTMLElement): void {
  let group: Group = 'category';
  let current: { results: Results; file: AreaFile; areas: Area[] } | null = null;
  const shareCache = new Map<string, Map<string, number>>();

  const switcher = el('div', 'area-switch');
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', 'Areas to show');
  const switchButtons = GROUPS.map(({ id, label }) => {
    const button = el('button', 'model-button', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      group = id;
      render();
    });
    switcher.append(button);
    return button;
  });

  const stage = el('div', 'stage');
  const frame = el('div', 'frame');
  const photo = el('canvas', 'photo');
  const outlines = el('canvas', 'layer area-layer');
  const tag = el('span', 'predicted-tag areas-tag', 'Automatic areas · not an expert judgement');
  frame.append(photo, outlines, tag);
  const empty = el('p', 'stage-empty');
  const legend = el('ul', 'area-legend');
  const tableWrap = el('div', 'agreement-wrap');
  const table = el('table', 'agreement-matrix areas-table');
  tableWrap.append(table);
  const caption = el(
    'p',
    'agreement-caption',
    'Attention ÷ size: 1.0× = as much as the area’s size alone predicts. Areas are found automatically and can be wrong.',
  );
  const notes = el('p', 'agreement-caption areas-notes');
  const panelBlock = el('div', 'areas-panel');
  panelBlock.id = 'areas-panel';
  panel.replaceChildren(switcher, stage, legend, tableWrap, caption, notes, panelBlock);

  let highlighted: string | undefined;

  function visibleAreas(): Area[] {
    if (!current) return [];
    return current.areas.filter((a) => a.group === group).sort((a, b) => b.share - a.share);
  }

  function drawStage() {
    if (!current) return;
    const { results, file } = current;
    const scale = Math.min(1, WIDTH / results.image.width);
    drawGreyed(photo, results.image.bitmap, Math.round(results.image.width * scale), Math.round(results.image.height * scale));
    drawAreas(outlines, visibleAreas(), file.width, file.height, highlighted);
    stage.replaceChildren(frame);
  }

  function shares(modelId: string): Map<string, number> | undefined {
    if (!current) return undefined;
    const key = `${current.file.photo}:${modelId}`;
    const status = current.results.status.get(modelId);
    if (status?.state !== 'ready') return undefined;
    if (!shareCache.has(key)) shareCache.set(key, attentionShares(status.map, current.areas, current.file.width, current.file.height));
    return shareCache.get(key);
  }

  function renderTable() {
    if (!current) return;
    const layers = modelsFor(current.results).filter((m) => current!.results.status.get(m.id)?.state === 'ready');
    const head = el('tr');
    head.append(el('th', undefined, 'Area'), el('th', undefined, '% of photo'));
    for (const m of layers) {
      const th = el('th', undefined, m.shortName ?? m.name);
      th.scope = 'col';
      th.title = m.name;
      head.append(th);
    }
    const rows = visibleAreas().map((area) => {
      const tr = el('tr');
      const name = el('th', undefined, area.label + (area.lowConfidence ? lowNote : ''));
      name.scope = 'row';
      tr.append(name, el('td', 'areas-share', percent(area.share)));
      for (const m of layers) {
        const td = el('td');
        const share = shares(m.id)?.get(area.id);
        if (share === undefined || area.share < MIN_SHARE) {
          td.textContent = '–';
          td.className = 'agreement-empty';
          if (area.share < MIN_SHARE) td.title = 'Under 0.5% of the photo: too small to judge';
        } else {
          const ratio = share / area.share;
          td.textContent = `${ratio.toFixed(1)}×`;
          td.className = 'agreement-cell';
          td.dataset.ratio = String(ratio);
          td.dataset.model = m.id;
          td.dataset.area = area.id;
          td.title = `${m.name}: ${percent(share)} of the attention on ${percent(area.share)} of the photo`;
          td.style.setProperty('--r', String(Math.max(0, Math.min(1, Math.log2(ratio) / 2))));
        }
        tr.append(td);
      }
      return tr;
    });
    table.replaceChildren(head, ...rows);
  }

  function renderLegend() {
    legend.replaceChildren(
      ...visibleAreas().map((area) => {
        const item = el('li');
        const button = el('button', 'area-legend-item');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(area.id === highlighted));
        const swatch = el('span', 'area-swatch');
        swatch.style.background = COLOURS[area.id] ?? '#FFFFFF';
        button.append(swatch, `${area.label}${area.lowConfidence ? lowNote : ''} `, el('span', 'area-percent', percent(area.share)));
        const show = (on: boolean) => {
          highlighted = on ? area.id : undefined;
          if (current) drawAreas(outlines, visibleAreas(), current.file.width, current.file.height, highlighted);
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

  function render() {
    switchButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(GROUPS[i].id === group)));
    if (!current) return;
    drawStage();
    renderLegend();
    renderTable();
    notes.textContent =
      current.file.horizon.method === 'assumed-level' ? 'Ground floor estimated assuming a level camera.' : '';
  }

  function showEmpty(text: string) {
    current = null;
    empty.textContent = text;
    stage.replaceChildren(empty);
    legend.replaceChildren();
    table.replaceChildren();
    notes.textContent = '';
    for (const node of [switcher, legend, tableWrap, caption]) node.hidden = true;
  }

  let requested: Results | null = null;
  onResults(async (results, changedModelId) => {
    const id = results.image.exampleId;
    if (!id) {
      requested = results;
      showEmpty('Areas are computed in advance for the example photos only.');
      return;
    }
    if (current?.results === results) {
      if (changedModelId) renderTable();
      return;
    }
    if (requested === results) return;
    requested = results;
    const file = await loadAreas(id);
    if (requested !== results) return;
    if (!file) {
      showEmpty('Areas could not be loaded for this photo.');
      return;
    }
    for (const node of [switcher, legend, tableWrap, caption]) node.hidden = false;
    current = { results, file, areas: decodeAreas(file) };
    highlighted = undefined;
    render();
  });
  render();
}
