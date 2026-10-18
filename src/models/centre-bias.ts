import { normalise, type GridSize } from '../maps/saliency-map';
import { MIT300_RETRIEVED, MIT300_SOURCE, type ModelSpec } from './types';

// Clarke & Tatler (2014), Vision Research 102, 41–51: a zero-mean Gaussian with
// covariance diag(σ², ν·σ²), in coordinates scaled by half the image width, so
// x ∈ [−1, 1] and y ∈ [−a, a] with a = height / width.
const SIGMA2 = 0.22;
const NU = 0.45;

export function centreBiasValues(grid: GridSize, imageWidth: number, imageHeight: number): Float64Array {
  const aspect = imageHeight / imageWidth;
  const values = new Float64Array(grid.width * grid.height);
  for (let row = 0; row < grid.height; row++) {
    const y = ((row + 0.5) / grid.height - 0.5) * 2 * aspect;
    for (let col = 0; col < grid.width; col++) {
      const x = ((col + 0.5) / grid.width - 0.5) * 2;
      values[row * grid.width + col] = Math.exp(-(x * x) / (2 * SIGMA2) - (y * y) / (2 * NU * SIGMA2));
    }
  }
  return values;
}

export const centreBias: ModelSpec = {
  id: 'centre-bias',
  name: 'Centre bias',
  shortName: 'Centre',
  kind: 'baseline',
  runtime: 'browser',
  licence: 'own implementation',
  citation: 'Clarke & Tatler (2014), Vision Research 102, 41–51',
  oneLine: 'People tend to look at the middle of a picture, whatever it shows.',
  benchmark: { dataset: 'MIT300', cc: 0.4455, aucJudd: 0.783, source: MIT300_SOURCE, retrieved: MIT300_RETRIEVED },
  async predict(image, grid) {
    return normalise(grid, centreBiasValues(grid, image.width, image.height));
  },
};
