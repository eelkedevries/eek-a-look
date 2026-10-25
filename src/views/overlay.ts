import { models } from '../models/registry';
import { mapLabel } from '../models/types';
import { dotsOver, dotsTag, fixationLayer, syncFixations } from '../render/fixations';
import { drawGreyed, drawHeatmap } from '../render/heatmap';
import { getResults, onResults, shownLayer, type Results } from '../results';
import { getViewState, onViewState } from '../view-state';

/** The single-map view: the layer chosen in the inspector on the photo, at the chosen strength. */
export function mountOverlay(stage: HTMLElement, status: HTMLElement): void {
  // The grey copy fades in with the heatmap, so at 0 % the photo is in colour.
  const greyLayer = document.createElement('canvas');
  greyLayer.className = 'layer grey';
  let greyFor: Results['image'] | null = null;
  const layer = document.createElement('canvas');
  layer.className = 'layer heat';
  const dots = fixationLayer();
  const tag = document.createElement('span');
  tag.className = 'predicted-tag';
  tag.textContent = 'Predicted';

  let drawnFor: { results: Results; model: string } | null = null;

  function update(results = getResults()) {
    const { model: selected, opacity } = getViewState();
    layer.style.opacity = greyLayer.style.opacity = String(opacity / 100);

    const frame = stage.querySelector<HTMLElement>('.frame');
    if (!results || !frame) return;
    if (!frame.contains(layer)) frame.append(greyLayer, layer, dots, tag);
    if (greyFor !== results.image) {
      drawGreyed(greyLayer, results.image.bitmap, results.image.width, results.image.height);
      greyFor = results.image;
    }

    // A layer the photo does not have (measured gaze), or one that does not cover it, hands over to the best one that does.
    const { wanted, shown: shownId } = shownLayer(results, selected);
    const chosen = models.find((m) => m.id === wanted)!;
    const model = models.find((m) => m.id === shownId)!;
    const outcome = results.status.get(shownId);
    const handover = shownId !== wanted ? `${chosen.name} is computed in advance for the example photos only; showing ${model.name}. ` : '';
    tag.classList.toggle('measured', model.kind === 'measured');
    syncFixations(dots, results.image, outcome?.state === 'ready' && dotsOver(model), results.image.width, results.image.height);
    if (outcome?.state === 'ready') {
      if (drawnFor?.results !== results || drawnFor.model !== shownId) {
        drawHeatmap(layer, outcome.map, results.image.width, results.image.height);
        drawnFor = { results, model: shownId };
      }
      layer.hidden = greyLayer.hidden = false;
      tag.textContent = `${mapLabel(model)} · ${model.kind === 'measured' ? model.subtitle : model.name}${dotsTag(dots, model)}`;
      status.textContent = handover;
    } else {
      layer.hidden = greyLayer.hidden = true;
      drawnFor = null;
      tag.textContent = mapLabel(model);
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
  onViewState(() => update());
  update();
}
