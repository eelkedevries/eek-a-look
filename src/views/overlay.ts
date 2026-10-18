import { models } from '../models/registry';
import { WARM, cssColour } from '../render/colormaps';
import { drawHeatmap } from '../render/heatmap';
import { getResults, onResults, type Results } from '../results';

const DEFAULT_OPACITY = 100;

export function gradientCss(steps = 8): string {
  const stops = Array.from({ length: steps + 1 }, (_, i) => cssColour(WARM, 0.15 + (0.85 * i) / steps));
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** The overlay view: one model's heatmap on the photo, with a model selector and an opacity slider. */
export function mountOverlay(controls: HTMLElement, stage: HTMLElement): void {
  let selected = models.find((m) => m.kind === 'neural')?.id ?? models[0].id;

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

  const layer = document.createElement('canvas');
  layer.className = 'layer heat';
  const tag = document.createElement('span');
  tag.className = 'predicted-tag';
  tag.textContent = 'Predicted';

  const applyOpacity = () => (layer.style.opacity = String(Number(slider.value) / 100));
  slider.addEventListener('input', applyOpacity);
  applyOpacity();

  let drawnFor: { results: Results; model: string } | null = null;

  function update(results = getResults()) {
    for (const model of models) {
      const button = buttons.get(model.id)!;
      const state = results?.status.get(model.id)?.state;
      button.setAttribute('aria-pressed', String(model.id === selected));
      button.replaceChildren(model.name);
      if (model.subtitle) {
        const small = document.createElement('small');
        small.textContent = model.subtitle;
        button.append(small);
      }
      if (state === 'computing') button.append(Object.assign(document.createElement('em'), { textContent: 'Computing…' }));
    }

    const frame = stage.querySelector<HTMLElement>('.frame');
    if (!results || !frame) return;
    if (!frame.contains(layer)) frame.append(layer, tag);

    const model = models.find((m) => m.id === selected)!;
    const outcome = results.status.get(selected);
    if (outcome?.state === 'ready') {
      if (drawnFor?.results !== results || drawnFor.model !== selected) {
        drawHeatmap(layer, outcome.map, results.image.width, results.image.height);
        drawnFor = { results, model: selected };
      }
      layer.hidden = false;
      tag.textContent = `Predicted · ${model.name}`;
      status.textContent = '';
    } else {
      layer.hidden = true;
      drawnFor = null;
      tag.textContent = 'Predicted';
      status.textContent =
        outcome?.state === 'failed'
          ? `${model.name} could not run: ${outcome.message}`
          : `${model.name}: ${outcome?.state === 'computing' && outcome.detail ? outcome.detail : 'computing…'}`;
    }
  }

  onResults((results) => update(results));
  update();
}
