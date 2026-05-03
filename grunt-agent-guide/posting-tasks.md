# Posting Tasks — End-to-End Workflow

This is the canonical flow an agent follows to ask grunt to do work. Pick the path that matches what you have on hand.

## Path A — single task on an existing repo

This is the most common case. You know the repo id and want to post one task.

```
1.  GET  /api/repos                                      → find repo_id
2.  POST /api/tasks                                      → create task
3.  GET  /api/tasks/:id    (poll until terminal)         → watch status
4.  GET  /api/tasks/:id/log    (or /log/stream for SSE)  → read output
```

### 1. Find the repo

```http
GET /api/repos
```

Response: array of `Repo` rows. Match on `owner` + `repo_name` (or `local_path` for local-folder repos). Make sure `clone_status === "ready"` and `active === true` before posting.

### 2. Create the task

```http
POST /api/tasks
Content-Type: application/json

{
  "repo_id": 12,
  "title": "Add /healthz endpoint",
  "description": "Add a GET /healthz route that returns {status:'ok'}.",
  "acceptanceCriteria": [
    "Returns 200 with body {\"status\":\"ok\"}",
    "Has a unit test in __tests__/health.test.ts"
  ]
}
```

Response: the created `Task` plus the `acceptanceCriteria` array it materialised. Save `id` — that's the handle for everything downstream.

Optional fields you can set at creation:

| Field | Meaning |
| --- | --- |
| `parent_id` | Nest under a parent task. Parent must already exist on the same repo. |
| `order_position` | Integer sort order within siblings. Omit to append at the end. |
| `ordering_mode` | `"sequential"` or `"parallel"` — overrides the repo default for this task's children. |
| `model` | Override the Claude model for this task (and descendants, by inheritance). `null` = inherit. |
| `requires_approval` | `true` parks the task in `pending` until a human flips it off. |

### 3. Poll for completion

```http
GET /api/tasks/12
```

`status` walks `pending` → `active` → (`done` | `failed`). Terminal states: `done`, `failed`. A reasonable poll interval is 5-15 seconds; the worker tick is on a similar cadence.

If you need richer signal, use one of these instead of/alongside polling:

- **`GET /api/tasks/:id/events`** — append-only timeline (`claimed`, `claude_started`, `claude_finished`, `branch_created`, `commit_pushed`, `pr_opened`, `status_change`).
- **`GET /api/tasks/:id/log`** — full saved log file once it exists.
- **`GET /api/tasks/:id/log/stream`** — SSE stream of the log while the task is `pending`/`active`. Server closes the connection automatically when the task reaches a terminal state.

### 4. Inspect the result

On `done`:
- `pr_url` is set if the repo has `require_pr: true`.
- Otherwise the task branch was merged into `base_branch` and pushed.
- For `is_local_folder: true` repos, no git operations happened — only the working tree changed.

On `failed`: read `/log` and `/events`, decide whether to PATCH and re-post (or post a sibling task).

## Path B — multi-task tree in one shot

Use this when you've planned out a parent + children + acceptance criteria up front and want to materialise the whole tree atomically. This is the same primitive grunt's chat planner uses.

```http
POST /api/repos/12/materialize-tree
Content-Type: application/json

{
  "parents": [
    {
      "title": "Migrate auth to OIDC",
      "description": "Replace the legacy session middleware with an OIDC adapter.",
      "acceptance_criteria": [
        "Login flow works against the staging IdP",
        "Existing /me endpoint still returns user payload"
      ],
      "children": [
        {
          "title": "Add OIDC adapter module",
          "acceptance_criteria": [
            "Module exposes verifyIdToken() and getUserInfo()"
          ]
        },
        {
          "title": "Swap middleware in app.ts",
          "acceptance_criteria": [
            "Old middleware is deleted",
            "All existing routes still pass auth tests"
          ]
        }
      ]
    }
  ]
}
```

A top-level parent may set `repo_id` to target a directly-linked sibling repo (single-hop). The whole tree is created in a single transaction — partial materialisation never happens.

Response: `MaterializedTaskTree` with the actual ids assigned to each node. Use those ids to monitor progress just like Path A.

## Path C — register a brand new repo, then post

```http
POST /api/repos
Content-Type: application/json

{
  "owner": "myorg",
  "repo_name": "myservice",
  "base_branch": "main",
  "require_pr": true
}
```

Or for a local folder (no git operations, no PR flow):

```json
{
  "is_local_folder": true,
  "local_path": "C:/Users/Ben/dev/repos/myservice"
}
```

For git-backed repos, the API clones synchronously before returning. On success `clone_status === "ready"` and you can post tasks immediately.

## Lifecycle states (cheat sheet)

```
                    POST /api/tasks
                          │
                          ▼
                      pending  ─────► (requires_approval=true → stays here)
                          │
       scheduler claim ───┤
                          ▼
                       active
                          │
       runClaudeOnTask    │
       success ───────────┤
                          ▼
                        done   ──► PR opened or branch merged
                          │
                  parents promote on
                  all-children-done
```

Failure path:

```
                       active
                          │
                 attempt fails
                          │
                  ┌───────┼───────┐
                  ▼               ▼
           retry_count++     retry_count == MAX_ATTEMPTS (3)
           back to pending      ▼
                              failed
                                │
              repo.on_failure ──┤
                                ├─► halt_repo: stop scheduling this repo
                                ├─► halt_subtree: skip descendants too
                                ├─► retry: re-queue once more
                                └─► continue: leave failed, keep going
```

## Common pitfalls

- **Parent tasks aren't run.** The scheduler only claims **leaf** tasks. If you `POST` a task with no children but later add children, the parent stops being a candidate until the children all reach `done`.
- **`order_position` collisions** are not auto-resolved. If you supply explicit values across siblings, make them unique per `(repo_id, parent_id)`.
- **Local-folder repos skip git entirely.** No branches, no PRs, no merges. The agent edits the working tree in place.
- **Notes from the agent only persist on success.** A failed run's `<NOTES_TO_SAVE>` blocks are dropped.
- **Cancelling a running task is not exposed via API.** You can `DELETE /api/tasks/:id` while pending; while active, the lease has to expire (default 30 min) before the row can be reclaimed.
- **`POST /api/repos/:id/advance` is a stub.** Don't rely on it to "kick" the queue — the scheduler ticks on its own interval (`POLL_INTERVAL_SECONDS`).

## When in doubt

Read [`endpoints.md`](./endpoints.md) for the full surface, [`schemas.md`](./schemas.md) for exact field shapes, and [`examples.md`](./examples.md) for runnable `curl` recipes.
