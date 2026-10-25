import { loadFixations, type Fixations, type Scanpath } from '../models/measured';
import type { ModelSpec } from '../models/types';
import type { CurrentImage } from '../state';
import { getViewState } from '../view-state';

/**
 * Whether the fixation points go over a map of this kind: always over the measured map, and over the
 * predicted maps too when the visitor asks for it (prompt 056).
 */
export function dotsOver(model: Pick<ModelSpec, 'kind'>): boolean {
  return model.kind === 'measured' || getViewState().fixationsOnModels;
}

/**
 * The addition to a map's tag while its dots are shown: on a predicted map the dots are measured data,
 * so the tag says so. Call after `syncFixations`.
 */
export function dotsTag(canvas: HTMLCanvasElement, model: Pick<ModelSpec, 'kind'>): string {
  return model.kind !== 'measured' && !canvas.hidden ? ' · with measured fixations' : '';
}

/**
 * The whole layer is faded, so each dot and its edge keep their look at any strength: 65% by default
 * (prompt 050), set by the visitor's "Fixation points" slider (prompt 054).
 */
function applyOpacity(canvas: HTMLCanvasElement): void {
  canvas.style.opacity = String(getViewState().fixationOpacity / 100);
}

/** A canvas for the fixation points, stacked over a map; it ignores the heatmap strength. */
export function fixationLayer(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'layer fixations';
  applyOpacity(canvas);
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  return canvas;
}

/** Cyan dots with a dark edge, about 1.25–3 CSS pixels in radius depending on the displayed width. */
export function drawFixations(target: HTMLCanvasElement, fixations: Fixations, width: number, height: number, displayed: number): void {
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);
  const cssRadius = displayed > 0 ? Math.min(3, Math.max(1.25, displayed / 300)) : 2;
  const r = displayed > 0 ? (cssRadius * width) / displayed : width / 400;
  const sx = width / fixations.width;
  const sy = height / fixations.height;
  ctx.beginPath();
  for (const [x, y] of fixations.points) {
    // Pixel centres, so a point at pixel 0 sits half a pixel in.
    const cx = (x + 0.5) * sx;
    const cy = (y + 0.5) * sy;
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  }
  ctx.lineWidth = Math.max(1, r * 0.5);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.stroke();
  ctx.fillStyle = 'rgb(0, 229, 255)';
  ctx.fill();
}

/** --iris in style.css: the colour of measured gaze. */
const MEASURED = '#6ba6e4';

/**
 * One participant's measured gaze path (prompt 077): numbered circles joined in their order. A circle's number is the
 * database's fixation number minus one, so 1 is the first fixation after the one on the central cross, and a fixation
 * the database does not hold leaves a gap in the numbers, bridged by a dashed line.
 */
export function drawScanpath(target: HTMLCanvasElement, path: Scanpath, source: { width: number; height: number }, width: number, height: number): void {
  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);
  const r = width / 46;
  const at = path.fixations.map(([fix, x, y]) => ({ n: fix - 1, x: ((x + 0.5) * width) / source.width, y: ((y + 0.5) * height) / source.height }));
  ctx.lineCap = 'round';
  for (let i = 1; i < at.length; i++) {
    const [a, b] = [at[i - 1], at[i]];
    ctx.setLineDash(b.n - a.n > 1 ? [r * 0.5, r * 0.6] : []);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = r * 0.42;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.stroke();
    ctx.lineWidth = r * 0.2;
    ctx.strokeStyle = MEASURED;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.font = `600 ${Math.round(r * 1.1)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Drawn last to first, so where circles overlap the earlier fixation stays readable.
  for (const p of [...at].reverse()) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = MEASURED;
    ctx.fill();
    ctx.lineWidth = r * 0.18;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.stroke();
    ctx.fillStyle = '#0a0a0f';
    ctx.fillText(String(p.n), p.x, p.y + r * 0.06);
  }
}

/**
 * Shows the photo's fixations on `canvas` when the visitor has switched them on and `show` holds (the
 * canvas lies over a drawn map that takes dots, see `dotsOver`); otherwise hides it. The points load on
 * first use.
 */
export function syncFixations(canvas: HTMLCanvasElement, image: CurrentImage, show: boolean, width: number, height: number): void {
  const id = image.exampleId;
  applyOpacity(canvas);
  if (!getViewState().fixations || !show || !image.measured || !id) {
    canvas.hidden = true;
    return;
  }
  canvas.hidden = false;
  const displayed = canvas.parentElement?.clientWidth ?? 0;
  const key = `${id}|${width}×${height}|${displayed}`;
  if (canvas.dataset.drawn === key) return;
  canvas.dataset.drawn = key;
  canvas.width = width;
  canvas.height = height;
  loadFixations(id).then(
    (fixations) => {
      if (canvas.dataset.drawn === key) drawFixations(canvas, fixations, width, height, displayed);
    },
    () => {
      delete canvas.dataset.drawn;
      canvas.hidden = true;
    },
  );
}
