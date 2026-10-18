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
  kind: 'baseline' | 'classic' | 'neural';
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
  /** `report` receives short progress messages, such as download progress. */
  predict(image: ImageBitmap, grid: GridSize, report?: (detail: string) => void, context?: PredictContext): Promise<SaliencyMap>;
}

export interface PredictContext {
  /** Set when the photo is one of the examples. */
  exampleId?: string;
}

/** Thrown by a model that does not cover the current photo; shown as "unavailable", not as a failure. */
export class UnavailableError extends Error {}

export const MIT300_SOURCE = 'https://saliency.tuebingen.ai/results.html';
export const MIT300_RETRIEVED = '2026-10-18';
