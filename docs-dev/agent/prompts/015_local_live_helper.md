# Task: Live DeepGaze on the owner's laptop

## Goal

Add one command that runs eek-a-look locally with a GPU helper, so DeepGaze
IIE and MSDB also work live on any photo, uploads included, on the owner's
laptop.

## Scope

Implement only the work described in this prompt. Do not implement adjacent
systems or future prompts.

## Context

The tool from 013 is at `tools/deepgaze-local/`, and the browser models from
014 are in place. The public site must not change its behaviour: it never
contacts the helper, and there are no permission prompts for visitors.

## Required changes

1. `tools/deepgaze-local/serve.py` (FastAPI and uvicorn, bound to
   127.0.0.1:8765 only):
   - `GET /health` returns the device and the models loaded;
   - `POST /predict?model=<id>&gridWidth=&gridHeight=` takes image bytes and
     returns the same JSON format as the pre-computed maps;
   - it reuses `common.py` and loads both models once at start-up.
2. Add `npm run local`, which builds the site, starts the helper and runs
   `vite preview`. Vite's preview proxy forwards `/eek-a-look/local-api/` to
   the helper, so the browser talks only to its own origin. Print the URL to
   open.
3. In the app: only when the page is served from localhost, probe
   `local-api/health` once. If the helper answers, the DeepGaze models run
   live for uploads, and their subtitle reads "large model, running on this
   computer's GPU". Otherwise nothing changes.
4. Add `docs/local.md`:
   - first run: the one-off download sizes and time;
   - the command;
   - what to expect.

   Link it from the README.

## Do not implement

Do not implement:
- the helper on the public site, CORS for other origins, or any
  non-localhost binding;
- authentication, queues or batching.

## Acceptance criteria

The task is complete when:
- `npm run local` starts everything with one command;
- an uploaded photo gets live MSDB and IIE maps on the laptop;
- the public site behaves exactly as before (no request to `local-api`);
- `npm run check` passes.

## Checks

`npm run check`; `npm run local` plus a browser test with an upload; live
check that the public page makes no `local-api` request.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
