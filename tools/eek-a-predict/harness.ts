// Draws the heatmap and contrast figures of eek-a-predict with the site's own drawing code; render.mjs calls it.
import { decodeRle } from '../../src/maps/areas';
import { difference, type SaliencyMap } from '../../src/maps/saliency-map';
import { decodeMap, type PrecomputedMap } from '../../src/models/deepgaze';
import type { ComparisonManifest } from '../../src/examples';
import type { Fixations } from '../../src/models/measured';
import { drawFixations } from '../../src/render/fixations';
import { drawDifference, drawGreyed, drawHeatmap, sharedRange, type HeatRange, type KeepColour } from '../../src/render/heatmap';
import { drawOutline } from '../../src/views/example';

const BASE = import.meta.env.BASE_URL;
const W = 1024;
const H = 768;
/** The site's default opacity of the fixation points (prompt 050). */
const DOT_OPACITY = 0.65;

const json = async <T>(path: string): Promise<T> => (await fetch(`${BASE}${path}`)).json();
const map = async (folder: string, id: string): Promise<SaliencyMap> => decodeMap(await json<PrecomputedMap>(`precomputed/${folder}/${id}.json`));
async function photo(id: string): Promise<ImageBitmap> {
  return createImageBitmap(await (await fetch(`${BASE}examples/${id}.jpg`)).blob());
}

function canvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

/** Stacks the layers onto one canvas, the way the page stacks them, and returns it as PNG. */
function flatten(layers: (HTMLCanvasElement | [HTMLCanvasElement, number])[]): string {
  const out = canvas();
  const context = out.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  for (const layer of layers) {
    const [c, alpha] = Array.isArray(layer) ? layer : [layer, 1];
    context.globalAlpha = alpha;
    context.drawImage(c, 0, 0, W, H);
  }
  return out.toDataURL('image/png');
}

interface Area {
  width: number;
  height: number;
  regions: { rle: number[] }[];
}

async function editedArea(example: string): Promise<KeepColour> {
  const area = await json<Area>(`precomputed/comparisons/${example}.json`);
  return { mask: decodeRle(area.regions[0].rle, area.width * area.height), width: area.width, height: area.height };
}

function outline(area: KeepColour): HTMLCanvasElement {
  const c = document.createElement('canvas');
  drawOutline(c, area.mask, area.width, area.height);
  return c;
}

function heat(bitmap: ImageBitmap, m: SaliencyMap, range?: HeatRange, keep?: KeepColour): HTMLCanvasElement[] {
  const grey = canvas();
  drawGreyed(grey, bitmap, W, H, undefined, keep);
  const layer = canvas();
  drawHeatmap(layer, m, W, H, undefined, range);
  return [grey, layer];
}

/** The figures of one example: measured and predicted maps, and the two contrasts, all with the edited area outlined. */
async function render(example: string, original: string, manipulated: string): Promise<Record<string, string>> {
  const [bitmapA, bitmapB, measured, predictedA, predictedB, points, area, manifest] = await Promise.all([
    photo(original),
    photo(manipulated),
    map('measured', original),
    map('deepgaze-msdb', original),
    map('deepgaze-msdb', manipulated),
    json<Fixations>(`precomputed/measured/${original}.points.json`),
    editedArea(example),
    json<ComparisonManifest>('examples/comparisons.json'),
  ]);
  const line = outline(area);
  // As in the Example section (prompt 080): a recolouring would vanish in grey, so its area keeps its colour.
  const keep = manifest.images.find((image) => image.id === manipulated)?.recolour ? area : undefined;
  // One heatmap scale per example for the measured map and both predictions, so all three compare.
  const range = sharedRange([measured, predictedA, predictedB]);
  const dots = canvas();
  drawFixations(dots, points, W, H, W);
  const contrast = (bitmap: ImageBitmap, field: ReturnType<typeof difference>) => {
    const grey = canvas();
    drawGreyed(grey, bitmap, W, H);
    const layer = canvas();
    drawDifference(layer, field, W, H);
    return flatten([grey, layer, line]);
  };
  return {
    measured: flatten([...heat(bitmapA, measured, range), [dots, DOT_OPACITY], line]),
    'predicted-original': flatten([...heat(bitmapA, predictedA, range), line]),
    'predicted-manipulated': flatten([...heat(bitmapB, predictedB, range, keep), line]),
    // Orange where the prediction is higher, blue where people looked more, as the page's key says.
    'contrast-measured-predicted': contrast(bitmapA, difference(predictedA, measured)),
    'contrast-manipulated-original': contrast(bitmapB, difference(predictedB, predictedA)),
  };
}

(window as unknown as { render: typeof render }).render = render;
document.title = 'ready';
