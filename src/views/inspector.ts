import { pearson } from '../maps/saliency-map';
import { models } from '../models/registry';
import type { ModelSpec } from '../models/types';
import { getResults, modelsFor, onResults, referenceModel, shownLayer, type Results } from '../results';
import { getViewState, onViewState, setViewState } from '../view-state';

const fixed = (r: number) => r.toFixed(2).replace(/^-(0\.00)$/, '$1');

const HELP: Record<string, [string, string]> = {
  overlay: [
    'One map at a time',
    'Choose a layer above. Warmer means more likely to be looked at; lower the heatmap strength in the display settings to see the photo underneath.',
  ],
  side: [
    'Every map at once',
    'Move the pointer over any map: a ring marks the same spot in all of them. r is each map’s match with the reference; “Contrast” opens a map against it.',
  ],
  contrast: [
    'Two maps, one image',
    'Orange is where the first map expects more looking, blue where the second does. Both maps are shown underneath.',
  ],
  qualities: [
    'Design principles',
    'Image measures for three design principles, with their evidence on the photo, beside the AI judgements and UP-CLIP. None of them is an expert judgement.',
  ],
  areas: [
    'Attention per area',
    'Automatic areas for the example photos, with how much of each map’s attention falls inside them, relative to their size.',
  ],
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function section(heading: string): { section: HTMLElement; heading: HTMLElement } {
  const node = el('section', 'inspector-section');
  const h = el('h2', 'section-label', heading);
  node.append(h);
  return { section: node, heading: h };
}

/** Each covered layer's correlation with the reference map, or undefined while either is not ready. */
function scores(results: Results, refId: string | undefined): Map<string, number> {
  const out = new Map<string, number>();
  const ref = refId ? results.status.get(refId) : undefined;
  if (ref?.state !== 'ready') return out;
  for (const m of modelsFor(results)) {
    const status = results.status.get(m.id);
    if (m.id !== refId && status?.state === 'ready') out.set(m.id, pearson(status.map, ref.map));
  }
  return out;
}

/**
 * The inspector beside the workspace: the layer list, the contrast selectors, each layer's match
 * with the reference and a short note on the open view (the display settings sit above the image
 * since prompt 057). Returns the host for
 * the contrast selectors.
 */
export function mountInspector(aside: HTMLElement, showView: (id: string) => void): HTMLElement {
  const layers = section('Layers');
  const layerList = el('div', 'layer-list');
  layerList.setAttribute('role', 'group');
  layerList.setAttribute('aria-label', 'Layers');
  layers.section.append(layerList);
  const rows = new Map<string, { button: HTMLButtonElement; score: HTMLElement; note: HTMLElement }>();
  for (const model of models) {
    const button = el('button', 'layer-row');
    button.type = 'button';
    button.dataset.kind = model.kind;
    const dot = el('span', 'layer-dot');
    dot.setAttribute('aria-hidden', 'true');
    const text = el('span', 'layer-text');
    text.append(el('span', 'layer-name', model.name));
    const note = el('span', 'layer-sub', model.subtitle ?? '');
    text.append(note);
    const score = el('span', 'layer-score');
    button.append(dot, text, score);
    button.addEventListener('click', () => {
      setViewState({ model: model.id });
      showView('overlay');
    });
    rows.set(model.id, { button, score, note });
    layerList.append(button);
  }

  const contrast = section('Contrast');
  const contrastHost = el('div');
  contrast.section.append(contrastHost);

  const match = section('Match');
  const matchNote = el('p', 'inspector-note', 'Correlation for this photo: 0 = unrelated · 1 = same pattern.');
  const matchList = el('ol', 'match-list');
  match.section.append(matchNote, matchList);

  const help = el('section', 'inspector-help');
  const helpTitle = el('h2', 'inspector-help-title');
  const helpText = el('p');
  help.append(helpTitle, helpText);

  aside.replaceChildren(layers.section, contrast.section, match.section, help);

  function renderScores(results = getResults()) {
    if (!results) return;
    const refId = referenceModel(results);
    const ref = models.find((m) => m.id === refId);
    const r = scores(results, refId);
    const { view, model: selected } = getViewState();
    const { shown } = shownLayer(results, selected);

    for (const model of models) {
      const row = rows.get(model.id)!;
      const status = results.status.get(model.id);
      row.button.hidden = !status;
      row.button.setAttribute('aria-pressed', String(view === 'overlay' && model.id === shown));
      row.button.disabled = status?.state === 'unavailable' || status?.state === 'failed';
      row.note.textContent =
        status?.state === 'unavailable' ? 'example photos only'
        : status?.state === 'failed' ? 'could not run'
        : status?.state === 'computing' ? (status.detail ?? 'computing…')
        : (model.subtitle ?? '');
      row.score.classList.toggle('is-reference', model.id === refId);
      row.score.textContent = model.id === refId ? (model.kind === 'measured' ? 'reference' : 'best') : r.has(model.id) ? fixed(r.get(model.id)!) : '';
    }

    match.heading.textContent = ref ? `Match with ${ref.kind === 'measured' ? 'measured gaze' : ref.name}` : 'Match';
    match.section.hidden = !ref;
    match.section.classList.toggle('measured', ref?.kind === 'measured');
    const ranked = modelsFor(results)
      .filter((m): m is ModelSpec => m.id !== refId && r.has(m.id))
      .sort((a, b) => r.get(b.id)! - r.get(a.id)!);
    matchList.replaceChildren(
      ...ranked.map((m) => {
        const item = el('li', 'match-row');
        const bar = el('span', 'match-bar');
        bar.style.setProperty('--r', String(Math.max(0, r.get(m.id)!)));
        item.append(el('span', 'match-name', m.name), bar, el('span', 'match-value', fixed(r.get(m.id)!)));
        return item;
      }),
    );
  }

  function renderView() {
    const { view } = getViewState();
    layers.section.hidden = view === 'contrast';
    layers.heading.textContent = view === 'overlay' ? 'Layer' : 'Layers · choose one to open it';
    contrast.section.hidden = view !== 'contrast';
    [helpTitle.textContent, helpText.textContent] = HELP[view] ?? ['', ''];
    renderScores();
  }

  onResults((results) => renderScores(results));
  onViewState(renderView);
  renderView();
  return contrastHost;
}
