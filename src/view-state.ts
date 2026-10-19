import { NEURAL_PREFERENCE } from './models/registry';

/**
 * What the visitor has chosen across views: the open view, the layer in the single-map view, the heatmap
 * strength and whether the measured fixations are drawn over the measured layer.
 */
export interface ViewState {
  view: string;
  model: string;
  /** 0–100. */
  opacity: number;
  fixations: boolean;
}

type Listener = (state: ViewState) => void;

const state: ViewState = { view: 'overlay', model: NEURAL_PREFERENCE[0], opacity: 100, fixations: false };
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
