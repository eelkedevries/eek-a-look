import { pearson } from '../maps/saliency-map';
import { mapLabel, type ModelSpec } from '../models/types';
import { drawGreyed, drawHeatmap } from '../render/heatmap';
import { modelsFor, onResults, referenceModel, type Results } from '../results';
import { getViewState, onViewState } from '../view-state';

const PANEL_WIDTH = 800;

const short = (m: ModelSpec) => m.shortName ?? m.name;
const fixed = (r: number) => r.toFixed(2).replace(/^-(0\.00)$/, '$1');

interface Cell {
  model: ModelSpec;
  layer: HTMLCanvasElement;
  note: HTMLElement;
  score: HTMLElement;
  contrast: HTMLButtonElement;
  drawn: boolean;
}

function photoCanvas(results: Results, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'photo';
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(results.image.bitmap, 0, 0, width, height);
  return canvas;
}

/**
 * The side-by-side view: the photo and one panel per model, each with its heatmap and its match with
 * the reference map, at the strength set in the inspector. A ring follows the pointer in every panel at once, so one spot can be compared
 * across all maps.
 */
export function mountSideBySide(panel: HTMLElement, onContrast: (a: string, b: string) => void): void {
  const grid = document.createElement('div');
  grid.className = 'side-grid';
  const caption = document.createElement('p');
  caption.className = 'side-caption';
  panel.replaceChildren(grid, caption);

  grid.addEventListener('pointermove', (event) => {
    const frame = (event.target as HTMLElement).closest<HTMLElement>('.side-cell .frame');
    if (!frame) return grid.classList.remove('probing');
    const box = frame.getBoundingClientRect();
    grid.style.setProperty('--px', String((event.clientX - box.left) / box.width));
    grid.style.setProperty('--py', String((event.clientY - box.top) / box.height));
    grid.classList.add('probing');
  });
  grid.addEventListener('pointerleave', () => grid.classList.remove('probing'));
  const applyOpacity = () => grid.style.setProperty('--heat-opacity', String(getViewState().opacity / 100));
  onViewState(applyOpacity);
  applyOpacity();

  let built: Results | null = null;
  let w = 0;
  let h = 0;
  const cells = new Map<string, Cell>();

  function build(results: Results) {
    const scale = Math.min(1, PANEL_WIDTH / results.image.width);
    w = Math.round(results.image.width * scale);
    h = Math.round(results.image.height * scale);
    cells.clear();

    const figure = (frame: HTMLElement, ...captionParts: (Node | string)[]) => {
      const f = document.createElement('figure');
      f.className = 'side-cell';
      const probe = document.createElement('span');
      probe.className = 'probe';
      probe.setAttribute('aria-hidden', 'true');
      frame.append(probe);
      const caption = document.createElement('figcaption');
      caption.append(...captionParts);
      f.append(frame, caption);
      return f;
    };

    const original = document.createElement('div');
    original.className = 'frame';
    original.append(photoCanvas(results, w, h));
    const figures = [figure(original, Object.assign(document.createElement('span'), { className: 'cell-name', textContent: 'Photo' }))];

    for (const model of modelsFor(results)) {
      const frame = document.createElement('div');
      frame.className = 'frame';
      const greyed = document.createElement('canvas');
      greyed.className = 'photo';
      drawGreyed(greyed, results.image.bitmap, w, h);
      const layer = document.createElement('canvas');
      layer.className = 'layer';
      const tag = document.createElement('span');
      tag.className = model.kind === 'measured' ? 'predicted-tag measured' : 'predicted-tag';
      tag.textContent = mapLabel(model);
      const note = document.createElement('span');
      note.className = 'cell-note';
      frame.append(greyed, layer, tag, note);

      const name = document.createElement('span');
      name.className = 'cell-name';
      name.textContent = model.name;
      if (model.subtitle) name.append(Object.assign(document.createElement('small'), { textContent: model.subtitle }));
      const score = document.createElement('span');
      score.className = 'cell-score';
      const contrast = document.createElement('button');
      contrast.type = 'button';
      contrast.className = 'cell-contrast';
      contrast.textContent = 'Contrast';
      contrast.hidden = true;

      cells.set(model.id, { model, layer, note, score, contrast, drawn: false });
      figures.push(figure(frame, name, score, contrast));
    }
    grid.replaceChildren(...figures);
    built = results;
  }

  function update(results: Results) {
    if (built !== results) build(results);
    const refId = referenceModel(results);
    const ref = refId ? results.status.get(refId) : undefined;
    const refModel = refId ? cells.get(refId)?.model : undefined;
    caption.textContent = refModel
      ? `Move the pointer over any map to mark the same spot in all of them. r = match with ${refModel.name} (0 = unrelated · 1 = same pattern); “Contrast” opens a map against it.`
      : 'Move the pointer over any map to mark the same spot in all of them.';

    for (const cell of cells.values()) {
      const { model } = cell;
      const status = results.status.get(model.id);
      if (status?.state === 'ready') {
        if (!cell.drawn) {
          drawHeatmap(cell.layer, status.map, w, h);
          cell.drawn = true;
        }
        cell.note.textContent = '';
      } else {
        cell.note.textContent =
          status?.state === 'failed' ? 'Could not run' : status?.state === 'unavailable' ? 'Example photos only' : 'Computing…';
      }

      const isRef = model.id === refId;
      cell.score.classList.toggle('is-reference', isRef);
      cell.score.classList.toggle('measured', isRef && model.kind === 'measured');
      if (isRef) cell.score.textContent = model.kind === 'measured' ? 'Reference' : 'Best available';
      else if (status?.state === 'ready' && ref?.state === 'ready') cell.score.textContent = `r = ${fixed(pearson(status.map, ref.map))}`;
      else cell.score.textContent = '';

      cell.contrast.hidden = isRef || !refId || status?.state !== 'ready';
      cell.contrast.onclick = refId ? () => onContrast(model.id, refId) : null;
      cell.contrast.setAttribute('aria-label', refModel ? `Contrast ${model.name} with ${refModel.name}` : 'Contrast');
      cell.contrast.title = refModel ? `Contrast with ${short(refModel)}` : '';
    }
  }

  onResults((results) => update(results));
}
