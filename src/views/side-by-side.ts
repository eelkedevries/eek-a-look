import { models } from '../models/registry';
import { drawHeatmap } from '../render/heatmap';
import { onResults, type Results } from '../results';

const PANEL_WIDTH = 800;
const OPACITY = 1;

function photoCanvas(results: Results, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'photo';
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(results.image.bitmap, 0, 0, width, height);
  return canvas;
}

/** The side-by-side view: the photo and one panel per model, each with its heatmap at fixed opacity. */
export function mountSideBySide(panel: HTMLElement): void {
  const grid = document.createElement('div');
  grid.className = 'side-grid';
  panel.replaceChildren(grid);

  let built: Results | null = null;
  let w = 0;
  let h = 0;
  const cells = new Map<string, { layer: HTMLCanvasElement; note: HTMLElement; drawn: boolean }>();

  function build(results: Results) {
    const scale = Math.min(1, PANEL_WIDTH / results.image.width);
    w = Math.round(results.image.width * scale);
    h = Math.round(results.image.height * scale);
    cells.clear();

    const figure = (title: string, frame: HTMLElement) => {
      const f = document.createElement('figure');
      f.className = 'side-cell';
      const caption = document.createElement('figcaption');
      caption.textContent = title;
      f.append(frame, caption);
      return f;
    };

    const original = document.createElement('div');
    original.className = 'frame';
    original.append(photoCanvas(results, w, h));
    const figures = [figure('Photo', original)];

    for (const model of models) {
      const frame = document.createElement('div');
      frame.className = 'frame';
      const layer = document.createElement('canvas');
      layer.className = 'layer';
      layer.style.opacity = String(OPACITY);
      const tag = document.createElement('span');
      tag.className = 'predicted-tag';
      tag.textContent = 'Predicted';
      const note = document.createElement('span');
      note.className = 'cell-note';
      frame.append(photoCanvas(results, w, h), layer, tag, note);
      cells.set(model.id, { layer, note, drawn: false });
      figures.push(figure(model.subtitle ? `${model.name} · ${model.subtitle}` : model.name, frame));
    }
    grid.replaceChildren(...figures);
    built = results;
  }

  function update(results: Results) {
    if (built !== results) build(results);
    for (const model of models) {
      const cell = cells.get(model.id)!;
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
    }
  }

  onResults((results) => update(results));
}
