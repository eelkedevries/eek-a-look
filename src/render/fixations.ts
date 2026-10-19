import { loadFixations, type Fixations } from '../models/measured';
import type { CurrentImage } from '../state';
import { getViewState } from '../view-state';

/**
 * The whole layer is faded, so each dot and its edge keep their look at any strength: 65% by default
 * (prompt 050), set by the visitor's "Fixation points" slider (prompt 054).
 */
function applyOpacity(canvas: HTMLCanvasElement): void {
  canvas.style.opacity = String(getViewState().fixationOpacity / 100);
}

/** A canvas for the fixation points, stacked over a measured map; it ignores the heatmap strength. */
export function fixationLayer(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'layer fixations';
  applyOpacity(canvas);
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  return canvas;
}

/** Cyan dots with a dark edge, about 1.25–3 CSS pixels in radius depending on the displayed width. */
function drawFixations(target: HTMLCanvasElement, fixations: Fixations, width: number, height: number, displayed: number): void {
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

/**
 * Shows the photo's fixations on `canvas` when the visitor has switched them on and `show` holds (the
 * canvas lies over a drawn measured map); otherwise hides it. The points load on first use.
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
