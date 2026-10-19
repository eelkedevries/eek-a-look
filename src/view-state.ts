/**
 * What the visitor has chosen across views: the open view, the layer in the single-map view, the heatmap
 * strength and whether the measured fixations are drawn over the measured layer (and the predicted maps). By default the single map
 * shows measured gaze with its fixations where the photo has them (prompt 049) and otherwise hands over to
 * the best model (`shownLayer` in results.ts).
 */
export interface ViewState {
  view: string;
  model: string;
  /** 0–100. */
  opacity: number;
  fixations: boolean;
  /** 0–100: how strongly the fixation points are drawn (prompt 054). */
  fixationOpacity: number;
  /** Whether the fixation points are also drawn over the predicted maps (prompt 056); off by default. */
  fixationsOnModels: boolean;
}

type Listener = (state: ViewState) => void;

const state: ViewState = {
  view: 'overlay',
  model: 'measured',
  opacity: 100,
  fixations: true,
  fixationOpacity: 65,
  fixationsOnModels: false,
};
const listeners = new Set<Listener>();

export function getViewState(): ViewState {
  return state;
}

export function setViewState(patch: Partial<ViewState>): void {
  Object.assign(state, patch);
  for (const listener of listeners) listener(state);
}

export function onViewState(listener: Listener): void {
  listeners.add(listener);
}
