import type { SaliencyMap, SignedField } from '../maps/saliency-map';
import { BLUE_ORANGE, INFERNO, type Lut } from './colormaps';

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
 * out the rest and a flat map is not painted over the whole photo. The darkest
 * 35 % of the table is skipped so faint areas still read against a greyed
 * photo, and the alpha rises with the value, so low areas leave it visible.
 */
export function drawHeatmap(target: HTMLCanvasElement, map: SaliencyMap, width: number, height: number, lut: Lut = INFERNO): void {
  let bottom = Infinity;
  for (const v of map.data) bottom = Math.min(bottom, v);
  const span = percentile(map.data, 0.99) - bottom || 1;
  const rgba = new Uint8ClampedArray(map.width * map.height * 4);
  for (let i = 0; i < map.data.length; i++) {
    const t = Math.max(0, Math.min((map.data[i] - bottom) / span, 1));
    const k = Math.round((0.35 + 0.65 * t) * 255) * 3;
    rgba[i * 4] = lut[k];
    rgba[i * 4 + 1] = lut[k + 1];
    rgba[i * 4 + 2] = lut[k + 2];
    rgba[i * 4 + 3] = Math.round(255 * 0.9 * Math.pow(t, 0.8));
  }
  paint(target, width, height, rgba, map.width, map.height);
}

/**
 * Draws a signed field on a scale symmetric around zero; alpha follows the magnitude. The pale middle
 * of the table is skipped, so small differences tint the photo blue or orange instead of veiling it
 * in white, which made the zero lines read as dark rings.
 */
export function drawDifference(target: HTMLCanvasElement, field: SignedField, width: number, height: number, lut: Lut = BLUE_ORANGE): void {
  const magnitudes = field.data.map(Math.abs);
  const top = percentile(magnitudes, 0.99) || 1;
  const rgba = new Uint8ClampedArray(field.width * field.height * 4);
  for (let i = 0; i < field.data.length; i++) {
    const t = Math.max(-1, Math.min(field.data[i] / top, 1));
    const c = Math.sign(t) * (0.3 + 0.7 * Math.abs(t));
    const k = Math.round(((c + 1) / 2) * 255) * 3;
    rgba[i * 4] = lut[k];
    rgba[i * 4 + 1] = lut[k + 1];
    rgba[i * 4 + 2] = lut[k + 2];
    rgba[i * 4 + 3] = Math.round(235 * Math.pow(Math.abs(t), 0.75));
  }
  paint(target, width, height, rgba, field.width, field.height);
}

/** Draws the photo in grey (Rec. 709 luminance, dimmed), so heatmap colours do not mix with the photo's own. */
export function drawGreyed(target: HTMLCanvasElement, image: CanvasImageSource, width: number, height: number, dim = 0.75): void {
  target.width = width;
  target.height = height;
  const context = target.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(greyCopy(image, dim), 0, 0, width, height);
}

// Each photo is greyed once, at full size; every view then scales that copy.
const greyCache = new WeakMap<object, { dim: number; canvas: HTMLCanvasElement }>();

function greyCopy(image: CanvasImageSource, dim: number): HTMLCanvasElement {
  const cached = greyCache.get(image);
  if (cached?.dim === dim) return cached.canvas;
  const { width, height } = image as { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = dim * (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
  }
  context.putImageData(pixels, 0, 0);
  greyCache.set(image, { dim, canvas });
  return canvas;
}
