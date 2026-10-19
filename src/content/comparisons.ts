/**
 * The three design comparisons of the Example section (prompt 058). The images and their credits are in
 * public/examples/comparisons.json; the regions in public/precomputed/comparisons/<id>.json.
 */
export interface Measure {
  /** 'region': a changed region of the comparison (same pixels in both images); 'area': an automatic area of each image; 'lower-third': the bottom third of the image. */
  source: 'region' | 'area' | 'lower-third';
  /** Region or area id. */
  id: string;
  label: string;
  /** How the measure reads in a sentence: "more attention to …". */
  phrase: string;
  /** For an automatic area: use each image's own mask (the edit itself changes it, as with greenery), not image A's for both. */
  perImage?: boolean;
}

export interface ComparisonText {
  id: 'entrance' | 'greenery' | 'glazing';
  number: number;
  title: string;
  place: string;
  question: string;
  explanation: string;
  changed: string;
  expected: string;
  labelA: string;
  labelB: string;
  /** The first measure answers the question; the others add context. */
  measures: Measure[];
}

export const COMPARISONS: ComparisonText[] = [
  {
    id: 'entrance',
    number: 1,
    title: 'Entrance',
    place: 'Zürich 42',
    question: 'Can a small colour accent make an entrance more visually prominent?',
    explanation:
      'The entrance is where a building meets the street, but here the doorway sits in a grey stone base under the corner balconies. The edit gives it a contrasting surround and leaves the rest of the scene as it was.',
    changed: 'The original entrance (A) against a blue-teal surround around the doorway beneath the balconies (B).',
    expected: 'More predicted attention to the entrance.',
    labelA: 'A · Original',
    labelB: 'B · Blue-teal surround',
    measures: [
      { source: 'region', id: 'entrance', label: 'Entrance and surround', phrase: 'the entrance and its surround' },
      { source: 'area', id: 'ground-floor', label: 'Ground floor (automatic)', phrase: 'the ground floor' },
    ],
  },
  {
    id: 'greenery',
    number: 2,
    title: 'Greenery',
    place: 'Zürich 33',
    question: 'Does added low planting shift attention towards pedestrian level?',
    explanation:
      'Planting at the foot of a building can soften a hard base and add detail at eye level. The edit adds low, leafy planting along the base of the tower blocks; the existing grass stays.',
    changed: 'The original scene (A) against low leafy planting along the building base (B).',
    expected: 'A greater share of predicted attention on the planting and the lower part of the scene.',
    labelA: 'A · Original',
    labelB: 'B · Low planting',
    measures: [
      { source: 'region', id: 'planting', label: 'Added planting', phrase: 'the added planting' },
      { source: 'lower-third', id: 'lower-third', label: 'Lower third of the image', phrase: 'the lower third of the image' },
      { source: 'area', id: 'greenery', label: 'Greenery (automatic)', phrase: 'all greenery', perImage: true },
    ],
  },
  {
    id: 'glazing',
    number: 3,
    title: 'Glazing',
    place: 'Zürich 53',
    question: 'Does transparent glazing draw more attention to a ground-floor frontage?',
    explanation:
      'Being able to see into a ground floor is often thought to make a frontage more engaging. Both images are edited: the same three window bays are opaque in one and transparent in the other, and both have the same three unplanted containers.',
    changed: 'Opaque (A) against transparent (B) versions of the same three window bays. Neither is the untouched photograph.',
    expected: 'Possibly more predicted attention to the windows, although reflections and other features may outweigh the effect.',
    labelA: 'A · Opaque glazing',
    labelB: 'B · Transparent glazing',
    measures: [
      { source: 'region', id: 'windows', label: 'Three window bays', phrase: 'the three window bays' },
      { source: 'area', id: 'ground-floor', label: 'Ground floor (automatic)', phrase: 'the ground floor' },
    ],
  },
];

export const COMPARISON_INTRO =
  'Three small design changes to Zürich street photos, made with AI image editing. Each example compares where people are predicted to look before and after the change. They are illustrations for discussing design and research questions, not studies.';

export const COMPARISON_CAVEAT =
  'The expected patterns are hypotheses, not results; the numbers show what the models actually predict, even when the difference is small or goes the other way. A change in predicted attention does not show a change in wellbeing, preference or actual use. The image editing also made small unintended changes elsewhere, such as sign lettering.';

export const MEASURED_NOTE =
  'Measured gaze exists only for the untouched original photographs: 48 people, six seconds of free viewing (Wilming et al. 2017). The edited images have predictions only.';
