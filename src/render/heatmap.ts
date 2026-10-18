import type { SaliencyMap, SignedField } from '../maps/saliency-map';
import { MAGMA, BLUE_ORANGE, type Lut } from './colormaps';

function percentile(values: Float32Array, p: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** Paints grid-sized RGBA, then scales it onto the target canvas, letting the browser interpolate. */
function paint(target: HTMLCanvasElement, width: number, height: number, rgba: Uint8ClampedArray<ArrayBuffer>, gridW: number, gridH: number) {
  const small = document.createElement('canvas');
  small.width = gridW;
  small.height = gridH;
  small.getContext('2d')!.putImageData(new ImageData(rgba, gridW, gridH), 0, 0);
  target.width = width;
  target.height = height;
  const context = target.getContext('2d')!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.clearRect(0, 0, width, height);
  context.drawImage(small, 0, 0, width, height);
}

/**
 * Draws a probability map as a heatmap at the given pixel size. Values are scaled
 * from the map's minimum to its 99th percentile, so one hot spot does not wash
 * out the rest and a flat map is not painted over the whole photo; the alpha
 * rises with the value, so low areas leave the photo visible.
 */
export function drawHeatmap(target: HTMLCanvasElement, map: SaliencyMap, width: number, height: number, lut: Lut = MAGMA): void {
  let bottom = Infinity;
  for (const v of map.data) bottom = Math.min(bottom, v);
  const span = percentile(map.data, 0.99) - bottom || 1;
  const rgba = new Uint8ClampedArray(map.width * map.height * 4);
  for (let i = 0; i < map.data.length; i++) {
    const t = Math.max(0, Math.min((map.data[i] - bottom) / span, 1));
    const k = Math.round(t * 255) * 3;
    rgba[i * 4] = lut[k];
    rgba[i * 4 + 1] = lut[k + 1];
    rgba[i * 4 + 2] = lut[k + 2];
    rgba[i * 4 + 3] = Math.round(240 * Math.pow(t, 1.4));
  }
  paint(target, width, height, rgba, map.width, map.height);
}

/** Draws a signed field on a scale symmetric around zero; alpha follows the magnitude. */
export function drawDifference(target: HTMLCanvasElement, field: SignedField, width: number, height: number, lut: Lut = BLUE_ORANGE): void {
  const magnitudes = field.data.map(Math.abs);
  const top = percentile(magnitudes, 0.99) || 1;
  const rgba = new Uint8ClampedArray(field.width * field.height * 4);
  for (let i = 0; i < field.data.length; i++) {
    const t = Math.max(-1, Math.min(field.data[i] / top, 1));
    const k = Math.round(((t + 1) / 2) * 255) * 3;
    rgba[i * 4] = lut[k];
    rgba[i * 4 + 1] = lut[k + 1];
    rgba[i * 4 + 2] = lut[k + 2];
    rgba[i * 4 + 3] = Math.round(235 * Math.pow(Math.abs(t), 0.5));
  }
  paint(target, width, height, rgba, field.width, field.height);
}
