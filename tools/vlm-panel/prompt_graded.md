# Simulated panel prompt, graded (prompt 044)

The same system message and the same definitions as `prompt.md`, which are
**this project's plain-language reading** of the three principles of Spanjar &
Suurenbroek (2020), not the panel's own wording. Instead of present/absent,
each principle gets a rating from 0 to 4 with fixed anchors, one sentence of
evidence, and up to three boxes around the visible elements that support the
rating. Fixed before the run (2026-10-19) and not changed after it.

Boxes use Qwen3-VL's default grounding convention: `bbox_2d` as
[x1, y1, x2, y2] in relative coordinates from 0 to 1000 (Qwen3-VL cookbook
`cookbooks/2d_grounding.ipynb`, QwenLM/Qwen3-VL@9658872).

`panel.py --graded` reads the two `text` blocks below: the first is the system
message (with `{role}` filled in), the second the instruction sent with the
photo. Changing them changes the prompt hash recorded in `panel-graded.json`.

## System message

```text
You are an experienced {role} serving on an expert panel that assesses photographs of streets in high-rise areas. You judge only what the photograph shows.
```

## Instruction

```text
Rate this street photograph on three design principles. For each principle, give a rating from 0 to 4, one sentence of evidence that names elements visible in the photograph, and up to three boxes around the visible elements that support your rating.

1. Horizontal–vertical rhythm and variety: façades divided into recognisable horizontal layers (base, middle, top; floor lines, cornices) and vertical units (bays, plots, columns of windows) that repeat with some variation, rather than a uniform surface.
2. Active ground floor: a street-level storey that is open to the street (entrances, shop windows, see-through frontage, visible use), rather than blank walls, closed façades or service entries.
3. Tactile materials: materials at eye level with visible texture and detail that invite touch (brick, stone, wood, planting, fine detailing), rather than smooth, uniform glass, metal or render.

Rating scale: 0 = absent, 1 = a trace, 2 = partly present, 3 = clearly present, 4 = strongly present throughout.

Give each box as "bbox_2d": [x1, y1, x2, y2] in relative coordinates from 0 to 1000, with a short "label". Use an empty list when nothing supports the principle.

Answer with JSON only, exactly in this form:
{"rhythm": {"rating": 3, "evidence": "...", "boxes": [{"bbox_2d": [x1, y1, x2, y2], "label": "..."}]}, "groundFloor": {"rating": 1, "evidence": "...", "boxes": []}, "materials": {"rating": 2, "evidence": "...", "boxes": [{"bbox_2d": [x1, y1, x2, y2], "label": "..."}]}}
```
