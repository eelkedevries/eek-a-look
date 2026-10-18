import type { SaliencyMap } from '../../maps/saliency-map';
import { MIT300_RETRIEVED, MIT300_SOURCE, type ModelSpec } from '../types';
import type { UnisalMessage, UnisalRequest } from './worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (message: UnisalMessage) => void>();

/** The worker starts on first use, after the page has painted, so the download never delays first paint. */
async function getWorker(): Promise<Worker> {
  if (!worker) {
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<UnisalMessage>) => pending.get(event.data.id)?.(event.data);
  }
  return worker;
}

export let lastBackend = '';

export const unisal: ModelSpec = {
  id: 'unisal',
  name: 'UNISAL',
  subtitle: 'small neural network',
  shortName: 'UNISAL',
  kind: 'neural',
  runtime: 'browser',
  // Model (6.4 MB) plus the WebAssembly runtime (14.2 MB), before compression.
  downloadBytes: 20_700_000,
  licence: 'Apache-2.0',
  citation: 'Droste, Jiao & Noble (2020), ECCV',
  oneLine: 'A small neural network trained on eye- and mouse-tracking data from thousands of images and videos.',
  benchmark: { dataset: 'MIT300', cc: 0.7851, aucJudd: 0.8772, source: MIT300_SOURCE, retrieved: MIT300_RETRIEVED },
  async predict(image, grid, report): Promise<SaliencyMap> {
    const bitmap = await createImageBitmap(image);
    const id = nextId++;
    const target = await getWorker();
    return new Promise((resolve, reject) => {
      pending.set(id, (message) => {
        if (message.type === 'progress') {
          report?.(message.detail);
          return;
        }
        pending.delete(id);
        if (message.type === 'error') {
          reject(new Error(message.message));
          return;
        }
        lastBackend = message.backend;
        if (import.meta.env.DEV) console.info(`[eek-a-look] UNISAL: ${message.milliseconds.toFixed(0)} ms (${message.backend})`);
        resolve({ width: grid.width, height: grid.height, data: message.data });
      });
      const request: UnisalRequest = { id, bitmap, grid: { width: grid.width, height: grid.height } };
      target.postMessage(request, [bitmap]);
    });
  },
};
