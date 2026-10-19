import { classicSalience } from './classic-salience';
import { deepGazeIIE, deepGazeMSDB } from './deepgaze';
import { measuredGaze } from './measured';
import type { ModelSpec } from './types';
import { unisal } from './unisal';

/**
 * Every layer shown on the page, in display order. Views are generated from this list.
 * Measured gaze comes first as the reference, on the photos that have it.
 */
export const models: ModelSpec[] = [measuredGaze, classicSalience, unisal, deepGazeIIE, deepGazeMSDB];

/** Neural models from best to simplest; views that show "the AI" use the first one available. Never includes measured gaze. */
export const NEURAL_PREFERENCE = ['deepgaze-msdb', 'deepgaze-iie', 'unisal'];
