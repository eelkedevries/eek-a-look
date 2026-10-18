import { gridFor, pearson } from '../maps/saliency-map';
import { unisal } from '../models/unisal';

/**
 * Development check, run with ?check=unisal: compares the browser's UNISAL
 * output for one example with the output saved by tools/unisal-export.
 */
export async function checkUnisalReference(): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const reference = await (await fetch(`${base}tools/unisal-export/reference/weena-delftse-poort.json`)).json();
  const bitmap = await createImageBitmap(await (await fetch(`${base}examples/weena-delftse-poort.jpg`)).blob());
  const grid = gridFor(bitmap.width, bitmap.height);
  const map = await unisal.predict(bitmap, grid);
  const r = pearson(map, { ...reference.grid, data: Float32Array.from(reference.data) });
  console.info(`[eek-a-look] UNISAL reference check: r = ${r.toFixed(4)} (${r >= 0.98 ? 'pass' : 'FAIL'}, threshold 0.98)`);
}
