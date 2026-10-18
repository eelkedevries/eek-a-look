# Task: One-command deploy and first deploy

## Goal

Add `npm run deploy`, which starts the eelkedevries.com `deploy-eek-a-look`
workflow, waits for it, re-runs it on a connection time-out and checks the live
page. Use it to deploy the placeholder page.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Prompt 002 added `deploy-eek-a-look.yml` to `eelkedevries/eelkedevries.com`.
  It runs on a `look-updated` repository dispatch or on `workflow_dispatch`.
- The deploy is started from the machine that runs the prompt, using the local
  `gh` login (scope `repo`). No secret is stored in this repository.

## Required changes

1. Add `scripts/deploy.sh`, which does the following:
   - check that `git status` is clean and `main` equals `origin/main`, and
     refuse otherwise (the workflow builds what is on GitHub);
   - run `gh workflow run deploy-eek-a-look.yml -R eelkedevries/eelkedevries.com`;
   - find that run, then `gh run watch --exit-status`;
   - if it failed at *Test SSH connectivity*, run
     `gh run rerun <id> --failed`, up to three times;
   - finally, `curl` `https://eelkedevries.com/eek-a-look/` and check for HTTP
     200.
2. Add `"deploy": "bash scripts/deploy.sh"` to `package.json`.
3. Add `docs/deployment.md` (short), covering:
   - deploying with `npm run deploy`, or the *Run workflow* button at
     <https://github.com/eelkedevries/eelkedevries.com/actions/workflows/deploy-eek-a-look.yml>;
   - that a push alone does not deploy;
   - the time-out re-runs;
   - a pointer to the eelkedevries.com README, *Deploy reliability*.
4. Commit and push, then run `npm run deploy` so the live site matches this
   commit.

## Do not implement

Do not implement:
- secrets, tokens or a deploy workflow in this repository;
- GitHub Pages or a staging target;
- application features.

## Acceptance criteria

The task is complete when:
- `npm run deploy` finishes green;
- `https://eelkedevries.com/eek-a-look/` returns the placeholder page with
  HTTP 200, and its JS/CSS load from `/eek-a-look/assets/`;
- the repository contains no secret.

## Checks

`npm run check`; `npm run deploy`; open the live page and confirm there are no
console errors.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push. Then
run `npm run deploy`.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
