export interface GridSize {
  width: number;
  height: number;
}

/** A probability map: non-negative values that sum to 1, row-major. */
export interface SaliencyMap extends GridSize {
  data: Float32Array;
}

/** A signed field on a grid, such as the difference of two maps. */
export interface SignedField extends GridSize {
  data: Float32Array;
}

const LONG_SIDE = 128;

/** The shared comparison grid: 128 cells on the long side, aspect ratio kept. */
export function gridFor(width: number, height: number): GridSize {
  if (width >= height) {
    return { width: LONG_SIDE, height: Math.max(1, Math.round((LONG_SIDE * height) / width)) };
  }
  return { width: Math.max(1, Math.round((LONG_SIDE * width) / height)), height: LONG_SIDE };
}

/** Clamps negatives to zero and scales to sum 1; an all-zero input becomes uniform. */
export function normalise(grid: GridSize, values: ArrayLike<number>): SaliencyMap {
  const data = new Float32Array(grid.width * grid.height);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(0, Number(values[i]) || 0);
    data[i] = v;
    sum += v;
  }
  if (sum > 0) for (let i = 0; i < data.length; i++) data[i] /= sum;
  else data.fill(1 / data.length);
  return { ...grid, data };
}

/** Bilinear resampling to another grid (cell centres aligned), renormalised. */
export function resample(source: GridSize & { data: ArrayLike<number> }, target: GridSize): SaliencyMap {
  const out = new Float32Array(target.width * target.height);
  const sx = source.width / target.width;
  const sy = source.height / target.height;
  for (let y = 0; y < target.height; y++) {
    const fy = Math.min(Math.max((y + 0.5) * sy - 0.5, 0), source.height - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, source.height - 1);
    const wy = fy - y0;
    for (let x = 0; x < target.width; x++) {
      const fx = Math.min(Math.max((x + 0.5) * sx - 0.5, 0), source.width - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, source.width - 1);
      const wx = fx - x0;
      const top = source.data[y0 * source.width + x0] * (1 - wx) + source.data[y0 * source.width + x1] * wx;
      const bottom = source.data[y1 * source.width + x0] * (1 - wx) + source.data[y1 * source.width + x1] * wx;
      out[y * target.width + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return normalise(target, out);
}

export function pearson(a: SaliencyMap, b: SaliencyMap): number {
  const n = a.data.length;
  if (n !== b.data.length) throw new Error('Maps are on different grids.');
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a.data[i];
    meanB += b.data[i];
  }
  meanA /= n;
  meanB /= n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a.data[i] - meanA;
    const db = b.data[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  return varA > 0 && varB > 0 ? cov / Math.sqrt(varA * varB) : 0;
}

export function difference(a: SaliencyMap, b: SaliencyMap): SignedField {
  if (a.data.length !== b.data.length) throw new Error('Maps are on different grids.');
  const data = new Float32Array(a.data.length);
  for (let i = 0; i < data.length; i++) data[i] = a.data[i] - b.data[i];
  return { width: a.width, height: a.height, data };
}

export function assertProbability(map: SaliencyMap, source: string): void {
  let sum = 0;
  let negative = false;
  for (const v of map.data) {
    sum += v;
    if (v < 0) negative = true;
  }
  if (negative || Math.abs(sum - 1) > 1e-6 || map.data.length !== map.width * map.height) {
    console.error(`[eek-a-look] ${source} returned an invalid map (sum ${sum}, negative ${negative}).`);
  }
}
