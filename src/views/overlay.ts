import { models, NEURAL_PREFERENCE } from '../models/registry';
import { mapLabel } from '../models/types';
import { INFERNO, cssColour } from '../render/colormaps';
import { drawGreyed, drawHeatmap } from '../render/heatmap';
import { getResults, onResults, type Results } from '../results';

const DEFAULT_OPACITY = 100;

export function gradientCss(steps = 8): string {
  const stops = Array.from({ length: steps + 1 }, (_, i) => cssColour(INFERNO, 0.35 + (0.65 * i) / steps));
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** The overlay view: one model's heatmap on the photo, with a model selector and an opacity slider. */
export function mountOverlay(controls: HTMLElement, stage: HTMLElement): void {
  const defaultId = NEURAL_PREFERENCE.find((id) => models.some((m) => m.id === id)) ?? models[0].id;
  let selected = defaultId;

  const selector = document.createElement('div');
  selector.className = 'model-selector';
  selector.setAttribute('role', 'group');
  selector.setAttribute('aria-label', 'Model');
  const buttons = new Map<string, HTMLButtonElement>();
  for (const model of models) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'model-button';
    button.dataset.model = model.id;
    button.addEventListener('click', () => {
      selected = model.id;
      update();
    });
    buttons.set(model.id, button);
    selector.append(button);
  }

  const sliderLabel = document.createElement('label');
  sliderLabel.className = 'opacity';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = String(DEFAULT_OPACITY);
  slider.setAttribute('aria-label', 'Heatmap opacity');
  sliderLabel.append('Heatmap', slider);

  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = '<span>less likely</span><span class="legend-bar"></span><span>more likely</span>';
  legend.querySelector<HTMLElement>('.legend-bar')!.style.background = gradientCss();

  const status = document.createElement('p');
  status.className = 'model-status';
  status.setAttribute('role', 'status');

  controls.replaceChildren(selector, sliderLabel, legend, status);

  // The grey copy fades in with the heatmap, so at 0 % the photo is in colour.
  const greyLayer = document.createElement('canvas');
  greyLayer.className = 'layer grey';
  let greyFor: Results['image'] | null = null;
  const layer = document.createElement('canvas');
  layer.className = 'layer heat';
  const tag = document.createElement('span');
  tag.className = 'predicted-tag';
  tag.textContent = 'Predicted';

  const applyOpacity = () => {
    layer.style.opacity = greyLayer.style.opacity = String(Number(slider.value) / 100);
  };
  slider.addEventListener('input', applyOpacity);
  applyOpacity();

  let drawnFor: { results: Results; model: string } | null = null;

  function update(results = getResults()) {
    // A layer such as measured gaze exists for some photos only; elsewhere its button is hidden.
    if (results && !results.status.has(selected)) selected = defaultId;
    for (const model of models) {
      const button = buttons.get(model.id)!;
      const state = results?.status.get(model.id)?.state;
      button.hidden = model.covers !== undefined && !results?.status.has(model.id);
      button.setAttribute('aria-pressed', String(model.id === selected));
      button.replaceChildren(model.name);
      if (model.subtitle) {
        const small = document.createElement('small');
        small.textContent = model.subtitle;
        button.append(small);
      }
      if (state === 'computing') button.append(Object.assign(document.createElement('em'), { textContent: 'Computing…' }));
      if (state === 'unavailable') button.append(Object.assign(document.createElement('em'), { textContent: 'Example photos only' }));
    }

    const frame = stage.querySelector<HTMLElement>('.frame');
    if (!results || !frame) return;
    if (!frame.contains(layer)) frame.append(greyLayer, layer, tag);
    if (greyFor !== results.image) {
      drawGreyed(greyLayer, results.image.bitmap, results.image.width, results.image.height);
      greyFor = results.image;
    }

    // A model that does not cover this photo hands over to the best one that does.
    const chosen = models.find((m) => m.id === selected)!;
    const chosenOutcome = results.status.get(selected);
    const shownId =
      chosenOutcome?.state === 'unavailable'
        ? (NEURAL_PREFERENCE.find((id) => !['unavailable', 'failed'].includes(results.status.get(id)?.state ?? '')) ?? selected)
        : selected;
    const model = models.find((m) => m.id === shownId)!;
    const outcome = results.status.get(shownId);
    const handover = shownId !== selected ? `${chosen.name} is computed in advance for the example photos only; showing ${model.name}. ` : '';
    if (outcome?.state === 'ready') {
      if (drawnFor?.results !== results || drawnFor.model !== shownId) {
        drawHeatmap(layer, outcome.map, results.image.width, results.image.height);
        drawnFor = { results, model: shownId };
      }
      layer.hidden = greyLayer.hidden = false;
      tag.textContent = `${mapLabel(model)} · ${model.kind === 'measured' ? model.subtitle : model.name}`;
      tag.classList.toggle('measured', model.kind === 'measured');
      status.textContent = handover;
    } else {
      layer.hidden = greyLayer.hidden = true;
      drawnFor = null;
      tag.textContent = mapLabel(model);
      tag.classList.toggle('measured', model.kind === 'measured');
      status.textContent =
        handover +
        (outcome?.state === 'failed'
          ? `${model.name} could not run: ${outcome.message}`
          : outcome?.state === 'unavailable'
            ? `${model.name}: ${outcome.message}`
            : `${model.name}: ${outcome?.state === 'computing' && outcome.detail ? outcome.detail : 'computing…'}`);
    }
  }

  onResults((results) => update(results));
  update();
}
