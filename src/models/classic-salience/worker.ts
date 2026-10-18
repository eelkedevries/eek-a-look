/// <reference lib="webworker" />
/*
 * Classic bottom-up salience after Itti, Koch & Niebur (1998), "A model of
 * saliency-based visual attention for rapid scene analysis", IEEE TPAMI 20(11).
 *
 * As in the paper:
 * - input downscaled to 512 px on the long side (the paper used 640 × 480);
 * - intensity I = (r + g + b) / 3;
 * - r, g, b normalised by I, and set to zero where I < max(I) / 10;
 * - broadly tuned R = r − (g + b)/2, G = g − (r + b)/2, B = b − (r + g)/2,
 *   Y = (r + g)/2 − |r − g|/2 − b, with negative values set to zero;
 * - dyadic Gaussian pyramids, levels 0–8 (5-tap [1 4 6 4 1] / 16 kernel);
 * - centre–surround at c ∈ {2, 3, 4}, s = c + δ, δ ∈ {3, 4}, the surround
 *   interpolated to the centre's scale: 6 intensity, 12 colour (red–green and
 *   blue–yellow double opponency) and 24 orientation maps, 42 in all;
 * - N(·): scale to [0, 1], then multiply by (1 − m̄)², with m̄ the mean of
 *   the local maxima other than the global one;
 * - across-scale addition at level 4 into conspicuity maps Ī, C̄ and Ō
 *   (Ō sums N(·) of each orientation's map, as in the paper);
 * - S = (N(Ī) + N(C̄) + N(Ō)) / 3.
 *
 * Deviations, all minor and in the spirit of common reimplementations:
 * - orientation uses the energy of a quadrature Gabor pair (σ = 2 px,
 *   wavelength 5 px, aspect 0.5) on each intensity level, where the paper
 *   used Gabor pyramids derived from a Laplacian pyramid;
 * - a local maximum is a pixel at least as large as its 8 neighbours and
 *   above 5 % of the global maximum, which keeps flat noise out of m̄;
 * - S is resampled to the shared grid and blurred with a Gaussian of σ = 3 %
 *   of the image width, then normalised to sum 1, as is usual when a
 *   salience map is compared with other maps.
 * No centre bias is added.
 */

interface Plane {
  w: number;
  h: number;
  d: Float32Array;
}

const plane = (w: number, h: number): Plane => ({ w, h, d: new Float32Array(w * h) });

function blur5(p: Plane): Plane {
  const k = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  const tmp = plane(p.w, p.h);
  const out = plane(p.w, p.h);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) s += k[i + 2] * p.d[y * p.w + Math.min(p.w - 1, Math.max(0, x + i))];
      tmp.d[y * p.w + x] = s;
    }
  }
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) s += k[i + 2] * tmp.d[Math.min(p.h - 1, Math.max(0, y + i)) * p.w + x];
      out.d[y * p.w + x] = s;
    }
  }
  return out;
}

