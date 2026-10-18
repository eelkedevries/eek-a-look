import { difference } from '../maps/saliency-map';
import { BLUE_ORANGE, cssColour } from '../render/colormaps';
import { drawDifference } from '../render/heatmap';
import { onResults, type Results } from '../results';

const AI = 'unisal';
const BASELINE = 'centre-bias';
const WIDTH = 1200;

function desaturated(results: Results, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'photo';
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.drawImage(results.image.bitmap, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const grey = 0.85 * (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = grey;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** "What AI adds": where UNISAL expects more or less looking than centre bias alone, on a greyed photo. */
export function mountWhatAiAdds(panel: HTMLElement): void {
  const legend = document.createElement('div');
  legend.className = 'legend';
  const bar = document.createElement('span');
  bar.className = 'legend-bar legend-bar-wide';
  bar.style.background = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => cssColour(BLUE_ORANGE, t)).join(', ')})`;
  legend.append('AI expects less', bar, 'AI expects more');

  const caption = document.createElement('p');
  caption.className = 'adds-caption';
  caption.textContent =
    'Orange: UNISAL expects more looking here than “people look at the middle” alone. Blue: less. Grey: about the same.';

  const stage = document.createElement('div');
  stage.className = 'stage';
  const note = document.createElement('p');
  note.className = 'stage-empty';
  stage.append(note);
  panel.replaceChildren(legend, stage, caption);

  let drawnFor: Results | null = null;

  onResults((results) => {
    const ai = results.status.get(AI);
    const base = results.status.get(BASELINE);
    if (ai?.state !== 'ready' || base?.state !== 'ready') {
      drawnFor = null;
      note.textContent = ai?.state === 'failed' ? 'UNISAL could not run, so there is nothing to compare.' : 'Waiting for UNISAL…';
      stage.replaceChildren(note);
      return;
    }
    if (drawnFor === results) return;
    drawnFor = results;

    const scale = Math.min(1, WIDTH / results.image.width);
    const w = Math.round(results.image.width * scale);
    const h = Math.round(results.image.height * scale);
    const frame = document.createElement('div');
    frame.className = 'frame';
    const layer = document.createElement('canvas');
    layer.className = 'layer';
    drawDifference(layer, difference(ai.map, base.map), w, h);
    const tag = document.createElement('span');
    tag.className = 'predicted-tag';
    tag.textContent = 'Predicted · UNISAL minus centre bias';
    frame.append(desaturated(results, w, h), layer, tag);
    stage.replaceChildren(frame);
  });
}
