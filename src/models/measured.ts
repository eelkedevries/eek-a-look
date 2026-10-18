import { decodeMap, fitGrid, type PrecomputedMap } from './deepgaze';
import { UnavailableError, type ModelSpec } from './types';

/**
 * Measured gaze: where 48 people looked at the Zürich photos, from the eye-tracking
 * dataset of Wilming et al. (2017). Built by tools/measured-gaze/; only those
 * photos have it, and on every other photo the layer is left out.
 */
export const measuredGaze: ModelSpec = {
  id: 'measured',
  name: 'Measured gaze',
  subtitle: '48 people, eye tracking',
  kind: 'measured',
  runtime: 'precomputed',
  licence: 'CC0 1.0',
  citation: 'Wilming et al. (2017); Onat et al. (2014)',
  oneLine: 'Where 48 people actually looked at this photo, recorded with an eye tracker in a lab.',
  covers: (context) => context.measured === true,
  async predict(_image, grid, _report, context) {
    if (!context?.exampleId) throw new UnavailableError('Measured for the Zürich photos only.');
    const response = await fetch(`${import.meta.env.BASE_URL}precomputed/measured/${context.exampleId}.json`);
    if (!response.ok) throw new Error(`The measured map could not be loaded (HTTP ${response.status}).`);
    return fitGrid(decodeMap((await response.json()) as PrecomputedMap), grid);
  },
};
