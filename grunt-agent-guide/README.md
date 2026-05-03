# grunt API — Agent Guide

This folder is a self-contained guide for AI agents that need to post and manage coding tasks against the **grunt** API. Drop the whole folder into any project and point the agent at it.

## What grunt is

grunt is a single-user desktop service that schedules **Claude Code** agents to work on coding tasks against registered git repos (or local folders). You give grunt a structured task — title, description, acceptance criteria, optional children — and a background worker eventually picks it up, runs Claude Code inside a Docker container with the repo mounted at `/workspace`, and either opens a PR or merges the result.

In short: this API is the **inbox** for code work. Posting a task is how you ask grunt to do something.

## Where the API lives

- Base URL: `http://192.168.50.30:5173`
- All endpoints are prefixed `/api`.
- **No auth headers.** grunt's security model is the OS user boundary; the server is unreachable off-box. Just send JSON.
- Content type: `application/json` for every POST/PATCH body.

If the host runs grunt behind `bk-gateway-api`, the gateway adds CORS/helmet/auth — but the local API itself does not.

## Files in this guide

| File | What's in it |
| --- | --- |
| [`posting-tasks.md`](./posting-tasks.md) | **Read this first.** End-to-end workflow for posting a task and watching it run. |
| [`endpoints.md`](./endpoints.md) | Full reference for every `/api/*` endpoint an agent might touch. |
| [`schemas.md`](./schemas.md) | Type shapes for `Repo`, `Task`, `AcceptanceCriterion`, `TaskNote`, `TaskEvent`, etc. |
| [`examples.md`](./examples.md) | Copy-pasteable `curl` recipes for the common workflows. |
| [`agent-runtime.md`](./agent-runtime.md) | What the **executing** agent (the one running inside the container) sees: payload shape, mount layout, NOTES_TO_SAVE protocol, criteria semantics. |

## 30-second quickstart

1. Pick a repo id (`GET /api/repos`) or register a new one (`POST /api/repos`).
2. `POST /api/tasks` with `{ repo_id, title, description, acceptanceCriteria: [...] }`.
3. Poll `GET /api/tasks/:id` until `status === "done"` or `"failed"`.
4. If you want live progress, hit `GET /api/tasks/:id/log/stream` (SSE) or `GET /api/tasks/:id/events`.

That's the whole loop. Everything else in this guide is detail.

## Status checks before posting

If a task immediately stalls in `pending`, one of these is the cause — check them first:

- `GET /api/health` — is the API even up.
- `GET /api/system/docker` — Docker daemon must be reachable for tasks to run.
- `GET /api/system/runner-image` — first run builds the `grunt/runner` image (can take minutes).
- `GET /api/system/worker-status` — confirms a worker is running (vs. orchestrator-only mode).
- `GET /api/system/capped` — weekly token cap reached → no new claims until usage rolls off.

## Important behavioural notes

- **Tasks form a tree per repo.** Use `parent_id` to nest. The scheduler only claims **leaf** tasks (no pending children). Parents auto-promote to `done` when all children are done.
- **`requires_approval: true` blocks execution.** The task sits in `pending` and the worker skips it until a human PATCHes the flag off.
- **Acceptance criteria are visible to the agent.** They show up in the task payload; the agent is expected to address them and may flip `met: true` via PATCH.
- **Notes are how tasks communicate.** Agents emit `<NOTES_TO_SAVE>` JSON blocks; you can also POST notes via the API. Visibility is resolved against the tree (`siblings`, `descendants`, `ancestors`, `all`, `self`).
- **Repos must finish cloning first.** Newly-created git-backed repos go `pending` → `cloning` → `ready`. Don't post tasks until `clone_status === "ready"`.
