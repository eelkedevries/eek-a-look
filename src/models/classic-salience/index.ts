import type { SaliencyMap } from '../../maps/saliency-map';
import type { ModelSpec } from '../types';
import type { SalienceRequest, SalienceResponse } from './worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: SalienceResponse) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<SalienceResponse>) => {
      pending.get(event.data.id)?.resolve(event.data);
      pending.delete(event.data.id);
    };
  }
  return worker;
}

export const classicSalience: ModelSpec = {
  id: 'classic-salience',
  name: 'Classic salience',
  kind: 'classic',
  runtime: 'browser',
  licence: 'own implementation',
  citation: 'Itti, Koch & Niebur (1998), IEEE TPAMI 20(11), 1254–1259',
  oneLine: 'Spots that stand out in brightness, colour or edge direction.',
  async predict(image, grid): Promise<SaliencyMap> {
    const bitmap = await createImageBitmap(image);
    const id = nextId++;
    const response = await new Promise<SalienceResponse>((resolve) => {
      pending.set(id, { resolve });
      const request: SalienceRequest = { id, bitmap, grid: { width: grid.width, height: grid.height } };
      getWorker().postMessage(request, [bitmap]);
    });
    if (!response.data) throw new Error(response.error ?? 'Classic salience failed.');
    if (import.meta.env.DEV) console.info(`[eek-a-look] classic salience: ${response.milliseconds?.toFixed(0)} ms`);
    return { width: grid.width, height: grid.height, data: response.data };
  },
};
