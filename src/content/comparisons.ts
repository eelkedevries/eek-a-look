/**
 * The three design comparisons of the Example section (prompts 058, 066, 067). The images and their credits are in
 * public/examples/comparisons.json; the manipulated areas in public/precomputed/comparisons/<id>.json.
 */
export interface ManipulatedArea {
  /** Region id in public/precomputed/comparisons/<id>.json; the same pixels in A and B. */
  id: string;
  label: string;
  /** How the area reads in a sentence: "summed over …". */
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
  /** The area of interest: where the predicted gaze density in A and B is compared. */
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
      'The entrance is where a building meets the street. In the original photograph, the doorway sits in a block of grey stone beneath the corner balconies and barely stands out from it. Salience models treat colour contrast as a low-level feature that attracts attention.',
    manipulated: 'the colour of the stone surround of the entrance.',
    conditionA: 'The original entrance in its grey stone block.',
    conditionB: 'The whole stone block around the entrance, from the balcony to the pavement, in blue-teal; the door, steps, sign, plants and the rest of the scene unchanged.',
    outcomes: [
      'B has a higher predicted gaze density on the entrance than A: the colour makes the entrance more prominent.',
      'A and B do not differ meaningfully: the colour does not compete with the balconies, signs and other features of the scene.',
    ],
    labelA: 'A · Original',
    labelB: 'B · Blue-teal entrance block',
    area: {
      id: 'entrance',
      label: 'Door and surround',
      phrase: 'the door and its surround',
      note: 'The area is the door and its recoloured stone surround, found from the change in colour between A and B.',
    },
  },
  {
    id: 'greenery',
    number: 2,
    title: 'Greenery',
    place: 'Zürich 33',
    question: "Does planting along a building's base shift attention towards pedestrian level?",
    background:
      'Planting at the foot of a building can soften a hard base and add detail at eye level. In the original photograph, residential tower blocks rise from a bare grey base above grass.',
    manipulated: 'whether there is planting along the base.',
    conditionA: 'The original scene.',
    conditionB: 'A continuous low, trimmed hedge in front of the grey base of the blocks, below the ground-floor windows, which stay visible; the rest of the scene unchanged.',
    outcomes: [
      'Predicted gaze density shifts downwards: in B, a larger share of it falls on the hedge.',
      'The density on the hedge does not rise: a uniform green hedge does not stand out, and the density stays on the façades.',
    ],
    labelA: 'A · Original',
    labelB: 'B · Low hedge along the base',
    area: {
      id: 'planting',
      label: 'Added hedge',
      phrase: 'the added hedge',
      note: 'The area is where the edit added the hedge, found from the pixel difference between A and B.',
    },
  },
  {
    id: 'glazing',
    number: 3,
    title: 'Glazing',
    place: 'Zürich 53',
    question: 'Does a transparent, lit ground-floor frontage draw more attention than the original shaded one?',
    background:
      'Being able to see into a ground floor is often thought to make a frontage more engaging. In the original photograph, the frontage lies in deep shade under the canopy: dark windows, green stone panels and a red door.',
    manipulated: 'the ground-floor frontage. B makes it transparent and also shows a bright, colourful interior, so brightness, colour and detail change with transparency, and an effect cannot be attributed to transparency alone.',
    conditionA: 'The original scene.',
    conditionB: 'The ground-floor frontage either side of the red door, apart from the far-left bay, as clear glass showing a brightly lit shop interior with colourful goods; the red door and the rest of the scene unchanged.',
    outcomes: [
      'B has a higher predicted gaze density on the frontage than A: the visible interior adds detail that draws the eye.',
      'A and B do not differ meaningfully: the shaded frontage already draws the eye, and the visible interior adds little.',
    ],
    labelA: 'A · Original',
    labelB: 'B · Transparent frontage',
    area: {
      id: 'frontage',
      label: 'New glazing',
      phrase: 'the new glazing',
      note: 'The area is where B differs from the original, found from the pixel difference between them: the new glass panes. The red door and the dark frames between the panes barely change, so they fall outside it.',
    },
  },
];

export const COMPARISON_INTRO =
  'Three design changes to Zürich street photos: the first recoloured by rule, the other two made with AI image editing. Each example compares where DeepGaze MSDB predicts people will look before and after the change. They are illustrations for discussing design and research questions, not studies.';

export const COMPARISON_CAVEAT =
  'The possible outcomes are hypotheses, not results; the numbers show what the model actually predicts, even when the difference is small or matches neither outcome. A change in predicted gaze density does not show a change in wellbeing, preference or actual use. Outside the manipulated area every image keeps the original photograph’s pixels, apart from slight JPEG re-encoding noise; inside it, the AI edits of examples 2 and 3 may contain small unintended details.';

export const MEASURED_NOTE =
  'All maps here are predictions. Measured gaze exists only for the untouched original A: 48 people viewed it freely for six seconds (Wilming et al. 2017; Baseline study, Onat et al. 2014). Image B was made later and never shown to anyone, so no measurement here can show the effect of an edit. “Measured gaze path on A” draws one participant’s fixations over A in their order: 1 is the first fixation after the central fixation cross, which is left out, and a dashed line bridges a fixation missing from the dataset. The originals’ pooled measured gaze can be seen in the workspace.';
