import type { SaliencyMap, SignedField } from '../maps/saliency-map';
import { BLUE_ORANGE, INFERNO, type Lut } from './colormaps';

/** The top of a heatmap's scale: this percentile of its values (prompt 079). */
const HEAT_TOP = 0.999;
/**
 * The top of a heatmap's scale is at least this multiple of the image average density, so a nearly flat map (classic
 * salience peaks at about 2×) is drawn faint instead of being stretched over the whole colour range (prompt 079).
 */
const HEAT_MIN_TOP = 4;
/** The heatmap's transfer curve t^0.6, so peaks keep their order and moderate areas stay visible (prompt 079). */
const HEAT_CURVE = 0.6;
/** The table index where a heatmap starts, and its alpha curve: alpha = 0.9 · t^0.8. */
const HEAT_FROM = 0.35;
const heatAlpha = (t: number) => 0.9 * Math.pow(t, 0.8);

/**
 * Every difference map is drawn to ± this multiple of the image average density (1 / number of cells), on every photo and
 * for every pair, so their colours compare (prompts 078, 079).
 */
export const DIFFERENCE_SCALE = 12;
/**
 * Colour and alpha follow |t|^0.6: the area that changes then reads in proportion to the share of gaze that moves, and a
 * spread-out loss carries about the weight of the equal, concentrated gain, while changes under a quarter of the average
 * stay faint (prompt 079).
 */
const DIFFERENCE_CURVE = 0.6;
const differenceAlpha = (m: number) => (235 / 255) * m;

/** The grey a colour bar is drawn over: the greyed photo's typical tone, so the bar shows the colours the image shows. */
const BAR_GREY = 96;

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

export interface HeatRange {
  bottom: number;
  top: number;
}

/** One scale for several maps, so their colours compare: the lowest value of any to the 99.9th percentile of all, at least HEAT_MIN_TOP × the average. */
export function sharedRange(maps: SaliencyMap[]): HeatRange {
  const all = new Float32Array(maps.reduce((n, m) => n + m.data.length, 0));
  let offset = 0;
  let bottom = Infinity;
  for (const m of maps) {
    all.set(m.data, offset);
    offset += m.data.length;
    for (const v of m.data) bottom = Math.min(bottom, v);
  }
  return { bottom, top: Math.max(percentile(all, HEAT_TOP), HEAT_MIN_TOP / maps[0].data.length) };
}

/**
 * Draws a probability map as a heatmap at the given pixel size. Values are scaled from the map's minimum to its 99.9th
 * percentile (or over a shared range) and through t^0.6, so a higher peak looks brighter than a lower one and moderate
 * areas still show, while a flat map is not painted over the whole photo. The darkest 35 % of the table is skipped so
 * faint areas still read against a greyed photo, and the alpha rises with the value, so low areas leave it visible.
 */
export function drawHeatmap(target: HTMLCanvasElement, map: SaliencyMap, width: number, height: number, lut: Lut = INFERNO, range?: HeatRange): void {
  const { bottom, top } = range ?? sharedRange([map]);
  const span = top - bottom || 1;
  const rgba = new Uint8ClampedArray(map.width * map.height * 4);
  for (let i = 0; i < map.data.length; i++) {
    const t = Math.pow(Math.max(0, Math.min((map.data[i] - bottom) / span, 1)), HEAT_CURVE);
    const k = Math.round((HEAT_FROM + (1 - HEAT_FROM) * t) * 255) * 3;
    rgba[i * 4] = lut[k];
    rgba[i * 4 + 1] = lut[k + 1];
    rgba[i * 4 + 2] = lut[k + 2];
    rgba[i * 4 + 3] = Math.round(255 * heatAlpha(t));
  }
  paint(target, width, height, rgba, map.width, map.height);
}

/**
 * Draws the difference of two probability maps on the fixed scale ±DIFFERENCE_SCALE × the image average, the same on
 * every photo. Colour and alpha rise with |t|^DIFFERENCE_CURVE from zero; values beyond the scale saturate.
 */
export function drawDifference(target: HTMLCanvasElement, field: SignedField, width: number, height: number, lut: Lut = BLUE_ORANGE): void {
  const top = DIFFERENCE_SCALE / (field.width * field.height);
  const rgba = new Uint8ClampedArray(field.width * field.height * 4);
  for (let i = 0; i < field.data.length; i++) {
    const t = Math.max(-1, Math.min(field.data[i] / top, 1));
    const m = Math.pow(Math.abs(t), DIFFERENCE_CURVE);
    const k = Math.round(((Math.sign(t) * m + 1) / 2) * 255) * 3;
    rgba[i * 4] = lut[k];
    rgba[i * 4 + 1] = lut[k + 1];
    rgba[i * 4 + 2] = lut[k + 2];
    rgba[i * 4 + 3] = Math.round(255 * differenceAlpha(m));
  }
  paint(target, width, height, rgba, field.width, field.height);
}

function barGradient(stops: number[], colour: (t: number) => [number, number, number, number]): string {
  return `linear-gradient(90deg, ${stops
    .map((t) => {
      const [r, g, b, a] = colour(t);
      const mix = (c: number) => Math.round(c * a + BAR_GREY * (1 - a));
      return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
    })
    .join(', ')})`;
}

const at = (lut: Lut, index: number) => {
  const k = Math.round(Math.min(Math.max(index, 0), 1) * 255) * 3;
  return [lut[k], lut[k + 1], lut[k + 2]] as const;
};

/** The heatmap's colour bar, low to high, with its alpha over the photo's grey: what the map looks like from 0 to the top of its scale. */
export function heatGradientCss(steps = 24): string {
  return barGradient(
    Array.from({ length: steps + 1 }, (_, i) => i / steps),
    (x) => {
      const t = Math.pow(x, HEAT_CURVE);
      return [...at(INFERNO, HEAT_FROM + (1 - HEAT_FROM) * t), heatAlpha(t)];
    },
  );
}

/** The difference's colour bar, linear in value from −DIFFERENCE_SCALE to +DIFFERENCE_SCALE, with its alpha over the photo's grey. */
export function differenceGradientCss(steps = 24): string {
  return barGradient(
    Array.from({ length: steps + 1 }, (_, i) => (2 * i) / steps - 1),
    (t) => {
      const m = Math.pow(Math.abs(t), DIFFERENCE_CURVE);
      return [...at(BLUE_ORANGE, (Math.sign(t) * m + 1) / 2), differenceAlpha(m)];
    },
  );
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
