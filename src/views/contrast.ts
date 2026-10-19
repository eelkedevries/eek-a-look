import { difference, pearson } from '../maps/saliency-map';
import { models } from '../models/registry';
import { mapLabel, type ModelSpec } from '../models/types';
import { BLUE_ORANGE, cssColour } from '../render/colormaps';
import { dotsOver, dotsTag, fixationLayer, syncFixations } from '../render/fixations';
import { drawDifference, drawGreyed, drawHeatmap } from '../render/heatmap';
import { bestModel, getResults, modelsFor, onResults, type Results } from '../results';
import { onViewState } from '../view-state';

const WIDTH = 1200;
const PAIR_WIDTH = 600;

const byId = (id: string) => models.find((m) => m.id === id)!;
const short = (m: ModelSpec) => m.shortName ?? m.name;
const usable = (results: Results, id: string) => !['unavailable', 'failed'].includes(results.status.get(id)?.state ?? 'unavailable');
const fixed = (r: number) => r.toFixed(2).replace(/^-(0\.00)$/, '$1');

/**
 * The default pair: measured gaze (where the photo has it), otherwise the next-best model,
 * against the best neural model.
 */
function defaults(results: Results): [string, string] | undefined {
  const b = bestModel(results);
  if (!b) return undefined;
  const order = [...models.filter((m) => m.kind === 'measured'), ...[...models].reverse()];
  const a = order.find((m) => m.id !== b && usable(results, m.id));
  return a ? [a.id, b] : undefined;
}

// The visitor's own pair, kept across photos while both maps cover the new photo.
let chosen: [string, string] | null = null;
let redraw: () => void = () => {};

/** Shows map `a` minus map `b`. */
export function contrastWith(a: string, b: string): void {
  chosen = [a, b];
  redraw();
}

function select(label: string): { wrap: HTMLLabelElement; select: HTMLSelectElement } {
  const wrap = document.createElement('label');
  wrap.className = 'contrast-pick';
  const text = document.createElement('span');
  text.textContent = label;
  const select = document.createElement('select');
  wrap.append(text, select);
  return { wrap, select };
}

interface Beneath {
  figure: HTMLElement;
  model: ModelSpec;
  tag: HTMLElement;
  dots: HTMLCanvasElement;
}

/** One of the two maps beneath the contrast, with a canvas for the fixation points (see `dotsOver`). */
function heatFigure(
  results: Results,
  model: ModelSpec,
  map: Parameters<typeof drawHeatmap>[1],
  w: number,
  h: number,
): Beneath {
  const figure = document.createElement('figure');
  figure.className = 'contrast-map';
  const frame = document.createElement('div');
  frame.className = 'frame';
  const greyed = document.createElement('canvas');
  greyed.className = 'photo';
  drawGreyed(greyed, results.image.bitmap, w, h);
  const layer = document.createElement('canvas');
  layer.className = 'layer';
  drawHeatmap(layer, map, w, h);
  const tag = document.createElement('span');
  tag.className = model.kind === 'measured' ? 'predicted-tag measured' : 'predicted-tag';
  tag.textContent = mapLabel(model);
  const dots = fixationLayer();
  frame.append(greyed, layer, dots, tag);
  const caption = document.createElement('figcaption');
  caption.textContent = model.name;
  figure.append(frame, caption);
  return { figure, model, tag, dots };
}

/**
 * The contrast view: one map minus another, by default against the best model, with both maps beneath.
 * The selectors go in `controls`, the inspector's Contrast section.
 */
