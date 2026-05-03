# grunt API — Endpoint Reference

Base URL: `http://192.168.50.30:5173`. All endpoints are JSON in / JSON out unless noted. No auth headers.

Conventions:
- Path params (`:id`, `:taskId`, `:criterionId`, …) are always integers.
- 4xx responses always have shape `{ "error": "<message>" }`.
- Validation errors are 400; missing rows are 404; conflicts (e.g. duplicate repo) are 409; failed clones / invalid templates are 422.

## Health & system

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness. `?verbose=true` includes DB connectivity info. |
| GET | `/api/system/worker-status` | Whether this instance is a worker, and any active leased tasks across the cluster. |
| GET | `/api/system/docker` | Docker daemon reachability + last probe timestamp + `install_url`. |
| GET | `/api/system/runner-image` | Build state of the `grunt/runner` Docker image. |
| GET | `/api/system/capped` | Whether the weekly token cap has been reached. Returns `{ capped, weekly_total, weekly_cap }`. |
| GET | `/api/system/pull-worker` | Whether the background git-pull worker is paused. |
| PATCH | `/api/system/pull-worker` | Body `{ "paused": boolean }`. Persisted. |

## Setup (first-run secrets)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/setup` | `{ ready, configured: { GH_PAT: boolean } }`. The GUI gates the main UI on `ready`. |
| POST | `/api/setup` | Body `{ "GH_PAT": "..." }`. Stores the GitHub PAT in the encrypted secrets store. |
| PATCH | `/api/setup` | Partial update — rotate one key. |
| DELETE | `/api/setup` | Clears all required secrets. |
| DELETE | `/api/setup/:key` | Clears a single required secret. Currently only `GH_PAT`. |

Agents posting tasks generally do **not** need to touch this endpoint — it's an onboarding concern. Tasks themselves authenticate to GitHub via the host's Claude Code subscription, not an Anthropic API key.

## Settings (single-row)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/settings` | `{ default_model, weekly_token_cap, session_token_cap }`. |
| PATCH | `/api/settings` | Partial. `default_model` is a non-empty string; the cap fields accept a non-negative integer or `null` (unlimited). |

## Repos

### List & lookup

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/repos` | Array of `Repo` rows. |
| POST | `/api/repos` | Register a repo (clones synchronously for git-backed repos). |
| PATCH | `/api/repos/:id` | Update mutable fields. |
| DELETE | `/api/repos/:id` | Cascade-delete the repo and all its tasks. |

`POST /api/repos` body fields:

| Field | Type | Notes |
| --- | --- | --- |
| `owner` | string | Required for git-backed repos. |
| `repo_name` | string | Required for git-backed repos. |
| `is_local_folder` | boolean | When true, omit `owner`/`repo_name` and supply `local_path` instead. |
| `local_path` | string | Absolute path to a local clone. Must be readable. |
| `active` | boolean | Defaults to true. Inactive repos are skipped by the scheduler. |
| `base_branch` | string | Branch task branches are cut from. |
| `base_branch_parent` | string | Upstream of `base_branch` for delta diffs. |
| `require_pr` | boolean | When true, completed tasks open a PR instead of merging directly. |
| `github_token` | string \| null | Per-repo override for GH PAT. Falls back to the `GH_PAT` secret. |
| `on_failure` | `"halt_repo" \| "halt_subtree" \| "retry" \| "continue"` | Failure policy. |
| `max_retries` | integer ≥ 0 | Cap on per-task retries. |
| `on_parent_child_fail` | `"cascade_fail" \| "mark_partial" \| "ignore"` | How a child failure rolls up to its parent. |
| `ordering_mode` | `"sequential" \| "parallel"` | Default for new tasks under this repo. |

Returns 409 `{ "error": "Repo already exists" }` if `(owner, repo_name)` is already registered. Returns 422 if the clone failed.

### Repo operations

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/repos/:id/clone` | Re-clone a git-backed repo whose initial clone failed. Wipes the working tree first. |
| POST | `/api/repos/:id/advance` | Stub — currently a no-op success. Don't depend on it. |
| POST | `/api/repos/:id/materialize-tree` | Atomically create a parent/children/criteria task tree. See [`posting-tasks.md` → Path B](./posting-tasks.md). |
| POST | `/api/repos/:id/instantiate-template/:templateId` | Replay a saved `TaskTemplate` into this repo. |
| GET | `/api/repos/:id/usage` | Aggregated token usage across every task in the repo. |

### Webhooks (notify on terminal task states)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/repos/:id/webhooks` | List webhooks configured on the repo. |
| POST | `/api/repos/:id/webhooks` | Body `{ url, events: WebhookEvent[], active? }`. Events: `done`, `failed`, `halted`. URL must be http/https. |
| PATCH | `/api/repos/:id/webhooks/:webhookId` | Partial update of `url`/`events`/`active`. |
| DELETE | `/api/repos/:id/webhooks/:webhookId` | Remove a webhook. |

### Repo links (cross-repo context)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/repos/:id/links` | List symmetric links involving this repo. |
| POST | `/api/repos/:id/links` | Body `{ other_repo_id, role?, permission? }`. `permission` is `"read"` (default) or `"write"`. |
| PATCH | `/api/repos/:id/links/:linkId` | Body `{ permission }`. |
| DELETE | `/api/repos/:id/links/:linkId` | Remove the link. |

