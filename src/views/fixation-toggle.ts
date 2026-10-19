import { getResults, onResults, type Results } from '../results';
import { getViewState, onViewState, setViewState } from '../view-state';

/** Views that draw the fixation points over the measured map. */
const VIEWS_WITH_DOTS = ['overlay', 'side', 'contrast'];

/**
 * The "Show fixations" checkbox under the image (prompt 050), with "Also over the model maps" beside it
 * (prompt 056). Both change the same settings as the inspector's checkboxes, and are present only on
 * photos with measured data in the views that draw dots.
 */
export function mountFixationToggle(host: HTMLElement): void {
  const label = document.createElement('label');
  label.className = 'toggle stage-toggle';
  const box = document.createElement('input');
  box.type = 'checkbox';
  const text = document.createElement('span');
  const note = document.createElement('small');
  label.append(box, text, note);
  const modelsLabel = document.createElement('label');
  modelsLabel.className = 'toggle stage-toggle';
  const modelsBox = document.createElement('input');
  modelsBox.type = 'checkbox';
  modelsLabel.append(modelsBox, Object.assign(document.createElement('span'), { textContent: 'Also over the model maps' }));
  host.replaceChildren(label, modelsLabel);
  box.addEventListener('change', () => setViewState({ fixations: box.checked }));
  modelsBox.addEventListener('change', () => setViewState({ fixationsOnModels: modelsBox.checked }));

  function render(results: Results | null = getResults()) {
    const counts = results?.image.measured ? results.image.measuredCounts : undefined;
    const { view, fixations, fixationsOnModels } = getViewState();
    host.hidden = !counts || !VIEWS_WITH_DOTS.includes(view);
    box.checked = fixations;
    modelsBox.checked = fixationsOnModels;
    modelsBox.disabled = !fixations;
    text.textContent = 'Show fixations (raw data)';
    note.textContent = counts ? `${counts.fixations} fixations from ${counts.observers} people` : '';
  }

  onResults((results) => render(results));
  onViewState(() => render());
  render();
}
