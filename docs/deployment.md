# Deployment

eek-a-look is served at <https://eelkedevries.com/eek-a-look/>.

## How to deploy

Push to `main`, then run:

```bash
npm run deploy
```

This starts the workflow
[`deploy-eek-a-look.yml`](https://github.com/eelkedevries/eelkedevries.com/actions/workflows/deploy-eek-a-look.yml)
in the eelkedevries.com repository. That workflow builds this repository from
GitHub and copies the build into `/eek-a-look/` on the web host. The command
waits for the run and then checks that the live page answers.

Without a terminal, use **Run workflow** on that page instead.

## Things to know

- **A push alone does not deploy.** The workflow builds what is on GitHub, so
  `npm run deploy` refuses to run with uncommitted or unpushed changes.
- **No secrets live in this repository.** The SSH secrets belong to the
  eelkedevries.com repository, and its own deploy leaves `/eek-a-look/`
  untouched.
- **Time-outs:** the host sometimes blocks GitHub's runners for a few minutes.
  `npm run deploy` re-runs a deploy that failed at *Test SSH connectivity* up
  to three times. Background is in the eelkedevries.com README, under *Deploy
  reliability*.
