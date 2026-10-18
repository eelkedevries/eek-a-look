import { normalise, resample, type GridSize, type SaliencyMap } from '../maps/saliency-map';
import { MIT300_RETRIEVED, MIT300_SOURCE, UnavailableError, type ModelSpec } from './types';

interface PrecomputedMap {
  model: string;
  photo: string | null;
  grid: GridSize;
  encoding: 'uint16-base64';
  data: string;
}

/** Decodes little-endian uint16 values (scaled to their maximum) from base64 into a probability map. */
export function decodeMap(payload: PrecomputedMap): SaliencyMap {
  const bytes = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const values = new Float32Array(bytes.length / 2);
  for (let i = 0; i < values.length; i++) values[i] = view.getUint16(i * 2, true);
  return normalise(payload.grid, values);
}

function deepGaze(spec: Omit<ModelSpec, 'predict' | 'runtime' | 'kind' | 'licence'>): ModelSpec {
  return {
    ...spec,
    kind: 'neural',
    runtime: 'precomputed',
    licence: 'maps only; DeepGaze code and weights are not redistributed',
    async predict(_image, grid, _report, context) {
      if (!context?.exampleId) throw new UnavailableError('Computed in advance for the example photos only.');
      const response = await fetch(`${import.meta.env.BASE_URL}precomputed/${spec.id}/${context.exampleId}.json`);
      if (!response.ok) throw new UnavailableError('No pre-computed map for this photo.');
      const map = decodeMap(await response.json());
      return map.width === grid.width && map.height === grid.height ? map : resample(map, grid);
    },
  };
}

export const deepGazeIIE = deepGaze({
  id: 'deepgaze-iie',
  name: 'DeepGaze IIE',
  shortName: 'DG IIE',
  subtitle: 'large model, computed in advance',
  citation: 'Linardos, Kümmerer, Press & Bethge (2021), ICCV',
  oneLine: 'A large neural network combining four image-recognition networks, trained on eye-tracking data.',
  benchmark: { dataset: 'MIT300', cc: 0.8242, aucJudd: 0.8829, source: MIT300_SOURCE, retrieved: MIT300_RETRIEVED },
});

export const deepGazeMSDB = deepGaze({
  id: 'deepgaze-msdb',
  name: 'DeepGaze MSDB',
  shortName: 'DG MSDB',
  subtitle: 'large model, computed in advance',
  citation: 'Kümmerer, Khanuja & Bethge (2025), ICCV',
  oneLine: 'The best-scoring open model: CLIP and DINOv2 image features read out at several scales.',
  benchmark: { dataset: 'MIT300', cc: 0.8832, aucJudd: 0.8942, source: MIT300_SOURCE, retrieved: MIT300_RETRIEVED },
});
