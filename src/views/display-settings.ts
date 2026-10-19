import { getResults, onResults, type Results } from '../results';
import { getViewState, onViewState, setViewState } from '../view-state';
import { gradientCss } from './overlay';

/** Views that draw a heatmap at the chosen strength. */
const VIEWS_WITH_STRENGTH = ['overlay', 'side'];
/** Views that draw the fixation points. */
const VIEWS_WITH_DOTS = ['overlay', 'side', 'contrast'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function slider(label: string, value: number, onInput: (value: number) => void): { wrap: HTMLLabelElement; value: HTMLElement } {
  const wrap = el('label', 'strength');
  const text = el('span', 'strength-text', label);
  const shown = el('span', 'strength-value');
  text.append(shown);
  const input = el('input');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.value = String(value);
  input.addEventListener('input', () => onInput(Number(input.value)));
  wrap.append(text, input);
  return { wrap, value: shown };
}

function checkbox(label: string, checked: boolean, onChange: (checked: boolean) => void): { wrap: HTMLLabelElement; box: HTMLInputElement } {
  const wrap = el('label', 'toggle');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = checked;
  box.addEventListener('change', () => onChange(box.checked));
  wrap.append(box, el('span', undefined, label));
  return { wrap, box };
}

/**
 * The display settings between the view tabs and the image, in one foldable section (prompt 057): the
 * heatmap strength with its legend, and on photos with measured gaze the fixation points' opacity
 * (prompt 054), "Show fixations (raw data)" (prompts 030, 049) and "Also over the model maps" (prompt
 * 056). Open by default; shown only in the views they act on.
 */
export function mountDisplaySettings(host: HTMLDetailsElement): void {
  const state = getViewState();
  const summary = el('summary', undefined, 'Display settings');

  const heat = el('div', 'view-settings-group');
  const strength = slider('Heatmap strength', state.opacity, (opacity) => setViewState({ opacity }));
  const legend = el('div', 'legend');
  const bar = el('span', 'legend-bar');
  bar.style.background = gradientCss();
  legend.append('less likely', bar, 'more likely');
  heat.append(strength.wrap, legend);

  const gaze = el('div', 'view-settings-group measured');
  const dots = slider('Fixation points (raw data)', state.fixationOpacity, (fixationOpacity) => setViewState({ fixationOpacity }));
  gaze.append(dots.wrap);

  const toggles = el('div', 'view-settings-group measured');
  const show = checkbox('Show fixations (raw data)', state.fixations, (fixations) => setViewState({ fixations }));
  const onModels = checkbox('Also over the model maps', state.fixationsOnModels, (fixationsOnModels) => setViewState({ fixationsOnModels }));
  const note = el('p', 'view-settings-note');
  toggles.append(show.wrap, onModels.wrap, note);

  const body = el('div', 'view-settings-body');
  body.append(heat, gaze, toggles);
  host.replaceChildren(summary, body);

  function render(results: Results | null = getResults()) {
    const counts = results?.image.measured ? results.image.measuredCounts : undefined;
    const { view, opacity, fixations, fixationsOnModels, fixationOpacity } = getViewState();
    heat.hidden = !results || !VIEWS_WITH_STRENGTH.includes(view);
    gaze.hidden = toggles.hidden = !counts || !VIEWS_WITH_DOTS.includes(view);
    host.hidden = heat.hidden && gaze.hidden;
    strength.value.textContent = `${opacity}%`;
    dots.value.textContent = `${fixationOpacity}%`;
    show.box.checked = fixations;
    onModels.box.checked = fixationsOnModels;
    onModels.box.disabled = !fixations;
    note.textContent = counts
      ? `${counts.fixations} fixations from ${counts.observers} people · ${fixationsOnModels ? 'on the measured and model maps' : 'on the Measured gaze layer'}`
      : '';
  }

  onResults((results) => render(results));
  onViewState(() => render());
  render();
}
