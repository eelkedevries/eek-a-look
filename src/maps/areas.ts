import { resample, type SaliencyMap } from './saliency-map';

/** One area of an AreaFile (see the specification); masks are row-major run lengths starting outside the area. */
export interface AreaInfo {
  id: string;
  label: string;
  group: 'category' | 'element';
  share: number;
  rle: number[];
  model?: string;
  instances?: number;
  meanScore?: number;
  lowConfidence?: boolean;
}

export interface AreaFile {
  photo: string;
  width: number;
  height: number;
  horizon: { row: number; method: 'vanishing-lines' | 'standing-people' | 'assumed-level' | 'equirectangular'; support: number };
  imageKind?: 'render' | 'panorama';
  params: { cameraHeightM: number; storeyHeightM: number };
  models: Record<string, string>;
  areas: AreaInfo[];
}

export interface Area extends AreaInfo {
  /** 1 inside the area, 0 outside; width × height of the file. */
  mask: Uint8Array;
}

export function decodeRle(rle: number[], length: number): Uint8Array {
  const mask = new Uint8Array(length);
  let at = 0;
  rle.forEach((run, i) => {
    if (i % 2 === 1) mask.fill(1, at, at + run);
    at += run;
  });
  return mask;
}

export function decodeAreas(file: AreaFile): Area[] {
  return file.areas.map((area) => ({ ...area, mask: decodeRle(area.rle, file.width * file.height) }));
}

/**
 * Share of a map's attention inside each area. The map is upsampled to the
 * mask size with resample(), as for display, so the shares sum to 1 over a
 * partition such as the street categories.
 */
export function attentionShares(map: SaliencyMap, areas: Area[], width: number, height: number): Map<string, number> {
  const p = resample(map, { width, height }).data;
  const shares = new Map<string, number>();
  for (const area of areas) {
    let sum = 0;
    const mask = area.mask;
    for (let i = 0; i < mask.length; i++) if (mask[i]) sum += p[i];
    shares.set(area.id, sum);
  }
  return shares;
}
