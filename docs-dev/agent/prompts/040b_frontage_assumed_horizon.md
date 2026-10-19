# Task: No frontage outcome without a horizon

Supersedes: `040_frontage_evidence.md` (the rule only)

## Goal

Make the active-ground-floor measure say "Unclear" when the photo's horizon
was assumed rather than found, because the ground floor it rests on is then
not reliable.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- In the 040 run, three photos with an `assumed-level` horizon got a ground
  floor covering 95–100% of their façade (beatrixkwartier-wtc,
  weena-delftse-poort, zurich-22). Their outcomes (likely absent, likely
  present, likely absent) describe whole façades, not ground floors. The
  other two `assumed-level` photos have no ground floor and were already
  Unclear.
- This is a guard on the input, not a change of thresholds: the 4 m rule is
  only defined relative to a horizon (spec, *Automatic areas*).

## Required changes

1. In `tools/qualities/frontage.py`, before the other conditions of the rule:
   horizon method `assumed-level` → Unclear, with the reason "The horizon
   could not be found, so the ground floor may be far too tall or missing."
   The indicators and evidence are still computed and written.
2. Re-run `uv run build.py --ground-floor`.
3. Specification (bump the version, with a line in *Changes*): the new first
   condition of the rule, replacing the note for `assumed-level`. Update the
   README and the 040 line in `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- any other change to the rule or its thresholds;
- changes to the horizon or the area files.

## Acceptance criteria

The task is complete when:
- the five `assumed-level` photos have the outcome Unclear with the new
  reason, and no other photo's outcome changes;
- `npm run check` passes.

## Checks

`cd tools/qualities && uv run build.py --ground-floor`; `npm run check`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
