/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';

interface ModelInfo {
  file: string;
  mean: [number, number, number];
  std: [number, number, number];
  featureStride: number;
  priorScaling: number;
  /** [gaussian][y, x][mu, log std] */
  priorParams: number[][][];
}

export type UnisalRequest = { id: number; bitmap: ImageBitmap; grid: { width: number; height: number } };

export type UnisalMessage =
  | { id: number; type: 'progress'; detail: string }
  | { id: number; type: 'result'; data: Float32Array; milliseconds: number; backend: string }
  | { id: number; type: 'error'; message: string };

const BASE = `${import.meta.env.BASE_URL}models/unisal/`;

ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

let ready: Promise<{ session: ort.InferenceSession; info: ModelInfo }> | null = null;

async function fetchWithProgress(url: string, report: (detail: string) => void): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Could not download the model (HTTP ${response.status}).`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const mb = (loaded / 1e6).toFixed(1);
    report(total ? `Downloading the model: ${mb} of ${(total / 1e6).toFixed(1)} MB` : `Downloading the model: ${mb} MB`);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function load(report: (detail: string) => void) {
  ready ??= (async () => {
    const info: ModelInfo = await (await fetch(`${BASE}model.json`)).json();
    const bytes = await fetchWithProgress(BASE + info.file, report);
    report('Starting the model…');
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    return { session, info };
  })();
  ready.catch(() => (ready = null));
  return ready;
}

/** UNISAL's MIT1003 input size: 32·(n1, n2), 100 ≤ n1·n2 ≤ 120, closest in aspect ratio. */
export function inputSize(height: number, width: number): [number, number] {
  const aspect = height / width;
  let best: [number, number] = [9, 13];
  let bestRatio = -1;
  for (let n1 = 7; n1 < 14; n1++) {
    for (let n2 = 7; n2 < 14; n2++) {
      if (n1 * n2 < 100 || n1 * n2 > 120) continue;
      const ratio = Math.min(aspect, n1 / n2) / Math.max(aspect, n1 / n2);
      if (ratio > bestRatio) {
        best = [n1, n2];
        bestRatio = ratio;
      }
    }
  }
  return [best[0] * 32, best[1] * 32];
}

const linspace = (n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? 0 : i / (n - 1)));

/** The Gaussian prior maps exactly as UNISAL builds them, from its learned parameters. */
function priorMaps(info: ModelInfo, fh: number, fw: number): Float32Array {
  const ys = linspace(fh);
  const xs = linspace(fw);
  const out = new Float32Array(info.priorParams.length * fh * fw);
  info.priorParams.forEach(([[muY, logStdY], [muX, logStdX]], g) => {
    const sy = Math.exp(logStdY);
    const sx = Math.exp(logStdX);
    for (let y = 0; y < fh; y++) {
      const gy = Math.exp(-(((ys[y] - muY) / sy) ** 2) / 2);
      for (let x = 0; x < fw; x++) {
        out[(g * fh + y) * fw + x] = gy * Math.exp(-(((xs[x] - muX) / sx) ** 2) / 2) * info.priorScaling;
      }
    }
  });
  return out;
}

/** Resizes to the model's input size (as UNISAL does) and normalises to NCHW. */
function preprocess(bitmap: ImageBitmap, info: ModelInfo, h: number, w: number): Float32Array {
  const canvas = new OffscreenCanvas(w, h);
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, w, h);
  const rgba = context.getImageData(0, 0, w, h).data;
  const out = new Float32Array(3 * h * w);
  for (let i = 0; i < h * w; i++) {
    for (let c = 0; c < 3; c++) out[c * h * w + i] = (rgba[i * 4 + c] / 255 - info.mean[c]) / info.std[c];
  }
  return out;
}

/** exp of the log density, resampled bilinearly (cell centres aligned) to the grid, normalised. */
function toGrid(logDensity: Float32Array, h: number, w: number, grid: { width: number; height: number }): Float32Array {
  let max = -Infinity;
  for (const v of logDensity) max = Math.max(max, v);
  const p = logDensity.map((v) => Math.exp(v - max));
  const out = new Float32Array(grid.width * grid.height);
  let sum = 0;
  for (let y = 0; y < grid.height; y++) {
    const fy = Math.min(Math.max((y + 0.5) * (h / grid.height) - 0.5, 0), h - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, h - 1);
    const wy = fy - y0;
    for (let x = 0; x < grid.width; x++) {
      const fx = Math.min(Math.max((x + 0.5) * (w / grid.width) - 0.5, 0), w - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, w - 1);
      const wx = fx - x0;
      const v =
        (p[y0 * w + x0] * (1 - wx) + p[y0 * w + x1] * wx) * (1 - wy) +
        (p[y1 * w + x0] * (1 - wx) + p[y1 * w + x1] * wx) * wy;
      out[y * grid.width + x] = v;
      sum += v;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

self.onmessage = async (event: MessageEvent<UnisalRequest>) => {
  const { id, bitmap, grid } = event.data;
  const post = (message: UnisalMessage, transfer: Transferable[] = []) => self.postMessage(message, transfer);
  try {
    const { session, info } = await load((detail) => post({ id, type: 'progress', detail }));
    post({ id, type: 'progress', detail: 'Computing…' });
    const started = performance.now();
    const [h, w] = inputSize(bitmap.height, bitmap.width);
    const image = new ort.Tensor('float32', preprocess(bitmap, info, h, w), [1, 3, h, w]);
    bitmap.close();
    const fh = h / info.featureStride;
    const fw = w / info.featureStride;
    const prior = new ort.Tensor('float32', priorMaps(info, fh, fw), [1, info.priorParams.length, fh, fw]);
    const { log_density } = await session.run({ image, prior });
    const data = toGrid(log_density.data as Float32Array, h, w, grid);
    const threads = ort.env.wasm.numThreads ?? 1;
    post({ id, type: 'result', data, milliseconds: performance.now() - started, backend: `CPU, ${threads} thread${threads === 1 ? '' : 's'}` }, [data.buffer]);
  } catch (error) {
    post({ id, type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
