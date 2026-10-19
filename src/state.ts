export type ImageSource = 'example' | 'upload';

export interface CurrentImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  source: ImageSource;
  /** Example photo id; absent for uploads. */
  exampleId?: string;
  /** True when the example photo has a measured eye-tracking map. */
  measured?: boolean;
  /** The observers and fixations behind the measured map, on photos that have one. */
  measuredCounts?: { observers: number; fixations: number };
}

type Listener = (image: CurrentImage) => void;

let current: CurrentImage | null = null;
const listeners = new Set<Listener>();

export function getImage(): CurrentImage | null {
  return current;
}

export function setImage(image: CurrentImage): void {
  current?.bitmap.close();
  current = image;
  for (const listener of listeners) listener(image);
}

export function onImageChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
