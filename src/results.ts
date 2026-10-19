import { assertProbability, gridFor, type GridSize, type SaliencyMap } from './maps/saliency-map';
import { models, NEURAL_PREFERENCE } from './models/registry';
import { UnavailableError, type ModelSpec } from './models/types';
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

/** The layers that cover this image, in display order; a layer such as measured gaze is absent on other photos. */
export function modelsFor(results: Results): ModelSpec[] {
  return models.filter((m) => results.status.has(m.id));
}

/** The best neural model that covers this photo: the first in NEURAL_PREFERENCE that is not unavailable or failed. */
export function bestModel(results: Results): string | undefined {
  return NEURAL_PREFERENCE.find((id) => !['unavailable', 'failed'].includes(results.status.get(id)?.state ?? 'unavailable'));
}

/**
 * The layer the single-map view shows for a chosen one: the chosen layer if this photo has it and it can run
 * here, otherwise the best neural model that can. A layer the photo lacks, such as measured gaze on the Dutch
 * photos, hands over silently; `wanted` differs from the choice only then.
 */
export function shownLayer(results: Results, selected: string): { wanted: string; shown: string } {
  const wanted = results.status.has(selected) ? selected : NEURAL_PREFERENCE[0];
  const shown =
    results.status.get(wanted)?.state === 'unavailable'
      ? (NEURAL_PREFERENCE.find((id) => !['unavailable', 'failed'].includes(results.status.get(id)?.state ?? '')) ?? wanted)
      : wanted;
  return { wanted, shown };
}

/** The map others are scored against: measured gaze where the photo has it, otherwise the best neural model. */
export function referenceModel(results: Results): string | undefined {
  return results.status.has('measured') ? 'measured' : bestModel(results);
}

function emit(results: Results, modelId?: string) {
  if (results !== current) return;
  for (const listener of listeners) listener(results, modelId);
}

/** Runs every model on each new image; results for a superseded image are dropped. */
onImageChange((image) => {
  const grid = gridFor(image.width, image.height);
  const context = { exampleId: image.exampleId, measured: image.measured };
  const active = models.filter((m) => m.covers?.(context) ?? true);
  const results: Results = { image, grid, status: new Map(active.map((m) => [m.id, { state: 'computing' }])) };
  current = results;
  emit(results);

  for (const model of active) {
    const report = (detail: string) => {
      if (results.status.get(model.id)?.state !== 'computing') return;
      results.status.set(model.id, { state: 'computing', detail });
      emit(results, model.id);
    };
    model
      .predict(image.bitmap, grid, report, context)
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
