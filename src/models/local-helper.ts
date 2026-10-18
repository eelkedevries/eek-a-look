import type { GridSize } from '../maps/saliency-map';

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];
const API = `${import.meta.env.BASE_URL}local-api`;

/**
 * Whether the DeepGaze GPU helper of `npm run local` answers. Only probed when
 * the page itself is served from this computer, so the public site never
 * contacts it.
 */
export const localHelper: Promise<boolean> = LOCAL_HOSTS.includes(location.hostname)
  ? fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) })
      .then((response) => response.ok)
      .catch(() => false)
  : Promise.resolve(false);

export async function predictLocally(modelId: string, image: ImageBitmap, grid: GridSize): Promise<unknown> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  const body = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  const query = new URLSearchParams({ model: modelId, gridWidth: String(grid.width), gridHeight: String(grid.height) });
  const response = await fetch(`${API}/predict?${query}`, { method: 'POST', body });
  if (!response.ok) throw new Error(`The local helper answered HTTP ${response.status}.`);
  return response.json();
}
