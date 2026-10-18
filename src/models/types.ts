import type { GridSize, SaliencyMap } from '../maps/saliency-map';

export interface BenchmarkScore {
  dataset: 'MIT300';
  /** Pearson correlation. */
  cc: number;
  aucJudd: number;
  source: string;
  /** ISO date. */
  retrieved: string;
}

export interface ModelSpec {
  id: 'centre-bias' | 'classic-salience' | 'unisal' | (string & {});
  /** Visitor-facing name, e.g. "Centre bias". */
  name: string;
  /** Optional visitor-facing subtitle, e.g. "small neural network". */
  subtitle?: string;
  /** 'measured' is recorded eye tracking, not a prediction: it is always labelled as measured. */
  kind: 'baseline' | 'classic' | 'neural' | 'measured';
  /**
   * 'browser': runs on the visitor's device. 'precomputed': maps computed in
   * advance on the author's GPU, so only the example photos are covered.
   * 'remote' is reserved for server-side models; there are none.
   */
  runtime: 'browser' | 'precomputed' | 'remote';
  /** Short label for tight spaces such as the agreement matrix. */
  shortName?: string;
  /** Weights plus runtime that the visitor downloads. */
  downloadBytes?: number;
  /** SPDX id or "own implementation". */
  licence: string;
  citation: string;
  /** Plain-language description, at most 20 words. */
  oneLine: string;
  benchmark?: BenchmarkScore;
  /** Set for a layer that exists for some photos only; on other photos it is left out of every view. */
  covers?(context: PredictContext): boolean;
  /** `report` receives short progress messages, such as download progress. */
  predict(image: ImageBitmap, grid: GridSize, report?: (detail: string) => void, context?: PredictContext): Promise<SaliencyMap>;
}

export interface PredictContext {
  /** Set when the photo is one of the examples. */
  exampleId?: string;
  /** True when the example photo has a measured eye-tracking map. */
  measured?: boolean;
}

/** The label on a heatmap: measured gaze is never presented as a prediction. */
export const mapLabel = (model: Pick<ModelSpec, 'kind'>) => (model.kind === 'measured' ? 'Measured' : 'Predicted');

/** Thrown by a model that does not cover the current photo; shown as "unavailable", not as a failure. */
export class UnavailableError extends Error {}

export const MIT300_SOURCE = 'https://saliency.tuebingen.ai/results.html';
export const MIT300_RETRIEVED = '2026-10-18';
