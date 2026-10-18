# Task: Deploy workflow for /eek-a-look/ in the eelkedevries.com repository

## Goal

Add a small workflow to `eelkedevries/eelkedevries.com` that builds the public
eek-a-look repository and rsyncs it to `/eek-a-look/`, reusing the site's
existing deploy secrets, and protect that folder from the site's own deploy.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- **Why this route:** the site repository already holds the SiteGround
  secrets. eek-a-look is public, so it can be checked out without a token. No
  secret is added anywhere, and the owner does nothing.
- `eelkedevries.com/.github/workflows/deploy.yml` already has the steps to
  reuse:
  - *Prepare SSH credentials*;
  - *Test SSH connectivity*, whose retries ride out SiteGround's intermittent
    runner blocks;
  - *Resolve production document root* and *Select and verify remote path*,
    which guard against a stale `REMOTE_PATH_PRODUCTION`;
  - *Remove deploy credentials*.

  Its light path for `review-tool-updated` (the `/vacatures/` rsync in *Deploy
  via rsync*) is the model for a single-folder deploy.
- That repository's `CLAUDE.md` applies while you work in it: commit and push to
  `main`. A push to its `main` deploys the live site. That is intended.
- The local clone at `~/Documents/portfolio/Website/eelkedevries.com` may be
  stale. Use a fresh clone, or pull first.

## Required changes

1. In `eelkedevries/eelkedevries.com`, read `CLAUDE.md` and follow it.
2. In `scripts/deploy.sh`, add `--filter='protect /eek-a-look/***'` directly
   after `--filter='protect /my-review-policy/***'`, with the existing comment
   block covering it.
3. Add `.github/workflows/deploy-eek-a-look.yml`:
   - triggers: `repository_dispatch` with `types: [look-updated]`, and
     `workflow_dispatch`;
   - `concurrency: { group: eelkedevries-site-deploy, cancel-in-progress: false }`,
     the same group as `deploy.yml`, so two rsyncs never overlap;
   - `permissions: contents: read`;
   - steps:
     - check out `eelkedevries/eek-a-look` (public, no token);
     - set up Node 22; `npm ci`; `npm run build`;
       `bash scripts/check-public-build.sh dist`;
     - the five reused steps above, copied with only the changes needed;
     - rsync `dist/` to `<verified document root>/eek-a-look/` with
       `--delete-after --delay-updates` and the same SSH options as
       `deploy.yml`;
     - finally, `curl` `https://eelkedevries.com/eek-a-look/` and fail unless
       it returns 200.
   - A header comment explains the trigger and points to eek-a-look's
     `docs/deployment.md`.
4. If that repository's `README.md` lists the self-contained apps it deploys,
   add eek-a-look in one line.
5. Commit there with a descriptive message ("Deploy eek-a-look to /eek-a-look/
   on a look-updated dispatch"), push `main`, and confirm the site's *Render &
   Deploy* run is green.
   - If a run fails at *Test SSH connectivity* with `Connection timed out`,
     re-run it with `gh run rerun <id> --failed -R eelkedevries/eelkedevries.com`
     (up to three times) before reporting a failure.
6. In this repository, add `002_website_deploy_workflow.md` to *Prompts run* in
   `docs-dev/planning/current_state.md`, with the site commit hash.

## Do not implement

Do not implement:
- any other change to eelkedevries.com (no Projects card, link or blog post);
- changes to `deploy.yml` itself;
- new secrets or tokens anywhere.

## Acceptance criteria

The task is complete when:
- the protect line and `deploy-eek-a-look.yml` are on eelkedevries.com `main`;
- the site's *Render & Deploy* run for that commit is green;
- `https://eelkedevries.com/` still loads normally.

The first eek-a-look deploy happens in prompt 003.

## Checks

`gh run list -R eelkedevries/eelkedevries.com --limit 3`;
`curl -sI https://eelkedevries.com/`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
