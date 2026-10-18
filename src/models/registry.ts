import { centreBias } from './centre-bias';
import { classicSalience } from './classic-salience';
import type { ModelSpec } from './types';

/** Every model shown on the page, in display order. Views are generated from this list. */
export const models: ModelSpec[] = [centreBias, classicSalience];
