import { METHOD_TEXTS } from '../content/methods';
import { models } from '../models/registry';
import { drawGreyed, drawHeatmap } from '../render/heatmap';
import { onResults, type Results } from '../results';

const IMAGE_WIDTH = 640;

/** "How each method works": per model, its heatmap for the current photo with an explanation underneath. */
export function mountMethods(section: HTMLElement): void {
  const heading = document.createElement('h2');
  heading.id = 'methods-heading';
  heading.className = 'section-label';
  heading.textContent = 'How each method works';

  const grid = document.createElement('div');
  grid.className = 'methods-grid';
  const cells = new Map<string, { frame: HTMLElement; layer: HTMLCanvasElement; note: HTMLElement; drawnFor: Results | null }>();

  for (const model of models) {
    const card = document.createElement('article');
    card.className = 'method-card';
    const frame = document.createElement('div');
    frame.className = 'frame';
    const layer = document.createElement('canvas');
    layer.className = 'layer';
    const tag = document.createElement('span');
    tag.className = 'predicted-tag';
    tag.textContent = 'Predicted';
    const note = document.createElement('span');
    note.className = 'cell-note';
    frame.append(layer, tag, note);

    const title = document.createElement('h3');
    title.textContent = model.name;
    const text = document.createElement('p');
    text.textContent = METHOD_TEXTS[model.id] ?? model.oneLine;
    card.append(frame, title, text);
    grid.append(card);
    cells.set(model.id, { frame, layer, note, drawnFor: null });
  }
  section.replaceChildren(heading, grid);

  onResults((results) => {
    const scale = Math.min(1, IMAGE_WIDTH / results.image.width);
    const w = Math.round(results.image.width * scale);
    const h = Math.round(results.image.height * scale);
    for (const model of models) {
      const cell = cells.get(model.id)!;
      let photo = cell.frame.querySelector<HTMLCanvasElement>('canvas.photo');
      if (cell.drawnFor?.image !== results.image || !photo) {
        photo ??= document.createElement('canvas');
        photo.className = 'photo';
        drawGreyed(photo, results.image.bitmap, w, h);
        cell.frame.prepend(photo);
        cell.layer.hidden = true;
        cell.drawnFor = null;
      }
      const status = results.status.get(model.id);
      if (status?.state === 'ready') {
        if (cell.drawnFor !== results) {
          drawHeatmap(cell.layer, status.map, w, h);
          cell.drawnFor = results;
        }
        cell.layer.hidden = false;
        cell.note.textContent = '';
      } else {
        cell.layer.hidden = true;
        cell.note.textContent =
          status?.state === 'failed' ? 'Could not run' : status?.state === 'unavailable' ? 'Example photos only' : 'Computing…';
      }
    }
  });
}
