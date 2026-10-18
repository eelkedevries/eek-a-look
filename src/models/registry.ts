import { centreBias } from './centre-bias';
import { classicSalience } from './classic-salience';
import { deepGazeIIE, deepGazeMSDB } from './deepgaze';
import type { ModelSpec } from './types';
import { unisal } from './unisal';

/** Every model shown on the page, in display order. Views are generated from this list. */
export const models: ModelSpec[] = [centreBias, classicSalience, unisal, deepGazeIIE, deepGazeMSDB];

/** Neural models from best to simplest; views that show "the AI" use the first one available. */
export const NEURAL_PREFERENCE = ['deepgaze-msdb', 'deepgaze-iie', 'unisal'];
