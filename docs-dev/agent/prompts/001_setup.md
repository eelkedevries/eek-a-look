# Task: Initial project scaffold

## Goal

Make the repository public, complete the `eek-a-template` scaffold and add a
minimal Vite + TypeScript page served under `/eek-a-look/`.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The documentation from `eek-a-template` v0.3.0 is already committed:
  `AGENTS.md`, `CLAUDE.md`, `README.md` and `docs-dev/**`. The rest of the
  template (scripts, CI, `.gitignore`, `.copier-answers.yml`, `docs/`) is not
  there yet.
- Read `docs-dev/plan.md` and the *Architecture* section of
  `docs-dev/reference/primary_authoritative/specification.md`.
- The owner approved making the repository public on 2026-10-18.

## Required changes

1. Make the repository public:
   `gh repo edit eelkedevries/eek-a-look --visibility public --accept-visibility-change-consequences`.
2. Complete the template over the existing tree, keeping the files already
   committed:

   ```bash
   copier copy --trust --defaults --vcs-ref v0.3.0 \
     --skip AGENTS.md --skip CLAUDE.md --skip README.md --skip 'docs-dev/**' \
     --data project_name=eek-a-look --data project_title=eek-a-look \
     --data description="Predicted gaze heatmaps for streetscape photos: open saliency models next to simple baselines, running entirely in your browser." \
     --data stack_kind=node --data "stack=node-vite + typescript" \
     --data visibility=public --data static_site=true \
     gh:eelkedevries/eek-a-template .
   ```

   Then confirm with `git status` that no committed documentation file changed.
3. Delete `.github/workflows/deploy-pages.yml`. This project does not use GitHub
   Pages.
4. Create a Vite `vanilla-ts` scaffold:
   - generate it in a scratch directory with
     `npm create vite@latest <scratch> -- --template vanilla-ts`;
   - move `index.html`, `src/`, `public/`, `tsconfig.json` and `package.json`
     into the repository root;
   - remove the demo content (counter, logos, demo CSS), leaving a page that
     shows only the heading "eek-a-look" and the line "Coming soon".
5. Add `vite.config.ts` with `base: '/eek-a-look/'` and
   `build.sourcemap: false`.
6. In `package.json`, set `"name": "eek-a-look"`, `"private": true` and these
   scripts:
   - `dev`, `build` and `preview` (Vite defaults);
   - `check`: `tsc --noEmit && vite build && bash scripts/check-public-build.sh dist && bash scripts/validate-prompts.sh`.
7. Run `npm install` and commit `package-lock.json`.
8. Add a short "Running locally" block to `README.md` (`npm ci`, `npm run dev`,
   `npm run check`) under *Development*. Change nothing else in the README.
9. Add `.claude/worktrees/` to `.gitignore`. Agent sessions create worktrees
   there, and they must never be committed.

## Do not implement

Do not implement:
- styling, fonts, layout or any application feature;
- the SiteGround deploy workflow (prompt 003);
- tests, a UI framework, or state management.

## Acceptance criteria

The task is complete when:
- `gh repo view eelkedevries/eek-a-look --json visibility` reports `PUBLIC`;
- `npm ci && npm run check` passes locally;
- `npm run dev` serves the placeholder page at `http://localhost:5173/eek-a-look/`;
- `.copier-answers.yml` exists with `_commit: v0.3.0`, and
  `deploy-pages.yml` is absent;
- after pushing, the *Check build* workflow on GitHub is green.

## Checks

Run `npm ci`, `npm run check`, then confirm the *Check build* run with
`gh run watch`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
