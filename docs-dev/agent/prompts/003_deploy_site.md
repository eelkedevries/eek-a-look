# Task: Deploy to eelkedevries.com/eek-a-look/

## Goal

Add a GitHub Actions workflow that builds the site and rsyncs `dist/` to
`https://eelkedevries.com/eek-a-look/`, and deploy the placeholder page.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- Model the workflow on
  `eelkedevries/roast-a-researcher/.github/workflows/deploy-site.yml` (read it
  with `gh api`). That workflow deploys to the same host the same way.
- **Precondition (human):** the owner has added these repository secrets to
  `eelkedevries/eek-a-look`, with the same values as in
  `eelkedevries/eelkedevries.com`: `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`,
  `REMOTE_HOST`, `REMOTE_USER`, `REMOTE_PORT`, `REMOTE_PATH_PRODUCTION`, and
  `SSH_KEY_PASSPHRASE` if the key has one.
- **Precondition:** prompt 002 is done (`/eek-a-look/` is protected in the site
  deploy).

## Required changes

1. Run `gh secret list -R eelkedevries/eek-a-look`. If any required secret is
   missing, stop and report which ones. Do not create placeholders.
2. Add `.github/workflows/deploy-site.yml`:
   - triggers: push to `main` touching `src/**`, `public/**`, `index.html`,
     `vite.config.ts`, `package.json`, `package-lock.json` or the workflow
     itself, plus `workflow_dispatch`;
   - `concurrency: { group: deploy-site, cancel-in-progress: false }` and
     `permissions: contents: read`;
   - steps: `npm ci`, `npm run build`, `bash scripts/check-public-build.sh dist`,
     prepare SSH credentials, then rsync `dist/` to
     `${REMOTE_PATH_PRODUCTION%/}/eek-a-look/` with `--delete-after
     --delay-updates`, then remove the credentials (`if: always()`);
   - a header comment listing the secrets, and noting that the eelkedevries.com
     deploy protects `/eek-a-look/`.
3. Add `docs/deployment.md` (short), covering:
   - how a deploy is triggered;
   - which secrets are needed;
   - how to re-run a failed deploy;
   - a pointer to the eelkedevries.com README, *Deploy reliability*, for
     connection time-outs.
4. Push and watch the run.

## Do not implement

Do not implement:
- GitHub Pages, a staging target, or changes to eelkedevries.com;
- `.htaccess` rules (only if prompt 009 finds them needed);
- application features.

## Acceptance criteria

The task is complete when:
- the *Deploy Site* run is green (a `Connection timed out` failure re-run green
  counts);
- `curl -s https://eelkedevries.com/eek-a-look/` returns the placeholder page
  with HTTP 200, and its JS/CSS load from `/eek-a-look/assets/`;
- no secret value appears in the repository or the run logs.

## Checks

`gh run watch`; `curl -sI https://eelkedevries.com/eek-a-look/`; open the
page in a browser and confirm there are no console errors.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
