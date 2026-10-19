import { onImageChange } from '../state';
import { decodeMap, fitGrid, type PrecomputedMap } from './deepgaze';
import { UnavailableError, type ModelSpec } from './types';

/** The fixations a measured map was built from, in 0-based photo pixels. */
export interface Fixations {
  photo: string;
  width: number;
  height: number;
  observers: number;
  points: [number, number][];
}

const fixations = new Map<string, Promise<Fixations>>();

/** Loads a photo's fixations once; a failed load is forgotten so it can be tried again. */
export function loadFixations(exampleId: string): Promise<Fixations> {
  let pending = fixations.get(exampleId);
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}precomputed/measured/${exampleId}.points.json`).then((response) => {
      if (!response.ok) throw new Error(`The fixations could not be loaded (HTTP ${response.status}).`);
      return response.json() as Promise<Fixations>;
    });
    fixations.set(exampleId, pending);
    pending.catch(() => fixations.delete(exampleId));
  }
  return pending;
}

/**
 * Measured gaze: where people looked at the Zürich photos (48 each, Wilming et al. 2017) and at
 * the photos of Andersson et al. (2017, 2 to 5 each). Built by tools/measured-gaze/; only those
 * photos have it, and on every other photo the layer is left out.
 */
export const measuredGaze: ModelSpec = {
  id: 'measured',
  name: 'Measured gaze',
  subtitle: 'eye tracking',
  kind: 'measured',
  runtime: 'precomputed',
  licence: 'CC0 1.0 (Wilming et al.); GNU GPL 3.0 (Andersson et al.)',
  citation: 'Wilming et al. (2017); Onat et al. (2014); Andersson et al. (2017)',
  oneLine: 'Where people actually looked at this photo, recorded with an eye tracker in a lab.',
  covers: (context) => context.measured === true,
  async predict(_image, grid, _report, context) {
    if (!context?.exampleId) throw new UnavailableError('Measured for some example photos only.');
    const response = await fetch(`${import.meta.env.BASE_URL}precomputed/measured/${context.exampleId}.json`);
    if (!response.ok) throw new Error(`The measured map could not be loaded (HTTP ${response.status}).`);
    return fitGrid(decodeMap((await response.json()) as PrecomputedMap), grid);
  },
};

// The number of people differs per dataset, so the subtitle follows the photo. Registered on import, before
// results.ts runs the layers for a new photo.
onImageChange((image) => {
  measuredGaze.subtitle = image.measuredCounts ? `${image.measuredCounts.observers} people, eye tracking` : 'eye tracking';
});