function pyramid(base: Plane, levels = 9): Plane[] {
  const out = [base];
  for (let l = 1; l < levels; l++) {
    const b = blur5(out[l - 1]);
    const w = Math.max(1, Math.floor(b.w / 2));
    const h = Math.max(1, Math.floor(b.h / 2));
    const p = plane(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.d[y * w + x] = b.d[Math.min(b.h - 1, y * 2) * b.w + Math.min(b.w - 1, x * 2)];
    out.push(p);
  }
  return out;
}

/** Bilinear resize, cell centres aligned. */
function resize(p: Plane, w: number, h: number): Plane {
  const out = plane(w, h);
  const sx = p.w / w;
  const sy = p.h / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(Math.max((y + 0.5) * sy - 0.5, 0), p.h - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, p.h - 1);
    const wy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(Math.max((x + 0.5) * sx - 0.5, 0), p.w - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, p.w - 1);
      const wx = fx - x0;
      const top = p.d[y0 * p.w + x0] * (1 - wx) + p.d[y0 * p.w + x1] * wx;
      const bottom = p.d[y1 * p.w + x0] * (1 - wx) + p.d[y1 * p.w + x1] * wx;
      out.d[y * w + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return out;
}

function map2(a: Plane, b: Plane, f: (x: number, y: number) => number): Plane {
  const out = plane(a.w, a.h);
  for (let i = 0; i < out.d.length; i++) out.d[i] = f(a.d[i], b.d[i]);
  return out;
}

/** |centre ⊖ surround|, the surround interpolated to the centre's scale. */
function centreSurround(centre: Plane, surround: Plane): Plane {
  return map2(centre, resize(surround, centre.w, centre.h), (c, s) => Math.abs(c - s));
}

/** Itti's N(·), with the local-maximum rule described in the header. */
function normaliseN(p: Plane): Plane {
  let min = Infinity;
  let max = -Infinity;
  for (const v of p.d) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const out = plane(p.w, p.h);
  if (!(max > min)) return out;
  for (let i = 0; i < p.d.length; i++) out.d[i] = (p.d[i] - min) / (max - min);

  let sum = 0;
  let count = 0;
  let globalSeen = false;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const v = out.d[y * p.w + x];
      if (v < 0.05) continue;
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= p.w || yy >= p.h) continue;
          if (out.d[yy * p.w + xx] > v) {
            isMax = false;
            break;
          }
        }
      }
      if (!isMax) continue;
      if (v === 1 && !globalSeen) {
        globalSeen = true;
        continue;
      }
      sum += v;
      count++;
    }
  }
  const mean = count ? sum / count : 0;
  const weight = (1 - mean) * (1 - mean);
  for (let i = 0; i < out.d.length; i++) out.d[i] *= weight;
  return out;
}

function gaborKernels(theta: number) {
  const radius = 4;
  const sigma = 2;
  const lambda = 5;
  const gamma = 0.5;
  const size = radius * 2 + 1;
  const even = new Float32Array(size * size);
  const odd = new Float32Array(size * size);
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const xr = x * Math.cos(theta) + y * Math.sin(theta);
      const yr = -x * Math.sin(theta) + y * Math.cos(theta);
      const envelope = Math.exp(-(xr * xr + gamma * gamma * yr * yr) / (2 * sigma * sigma));
      even[(y + radius) * size + x + radius] = envelope * Math.cos((2 * Math.PI * xr) / lambda);
      odd[(y + radius) * size + x + radius] = envelope * Math.sin((2 * Math.PI * xr) / lambda);
    }
  }
  const mean = even.reduce((a, b) => a + b, 0) / even.length;
  for (let i = 0; i < even.length; i++) even[i] -= mean;
  return { even, odd, radius, size };
}

const GABORS = [0, 45, 90, 135].map((deg) => gaborKernels((deg * Math.PI) / 180));

function gaborEnergy(p: Plane, k: (typeof GABORS)[number]): Plane {
  const out = plane(p.w, p.h);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      let e = 0;
      let o = 0;
      for (let ky = -k.radius; ky <= k.radius; ky++) {
        const yy = Math.min(p.h - 1, Math.max(0, y + ky));
        for (let kx = -k.radius; kx <= k.radius; kx++) {
          const v = p.d[yy * p.w + Math.min(p.w - 1, Math.max(0, x + kx))];
          const i = (ky + k.radius) * k.size + kx + k.radius;
          e += v * k.even[i];
          o += v * k.odd[i];
        }
      }
      out.d[y * p.w + x] = Math.sqrt(e * e + o * o);
    }
  }
  return out;
}

function addInto(target: Plane, p: Plane) {
  const r = p.w === target.w && p.h === target.h ? p : resize(p, target.w, target.h);
  for (let i = 0; i < target.d.length; i++) target.d[i] += r.d[i];
}

const CENTRES = [2, 3, 4];
const DELTAS = [3, 4];