A link mounts the linked repo at `/context/<name>` inside the runner container — read-only by default, read-write when `permission === "write"`.

## Tasks

### Core CRUD

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/tasks?repo_id=N` | All tasks under a repo, with `children_count`. |
| GET | `/api/tasks/:id` | Single task with `acceptanceCriteria` array and `children` summaries. |
| POST | `/api/tasks` | Create a task. |
| PATCH | `/api/tasks/:id` | Partial update. |
| DELETE | `/api/tasks/:id` | Cascade-delete (children + criteria). |

`POST /api/tasks` body fields:

| Field | Type | Notes |
| --- | --- | --- |
| `repo_id` | integer | Required. |
| `title` | string | Required. |
| `description` | string | Free-form markdown. The agent reads this. |
| `parent_id` | integer \| null | Nest under a parent. |
| `order_position` | integer | Auto-appended when omitted. |
| `ordering_mode` | `"sequential" \| "parallel" \| null` | Override repo default. |
| `model` | string \| null | Per-task Claude model override. |
| `requires_approval` | boolean | When true, blocks scheduler claims. |
| `acceptanceCriteria` | string[] | Materialised as `AcceptanceCriterion` rows. |

`PATCH /api/tasks/:id` accepts: `title`, `description`, `order_position`, `status`, `ordering_mode`, `requires_approval`, `model`. Setting `status` directly is allowed but rare — the scheduler/runner own that field in normal operation.

### Task introspection

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/tasks/:id/log` | The saved log file as `text/plain`. 404 until the agent writes its first byte. |
| GET | `/api/tasks/:id/log/stream` | SSE stream of the log; closes when the task hits a terminal state. |
| GET | `/api/tasks/:id/events` | Chronological `TaskEvent` list. |
| GET | `/api/tasks/:id/usage` | `{ totals, runs }` — token totals plus per-run rows. |
| GET | `/api/tasks/:id/effective-model` | Resolved model + source (override / parent / default). |

### Acceptance criteria

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/tasks/:id/criteria` | List criteria for a task. |
| POST | `/api/tasks/:id/criteria` | Body `{ description, order_position? }`. |
| PATCH | `/api/tasks/:taskId/criteria/:criterionId` | Update `description`, `order_position`, or `met`. |
| DELETE | `/api/tasks/:taskId/criteria/:criterionId` | Remove a criterion. |

Flipping `met: true` is the canonical way to mark a criterion satisfied — both the agent and the API client can do it.

### Notes (cross-task context)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/tasks/:id/notes` | Notes visible to this task per the visibility rules. |
| POST | `/api/tasks/:id/notes` | Body `{ author, visibility, content, tags? }`. |
| DELETE | `/api/tasks/:taskId/notes/:noteId` | Remove a note. |

Field semantics:

- `author`: `"agent"` or `"user"`. Agents that *automate* note creation should use `"agent"`; humans/clients use `"user"`.
- `visibility`: `"self"`, `"siblings"`, `"descendants"`, `"ancestors"`, `"all"`. Resolved against the task tree on every read.
- `content`: free-form text.
- `tags`: optional string array for grouping/filtering.

A note authored on task N is visible to task X when:
- N == X (self), or
- `siblings` and N and X share `parent_id` (within the same repo, X != N), or
- `descendants` and N is a strict ancestor of X, or
- `ancestors` and N is a strict descendant of X, or
- `all` and N and X are in the same repo.

## Task templates

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/templates` | List saved templates. |
| GET | `/api/templates/:id` | Fetch a single template (preview before instantiate). |
| POST | `/api/templates` | Save a new template. Two body shapes accepted (see below). |
| DELETE | `/api/templates/:id` | Drop a template. |

`POST /api/templates` body shape A — store an explicit tree:

```json
{
  "name": "service-bootstrap",
  "description": "Standard scaffold for a new service",
  "tree": { "parents": [ { "title": "...", "children": [...] } ] }
}
```

Body shape B — capture the current tree under a repo:

```json
{
  "name": "service-bootstrap",
  "repo_id": 12,
  "root_task_ids": [42, 43]
}
```

Omit `root_task_ids` to capture the entire repo's tree. Replay a saved template via `POST /api/repos/:id/instantiate-template/:templateId`.

## Usage dashboard

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/usage/weekly` | `{ weekly_total, weekly_cap, weekly_breakdown, daily }` for the dashboard. |

## Quick lookup matrix

| Question | Endpoint |
| --- | --- |
| Is grunt up? | `GET /api/health` |
| Can grunt actually run tasks right now? | `GET /api/system/docker` + `GET /api/system/runner-image` + `GET /api/system/capped` |
| Which repos are registered? | `GET /api/repos` |
| Post a task | `POST /api/tasks` |
| Post a whole tree | `POST /api/repos/:id/materialize-tree` |
| Did my task finish? | `GET /api/tasks/:id` (check `status`) |
| Why did it fail? | `GET /api/tasks/:id/log` + `GET /api/tasks/:id/events` |
| Add context for the agent | `POST /api/tasks/:id/notes` |
| Mark a criterion satisfied | `PATCH /api/tasks/:taskId/criteria/:criterionId` with `{ "met": true }` |
