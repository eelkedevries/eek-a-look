/**
 * The three design comparisons of the Example section (prompts 058, 066, 067). The images and their credits are in
 * public/examples/comparisons.json; the manipulated areas in public/precomputed/comparisons/<id>.json.
 */
export interface ManipulatedArea {
  /** Region id in public/precomputed/comparisons/<id>.json; the same pixels in A and B. */
  id: string;
  label: string;
  /** How the area reads in a sentence: "more attention to …". */
  phrase: string;
  /** How the area was found. */
  note: string;
}

export interface ComparisonText {
  id: 'entrance' | 'greenery' | 'glazing';
  number: number;
  title: string;
  place: string;
  /** One short sentence. */
  question: string;
  /** Only what the question needs. */
  background: string;
  /** What differs between A and B. */
  manipulated: string;
  conditionA: string;
  conditionB: string;
  /** Two outcomes that can be contrasted; hypotheses, not results. */
  outcomes: [string, string];
  labelA: string;
  labelB: string;
  /** The area of interest: where the predicted attention in A and B is compared. */
  area: ManipulatedArea;
}

export const COMPARISONS: ComparisonText[] = [
  {
    id: 'entrance',
    number: 1,
    title: 'Entrance',
    place: 'Zürich 42',
    question: 'Does a contrasting colour surround make an entrance more visually prominent?',
    background:
      'The entrance is where a building meets the street. In the original photograph, the doorway sits in a grey stone base beneath the corner balconies and barely stands out from it. Salience models treat colour contrast as a low-level feature that attracts attention.',
    manipulated: 'the colour contrast of the entrance surround.',
    conditionA: 'The original entrance.',
    conditionB: 'A blue-teal surround around the doorway; the rest of the scene unchanged.',
    outcomes: [
      'B draws more predicted attention to the entrance than A: the colour accent makes the entrance more prominent.',
      'A and B do not differ meaningfully: the accent is too small to compete with the balconies, signs and other features of the scene.',
    ],
    labelA: 'A · Original',
    labelB: 'B · Blue-teal surround',
    area: {
      id: 'entrance',
      label: 'Door and surround',
      phrase: 'the door and its surround',
      note: 'The area is the door and its recoloured surround: the surround found from the change in colour between A and B, down to the step, where the plants hide it.',
    },
  },
  {
    id: 'greenery',
    number: 2,
    title: 'Greenery',
    place: 'Zürich 33',
    question: "Does low planting along a building's base shift attention towards pedestrian level?",
    background:
      'Planting at the foot of a building can soften a hard base and add detail at eye level. In the original photograph, residential tower blocks rise from a bare base above grass.',
    manipulated: 'whether there is low planting at the base.',
    conditionA: 'The original scene.',
    conditionB: 'Low leafy planting along the building base; the existing grass kept.',
    outcomes: [
      'Attention shifts downwards: in B, a larger share falls on the planting and the lower third of the image.',
      'The distribution stays much the same: the planting looks too much like the grass to stand out, and attention stays on the façades.',
    ],
    labelA: 'A · Original',
    labelB: 'B · Low planting',
    area: {
      id: 'planting',
      label: 'Added planting',
      phrase: 'the added planting',
      note: 'The area is where the edit added planting, found from the pixel difference between A and B.',
    },
  },
  {
    id: 'glazing',
    number: 3,
    title: 'Glazing',
    place: 'Zürich 53',
    question: 'Does transparent glazing draw more attention to a ground-floor frontage than opaque glazing?',
    background:
      'Being able to see into a ground floor is often thought to make a frontage more engaging. To isolate transparency, both images are edited and neither is the untouched photograph: they differ only in three window bays, and both contain the same three unplanted containers.',
    manipulated: 'the transparency of the glazing; everything else is held constant.',
    conditionA: 'Three window bays made opaque.',
    conditionB: 'The same three bays made transparent.',
    outcomes: [
      'B draws more predicted attention to the window bays than A: the visible interior adds detail that attracts attention.',
      'A and B do not differ meaningfully: reflections, the containers or other features outweigh the effect of transparency.',
    ],
    labelA: 'A · Opaque glazing',
    labelB: 'B · Transparent glazing',
    area: {
      id: 'windows',
      label: 'Three window bays',
      phrase: 'the three window bays',
      note: 'The area is the three window bays, found from the pixel difference between the two versions.',
    },
  },
];

export const COMPARISON_INTRO =
  'Three small design changes to Zürich street photos, made with AI image editing. Each example compares where people are predicted to look before and after the change. They are illustrations for discussing design and research questions, not studies.';

export const COMPARISON_CAVEAT =
  'The possible outcomes are hypotheses, not results; the numbers show what the models actually predict, even when the difference is small or matches neither outcome. A change in predicted attention does not show a change in wellbeing, preference or actual use. The image editing also made small unintended changes elsewhere, such as sign lettering.';

export const MEASURED_NOTE =
  'All maps here are predictions. Measured gaze (48 people, six seconds of free viewing; Wilming et al. 2017) exists only for the untouched original photographs, so it cannot show the effect of an edit and is left out; the originals’ measured gaze can be seen in the workspace.';