export function salience(rgba: Uint8ClampedArray, w: number, h: number): Plane {
  const n = w * h;
  const I = plane(w, h);
  for (let i = 0; i < n; i++) I.d[i] = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3;
  let maxI = 0;
  for (const v of I.d) maxI = Math.max(maxI, v);

  const R = plane(w, h);
  const G = plane(w, h);
  const B = plane(w, h);
  const Y = plane(w, h);
  for (let i = 0; i < n; i++) {
    if (I.d[i] < maxI / 10) continue;
    const r = rgba[i * 4] / I.d[i];
    const g = rgba[i * 4 + 1] / I.d[i];
    const b = rgba[i * 4 + 2] / I.d[i];
    R.d[i] = Math.max(0, r - (g + b) / 2);
    G.d[i] = Math.max(0, g - (r + b) / 2);
    B.d[i] = Math.max(0, b - (r + g) / 2);
    Y.d[i] = Math.max(0, (r + g) / 2 - Math.abs(r - g) / 2 - b);
  }

  const pI = pyramid(I);
  const pR = pyramid(R);
  const pG = pyramid(G);
  const pB = pyramid(B);
  const pY = pyramid(Y);
  const pO = GABORS.map((k) => pI.map((level, l) => (l >= 2 ? gaborEnergy(level, k) : level)));

  const at4 = () => plane(pI[4].w, pI[4].h);
  const intensity = at4();
  const colour = at4();
  const orientation = at4();
  const perOrientation = GABORS.map(at4);

  for (const c of CENTRES) {
    for (const delta of DELTAS) {
      const s = c + delta;
      addInto(intensity, normaliseN(centreSurround(pI[c], pI[s])));

      const rgC = map2(pR[c], pG[c], (r, g) => r - g);
      const grS = map2(pG[s], pR[s], (g, r) => g - r);
      const byC = map2(pB[c], pY[c], (b, y) => b - y);
      const ybS = map2(pY[s], pB[s], (y, b) => y - b);
      addInto(colour, normaliseN(centreSurround(rgC, grS)));
      addInto(colour, normaliseN(centreSurround(byC, ybS)));

      GABORS.forEach((_, t) => addInto(perOrientation[t], normaliseN(centreSurround(pO[t][c], pO[t][s]))));
    }
  }
  for (const map of perOrientation) addInto(orientation, normaliseN(map));

  const S = at4();
  for (const conspicuity of [intensity, colour, orientation]) addInto(S, normaliseN(conspicuity));
  for (let i = 0; i < S.d.length; i++) S.d[i] /= 3;
  return S;
}

function gaussianBlur(p: Plane, sigma: number): Plane {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const k = Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)));
  const total = k.reduce((a, b) => a + b, 0);
  const horizontal = plane(p.w, p.h);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      let s = 0;
      for (let i = -radius; i <= radius; i++) s += k[i + radius] * p.d[y * p.w + Math.min(p.w - 1, Math.max(0, x + i))];
      horizontal.d[y * p.w + x] = s / total;
    }
  }
  const out = plane(p.w, p.h);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      let s = 0;
      for (let i = -radius; i <= radius; i++) s += k[i + radius] * horizontal.d[Math.min(p.h - 1, Math.max(0, y + i)) * p.w + x];
      out.d[y * p.w + x] = s / total;
    }
  }
  return out;
}

export interface SalienceRequest {
  id: number;
  bitmap: ImageBitmap;
  grid: { width: number; height: number };
}

export interface SalienceResponse {
  id: number;
  data?: Float32Array;
  error?: string;
  milliseconds?: number;
}

const WORKING_SIDE = 512;

self.onmessage = (event: MessageEvent<SalienceRequest>) => {
  const { id, bitmap, grid } = event.data;
  const started = performance.now();
  try {
    const scale = Math.min(1, WORKING_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(16, Math.round(bitmap.width * scale));
    const h = Math.max(16, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const S = salience(context.getImageData(0, 0, w, h).data, w, h);

    const onGrid = gaussianBlur(resize(S, grid.width, grid.height), 0.03 * grid.width);
    let sum = 0;
    for (let i = 0; i < onGrid.d.length; i++) {
      onGrid.d[i] = Math.max(0, onGrid.d[i]);
      sum += onGrid.d[i];
    }
    if (sum > 0) for (let i = 0; i < onGrid.d.length; i++) onGrid.d[i] /= sum;
    else onGrid.d.fill(1 / onGrid.d.length);

    const response: SalienceResponse = { id, data: onGrid.d, milliseconds: performance.now() - started };
    self.postMessage(response, [onGrid.d.buffer]);
  } catch (error) {
    const response: SalienceResponse = { id, error: error instanceof Error ? error.message : String(error) };
    self.postMessage(response);
  }
};
