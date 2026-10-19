# Task: Automatic areas for the study photos

## Goal

Compute the street categories, the ground floor and the façade elements for
the 25 "Published studies" example photos, with a ground-floor rule that also
works for 360° panoramas, without changing the 24 existing area files.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Prompt 031 added 25 photos under "From published studies"
  (`public/examples/examples.json`):
  - 10 from Qinyang (Zhang et al. 2026): small **design renderings** (about
    368 × 205 px), "a design rendering, not a photograph";
  - 15 from Guangzhou (Wang, Hu & Ma 2025): **360° panoramas in
    equirectangular projection** (648 × 325 px).
  The type is only written in each entry's `changes` text today.
- `tools/areas/` (prompts 021–023) makes the area files: `build.py`
  (OneFormer categories, horizon, ground floor) and `elements.py --apply`
  (SAM 3 windows, entrances, balconies, shopfronts). Both run over every
  photo and rewrite every file.
- The ground-floor rule assumes a level pinhole camera at eye height
  (spec, *Automatic areas*). In an equirectangular panorama the rows are
  elevation angles: a level camera's horizon is the middle row, and a
  façade's vertical edges stay vertical while horizontal lines curve, so the
  vanishing-line horizon does not apply.

## Required changes

1. Manifest: an optional field `imageKind: 'render' | 'panorama'` on the 25
   entries (from their `changes` text; absent means an ordinary photo).
   Update `ExamplePhoto` in the specification and
   `scripts/validate-examples.mjs` if it checks the fields.
2. `build.py --only-missing` and `elements.py --apply --only-missing`: process
   only photos without an area file (or without element masks), leaving the
   24 existing area files byte-identical.
3. **Panoramas** (`imageKind: 'panorama'`):
   - horizon: the middle row, method `equirectangular` (a level capture is
     assumed, as panoramas are normally levelled);
   - ground floor, per column with a visible base row *y<sub>0</sub>* below
     the horizon: the depression angle *φ* = π (*y<sub>0</sub>* −
     *y<sub>h</sub>*) / *H*, the distance *d* = *c* / tan *φ*, and the top row
     *y<sub>h</sub>* − (*H*/π) atan((*S* − *c*) / *d*), with camera height *c*
     = 1.6 m, storey height *S* = 4.0 m and image height *H*; hidden bases are
     interpolated as for ordinary photos.
4. **Renders** use the ordinary pipeline; record in the area file that the
   image is a design rendering, whose camera height is unknown (1.6 m is
   assumed).
5. Run both steps for the 25 photos; write the check overlays and report the
   horizon method, the ground-floor share and the element instances per
   photo. Check four overlays by eye (two renders, two panoramas) and list
   clear errors in the final report.
6. Specification (bump the version, with a line in *Changes*): the
   `imageKind` field, the `equirectangular` horizon method and the panorama
   ground-floor rule under *Automatic areas*, and the note on renders. Update
   `tools/areas/README.md` and `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- quality measures or page changes for these photos (052);
- re-running the element-model comparison or the validation (022, 023);
- changes to the 24 existing area files or to the rules for ordinary photos.

## Acceptance criteria

The task is complete when:
- all 25 study photos have area files that pass `build.py`'s checks;
- `git diff` shows no change to the 24 existing area files;
- the panorama ground floors follow the spherical rule (spot-checked on one
  panorama against a hand calculation for one column);
- the Areas view shows areas for a render and a panorama in `npm run
  preview`, and `npm run check` passes.

## Checks

`cd tools/areas && uv run build.py --only-missing && uv run elements.py
--apply --only-missing`; view four overlays; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.
Then run `npm run deploy` and include the live check in the final report.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
