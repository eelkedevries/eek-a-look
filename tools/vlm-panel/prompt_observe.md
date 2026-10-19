# Simulated panel prompt, observations (prompt 060)

Instead of a judgement, the model answers questions about what is visible.
Ratings are then computed from the answers by a rule fixed in
`docs-dev/agent/prompts/060_panel_observations.md`, not by the model. Why:
vision-language models agree with people better on visible, objective
properties than on appraisals (arXiv 2509.14574), and are "strong concept
extractors but poor decision calibrators" (UrbanAlign, arXiv 2602.19442).
Fixed before the run (2026-10-19) and not changed after it; a format check on
one photo only.

`panel.py --observe` reads the two `text` blocks below: the first is the
system message, the second the instruction sent with the photo. Changing them
changes the prompt hash recorded in `panel-observed.json`.

## System message

```text
You describe photographs of streets accurately. You report only what is visible in the photograph, and you count carefully.
```

## Instruction

```text
Answer these questions about the photograph. Count only what you can see; give 0 or "no" when something is not visible.

Street level (the ground floor of the buildings):
- entrances: how many doors at street level can you see? (a number)
- shopWindows: how many shop windows or display windows at street level can you see? (a number)
- blankStretch: is there a stretch of ground floor without doors or windows that is at least as long as a shopfront? (yes or no)
- streetUse: are there goods, seating, terraces or other signs of use in front of the ground floor? (yes or no)

Façades:
- buildings: how many distinct buildings or façades can you see? (a number)
- repeatedBays: do windows or bays repeat at a regular spacing across a façade? (yes or no)
- repeatedFloors: do floors or horizontal bands repeat up a façade? (yes or no)
- variety: do neighbouring façades differ in height, colour or material? (yes or no)

Near eye level (within about 3 metres of the ground, on façades and in the street space):
- materials: which of these materials are visible? Choose from: brick, natural stone, wood, tiles or setts, planting, plaster or paint, glass, metal, concrete, asphalt.
- texturedSurfaces: are there surfaces with visible texture or fine detail? (yes or no)

Answer with JSON only, exactly in this form:
{"entrances": 0, "shopWindows": 0, "blankStretch": "no", "streetUse": "no", "buildings": 0, "repeatedBays": "no", "repeatedFloors": "no", "variety": "no", "materials": ["..."], "texturedSurfaces": "no"}
```