export function mountContrast(panel: HTMLElement, controls: HTMLElement): void {
  controls.classList.add('contrast-controls');
  const pickA = select('Map');
  const pickB = select('Against');
  const swap = document.createElement('button');
  swap.type = 'button';
  swap.className = 'contrast-swap';
  swap.setAttribute('aria-label', 'Swap the two maps');
  swap.textContent = '⇄ Swap';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'link-button';
  reset.textContent = 'Reset to the best model';
  controls.append(pickA.wrap, swap, pickB.wrap, reset);
  const score = document.createElement('span');
  score.className = 'contrast-score';

  const legend = document.createElement('div');
  legend.className = 'legend contrast-legend';
  const less = document.createElement('span');
  const more = document.createElement('span');
  const bar = document.createElement('span');
  bar.className = 'legend-bar legend-bar-wide';
  bar.style.background = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => cssColour(BLUE_ORANGE, t)).join(', ')})`;
  legend.append(less, bar, more, score);

  const stage = document.createElement('div');
  stage.className = 'stage';
  const note = document.createElement('p');
  note.className = 'stage-empty';
  stage.append(note);
  const caption = document.createElement('p');
  caption.className = 'contrast-caption';
  const pair = document.createElement('div');
  pair.className = 'contrast-pair';
  panel.replaceChildren(legend, stage, caption, pair);

  let drawnKey = '';
  let drawnFor: Results | null = null;
  let dots: { maps: Beneath[]; results: Results; w: number; h: number } | null = null;
  const syncDots = () => {
    if (!dots) return;
    for (const map of dots.maps) {
      syncFixations(map.dots, dots.results.image, dotsOver(map.model), dots.w, dots.h);
      map.tag.textContent = mapLabel(map.model) + dotsTag(map.dots, map.model);
    }
  };

  function current(results: Results): [string, string] | undefined {
    if (chosen && chosen.every((id) => usable(results, id))) return chosen;
    return defaults(results);
  }

  function fillSelect(target: HTMLSelectElement, results: Results, value: string) {
    target.replaceChildren(
      ...modelsFor(results).map((m) => {
        const option = document.createElement('option');
        option.value = m.id;
        option.disabled = !usable(results, m.id);
        option.textContent = option.disabled ? `${m.name} (example photos only)` : m.name;
        option.selected = m.id === value;
        return option;
      }),
    );
  }

  function update(results = getResults()) {
    if (!results) return;
    const pairIds = current(results);
    if (!pairIds) {
      note.textContent = 'No neural model could run, so there is nothing to contrast.';
      stage.replaceChildren(note);
      pair.replaceChildren();
      dots = null;
      caption.textContent = score.textContent = '';
      drawnKey = '';
      return;
    }
    const [aId, bId] = pairIds;
    const [a, b] = [byId(aId), byId(bId)];
    fillSelect(pickA.select, results, aId);
    fillSelect(pickB.select, results, bId);
    less.textContent = `more in ${short(b)}`;
    more.textContent = `more in ${short(a)}`;

    caption.textContent =
      a.kind === 'measured'
        ? `Orange: people looked here more than ${b.name} predicts. Blue: less than predicted. Grey: about the same.`
        : b.kind === 'measured'
          ? `Orange: ${a.name} predicts more looking here than people showed. Blue: less. Grey: about the same.`
          : `Orange: ${a.name} expects more looking here than ${b.name}. Blue: less. Grey: about the same.`;

    if (aId === bId) {
      note.textContent = 'Choose two different maps.';
      stage.replaceChildren(note);
      pair.replaceChildren();
      dots = null;
      score.textContent = '';
      drawnKey = '';
      return;
    }

    const sa = results.status.get(aId);
    const sb = results.status.get(bId);
    if (sa?.state !== 'ready' || sb?.state !== 'ready') {
      note.textContent = `Waiting for ${sa?.state === 'ready' ? b.name : a.name}…`;
      stage.replaceChildren(note);
      pair.replaceChildren();
      dots = null;
      score.textContent = '';
      drawnKey = '';
      return;
    }

    const key = `${aId}|${bId}`;
    if (drawnFor === results && drawnKey === key) return;
    drawnFor = results;
    drawnKey = key;

    const r = pearson(sa.map, sb.map);
    score.textContent = `match r = ${fixed(r)}`;
    score.title = 'Correlation of the two maps: 0 = unrelated · 1 = same pattern';

    const scale = Math.min(1, WIDTH / results.image.width);
    const w = Math.round(results.image.width * scale);
    const h = Math.round(results.image.height * scale);
    const frame = document.createElement('div');
    frame.className = 'frame';
    const greyed = document.createElement('canvas');
    greyed.className = 'photo';
    drawGreyed(greyed, results.image.bitmap, w, h);
    const layer = document.createElement('canvas');
    layer.className = 'layer';
    drawDifference(layer, difference(sa.map, sb.map), w, h);
    const tag = document.createElement('span');
    tag.className = a.kind === 'measured' || b.kind === 'measured' ? 'predicted-tag measured' : 'predicted-tag';
    tag.textContent =
      a.kind === 'measured' || b.kind === 'measured'
        ? `Measured vs predicted · ${a.name} minus ${b.name}`
        : `Predicted · ${a.name} minus ${b.name}`;
    frame.append(greyed, layer, tag);
    stage.replaceChildren(frame);

    const ps = Math.min(1, PAIR_WIDTH / results.image.width);
    const pw = Math.round(results.image.width * ps);
    const ph = Math.round(results.image.height * ps);
    const figures = [heatFigure(results, a, sa.map, pw, ph), heatFigure(results, b, sb.map, pw, ph)];
    pair.replaceChildren(...figures.map((f) => f.figure));
    dots = { maps: figures, results, w: pw, h: ph };
    syncDots();
  }

  const choose = () => {
    chosen = [pickA.select.value, pickB.select.value];
    update();
  };
  pickA.select.addEventListener('change', choose);
  pickB.select.addEventListener('change', choose);
  swap.addEventListener('click', () => {
    chosen = [pickB.select.value, pickA.select.value];
    update();
  });

  reset.addEventListener('click', () => {
    chosen = null;
    update();
  });

  redraw = () => update();
  onResults((results) => update(results));
  onViewState(syncDots);
}
