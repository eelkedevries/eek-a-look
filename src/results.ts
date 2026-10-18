import { assertProbability, gridFor, type GridSize, type SaliencyMap } from './maps/saliency-map';
import { models } from './models/registry';
import { UnavailableError } from './models/types';
import { onImageChange, type CurrentImage } from './state';

export type ModelStatus =
  | { state: 'computing'; detail?: string }
  | { state: 'ready'; map: SaliencyMap }
  | { state: 'failed'; message: string }
  | { state: 'unavailable'; message: string };

export interface Results {
  image: CurrentImage;
  grid: GridSize;
  status: Map<string, ModelStatus>;
}

type Listener = (results: Results, changedModelId?: string) => void;

const listeners = new Set<Listener>();
let current: Results | null = null;

export function getResults(): Results | null {
  return current;
}

export function onResults(listener: Listener): void {
  listeners.add(listener);
}

function emit(results: Results, modelId?: string) {
  if (results !== current) return;
  for (const listener of listeners) listener(results, modelId);
}

/** Runs every model on each new image; results for a superseded image are dropped. */
onImageChange((image) => {
  const grid = gridFor(image.width, image.height);
  const results: Results = { image, grid, status: new Map(models.map((m) => [m.id, { state: 'computing' }])) };
  current = results;
  emit(results);

  for (const model of models) {
    const report = (detail: string) => {
      if (results.status.get(model.id)?.state !== 'computing') return;
      results.status.set(model.id, { state: 'computing', detail });
      emit(results, model.id);
    };
    model
      .predict(image.bitmap, grid, report, { exampleId: image.exampleId })
      .then((map) => {
        if (import.meta.env.DEV) assertProbability(map, model.name);
        results.status.set(model.id, { state: 'ready', map });
      })
      .catch((error: unknown) => {
        if (error instanceof UnavailableError) {
          results.status.set(model.id, { state: 'unavailable', message: error.message });
          return;
        }
        console.error(error);
        results.status.set(model.id, { state: 'failed', message: error instanceof Error ? error.message : String(error) });
      })
      .finally(() => emit(results, model.id));
  }
});
