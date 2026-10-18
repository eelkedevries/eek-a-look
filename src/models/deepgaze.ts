import { normalise, resample, type GridSize, type SaliencyMap } from '../maps/saliency-map';
import { localHelper, predictLocally } from './local-helper';
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

const fitGrid = (map: SaliencyMap, grid: GridSize) =>
  map.width === grid.width && map.height === grid.height ? map : resample(map, grid);

function deepGaze(spec: Omit<ModelSpec, 'predict' | 'runtime' | 'kind' | 'licence'>): ModelSpec {
  const model: ModelSpec = {
    ...spec,
    kind: 'neural',
    runtime: 'precomputed',
    licence: 'maps only; DeepGaze code and weights are not redistributed',
    async predict(image, grid, report, context) {
      // Copy before the first await: the app closes a photo's bitmap when the next one arrives.
      const copy = context?.exampleId ? null : createImageBitmap(image);
      if (context?.exampleId) {
        const response = await fetch(`${import.meta.env.BASE_URL}precomputed/${spec.id}/${context.exampleId}.json`);
        if (response.ok) return fitGrid(decodeMap(await response.json()), grid);
      }
      // Photos without a pre-computed map need the GPU helper of `npm run local`.
      if (!(await localHelper)) throw new UnavailableError('Computed in advance for the example photos only.');
      report?.('Running on this computer’s GPU…');
      const bitmap = await (copy ?? createImageBitmap(image));
      try {
        return fitGrid(decodeMap((await predictLocally(spec.id, bitmap, grid)) as PrecomputedMap), grid);
      } finally {
        bitmap.close();
      }
    },
  };
  localHelper.then((available) => {
    if (available) model.subtitle = 'large model, running on this computer’s GPU';
  });
  return model;
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
