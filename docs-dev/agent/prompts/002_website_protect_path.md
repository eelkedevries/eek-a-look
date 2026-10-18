# Task: Protect /eek-a-look/ in the eelkedevries.com deploy

## Goal

Stop the eelkedevries.com deploy from deleting the `/eek-a-look/` folder that
this repository will deploy.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

- The site repository is `eelkedevries/eelkedevries.com`. Its deploy rsyncs
  `_site/` with `--delete-after`. App folders deployed by other repositories
  are protected in `scripts/deploy.sh`, in the block that starts with the
  comment `# Web apps deployed into subfolders by their own repositories'
  workflows`.
- That repository's `CLAUDE.md` applies while you work in it: commit and push to
  `main`. **A push to its `main` deploys the live site.** That is intended here.
- The local clone at `~/Documents/portfolio/Website/eelkedevries.com` may be
  stale. Use a fresh clone, or pull first.

## Required changes

1. In `eelkedevries/eelkedevries.com`, read `CLAUDE.md` and follow it.
2. In `scripts/deploy.sh`, add `--filter='protect /eek-a-look/***'` directly
   after `--filter='protect /my-review-policy/***'`.
3. If that repository's `README.md` lists the subfolder apps that deploy
   themselves, add eek-a-look to that list. Otherwise leave the README alone.
4. Commit there with a descriptive message ("Protect /eek-a-look/ from the site
   deploy's rsync delete"), push `main`, and watch the *Render & Deploy* run.
5. In this repository, add `002_website_protect_path.md` to *Prompts run* in
   `docs-dev/planning/current_state.md`, noting the site commit hash.

## Do not implement

Do not implement:
- any other change to eelkedevries.com;
- a Projects page card, a link or a blog post about eek-a-look (the owner chose
  not to list it);
- changes to the site's tests or workflows.

## Acceptance criteria

The task is complete when:
- the protect line is on eelkedevries.com `main`;
- the *Render & Deploy* run for that commit is green, or failed only at *Test
  SSH connectivity* with `Connection timed out` and was re-run green (see that
  README, *Deploy reliability*);
- `https://eelkedevries.com/` still loads normally.

## Checks

`git -C <site clone> grep -n "eek-a-look" scripts/deploy.sh`;
`gh run list -R eelkedevries/eelkedevries.com --limit 3`;
`curl -sI https://eelkedevries.com/`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
