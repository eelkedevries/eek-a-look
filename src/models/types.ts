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
  /** 'remote' is reserved for large server-side models; v1 has none. */
  runtime: 'browser' | 'remote';
  /** Weights plus runtime that the visitor downloads. */
  downloadBytes?: number;
  /** SPDX id or "own implementation". */
  licence: string;
  citation: string;
  /** Plain-language description, at most 20 words. */
  oneLine: string;
  benchmark?: BenchmarkScore;
  /** `report` receives short progress messages, such as download progress. */
  predict(image: ImageBitmap, grid: GridSize, report?: (detail: string) => void): Promise<SaliencyMap>;
}

export const MIT300_SOURCE = 'https://saliency.tuebingen.ai/results.html';
export const MIT300_RETRIEVED = '2026-10-18';
