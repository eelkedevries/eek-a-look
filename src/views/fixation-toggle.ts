import { getResults, onResults, type Results } from '../results';
import { getViewState, onViewState, setViewState } from '../view-state';

/** Views that draw the fixation points over the measured map. */
const VIEWS_WITH_DOTS = ['overlay', 'side', 'contrast'];

/**
 * The "Show fixations" checkbox under the image (prompt 050). It changes the same setting as the
 * inspector's checkbox, and is present only on photos with measured data in the views that draw dots.
 */
export function mountFixationToggle(host: HTMLElement): void {
  const label = document.createElement('label');
  label.className = 'toggle stage-toggle';
  const box = document.createElement('input');
  box.type = 'checkbox';
  const text = document.createElement('span');
  const note = document.createElement('small');
  label.append(box, text, note);
  host.replaceChildren(label);
  box.addEventListener('change', () => setViewState({ fixations: box.checked }));

  function render(results: Results | null = getResults()) {
    const counts = results?.image.measured ? results.image.measuredCounts : undefined;
    const { view, fixations } = getViewState();
    host.hidden = !counts || !VIEWS_WITH_DOTS.includes(view);
    box.checked = fixations;
    text.textContent = 'Show fixations (raw data)';
    note.textContent = counts ? `${counts.fixations} fixations from ${counts.observers} people` : '';
  }

  onResults((results) => render(results));
  onViewState(() => render());
  render();
}
