# Agent Runtime — what the executing agent sees

This document describes the environment the **in-container** Claude Code agent runs in when grunt picks up a task. Most callers of the API don't need this — it's relevant if you're writing prompts/instructions that will end up in a task's `description`, building tools that introspect grunt's behaviour, or debugging why a task ran the way it did.

If you're just posting tasks, [`posting-tasks.md`](./posting-tasks.md) is enough.

## How a task gets executed

1. The scheduler picks the next pending **leaf** task (no pending children) on an active repo, claims it (sets `status='active'`, `worker_id`, `leased_until`).
2. For git-backed repos: the runner clones/pulls, checks out `base_branch`, cuts a per-task branch named after the task id, mounts it at `/workspace`.
3. Linked repos get bind-mounted under `/context/<name>` — read-only by default, read-write when the link's `permission === "write"`.
4. The runner spawns a Docker container (image `grunt/runner`) with the task's resolved Claude model and pipes a `TaskPayload` JSON to the agent.
5. The agent works inside the container. Its log is streamed to a host-side file at `<REPOS_PATH>/_logs/task-<id>.log`.
6. On success: optional `<NOTES_TO_SAVE>` blocks are persisted, the worker commits + pushes, opens a PR if `repo.require_pr`, otherwise merges into base.
7. Token usage is recorded per attempt (success or failure).

## Mount layout inside the container

```
/workspace                  # primary repo, read-write
/context/<repo-name-1>      # linked repo, read-only by default
/context/<repo-name-2>      # ...
/home/node/.claude          # host's Claude Code auth, copied into a temp dir per run
```

Anything not listed is invisible — the agent must not assume other paths exist on disk.

Writes to read-only mounts fail at the kernel layer with `EROFS`. The agent should treat read-only context repos as reference material; do not retry / chmod / try to work around the failure.

## TaskPayload (what the agent receives)

```ts
interface TaskPayload {
  task: {
    id: number;
    title: string;
    description: string;
    acceptanceCriteria: Array<{ id: number; description: string; met: boolean }>;
    parent: { id: number; title: string; description: string } | null;
    siblings: Array<{ id: number; title: string; status: string; order_position: number }>;
    notes: Array<{
      id: number;
      task_id: number;
      author: "agent" | "user";
      visibility: "self" | "siblings" | "descendants" | "ancestors" | "all";
      tags: string[];
      content: string;
      created_at: string;
    }>;
  };
}
```

Notes are pre-filtered to the visibility rules — every note in this array is one the agent is *meant* to see for this task.

## NOTES_TO_SAVE protocol

Agents can leave structured notes for related tasks by emitting one or more `<NOTES_TO_SAVE>` blocks in their final output. Each block contains a JSON array of note objects:

```
<NOTES_TO_SAVE>
[
  {
    "visibility": "siblings",
    "tags": ["context"],
    "content": "Ran lint already; the legacy adapter can be skipped."
  }
]
</NOTES_TO_SAVE>
```

Fields:
- `content` (string, required) — concise, concrete.
- `visibility` (string, required) — `self`, `siblings`, `descendants`, `ancestors`, or `all`.
- `tags` (string array, optional).

Multiple blocks are allowed. Notes are persisted **only on success** with `author='agent'` and `task_id=<this task>`. Use sparingly — only when the information is non-obvious and useful to whoever picks up adjacent work.

Visibility resolution (same as the API's note rules): a note authored on task N is visible to task X when N == X (self), or `siblings` and N/X share `parent_id`, or `descendants` and N is a strict ancestor of X, or `ancestors` and N is a strict descendant of X, or `all` and N/X live in the same repo.

## Lease & timeouts

- Per-task lease defaults to 30 minutes; renewed every 60 seconds while the runner is alive.
- The container has a hard timeout of 30 minutes (`TIMEOUT_MS = 1_800_000`).
- A worker that crashes mid-task leaves the lease behind. On startup, `reconcileOrphanedTasks` reclaims leased rows owned by the booting worker back to `pending` so they get re-queued.

## Retry & failure policy

- Up to **3 attempts** per task by default (`MAX_ATTEMPTS = 3`).
- Each failed attempt increments `retry_count` and records `claude_finished` / `status_change` events.
- After the final attempt, the task moves to `failed` and the repo's `on_failure` policy applies:
  - `halt_repo` — scheduler stops claiming new tasks on this repo.
  - `halt_subtree` — descendants of the failed task are skipped.
  - `retry` — re-queue once more (one-shot extra attempt).
  - `continue` — leave failed, keep claiming siblings.

The `on_parent_child_fail` policy then decides how the failure rolls up: `cascade_fail` fails the parent, `mark_partial` flags it, `ignore` leaves the parent untouched.

## Effective Claude model resolution

For a task T, the model is resolved by walking:

1. `T.model` (override on this task)
2. nearest ancestor with `model` set
3. `settings.default_model`

`GET /api/tasks/:id/effective-model` returns both the resolved value and which step it came from.

## Token usage accounting

Every agent run (success **or** failure) inserts a `task_usage` row whose four fields mirror the Anthropic API's `usage` block: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`. Aggregations:

- `GET /api/tasks/:id/usage` — totals + per-run rows for the task.
- `GET /api/repos/:id/usage` — totals across the repo.
- `GET /api/usage/weekly` — trailing-7-day totals + 30-day daily breakdown.
- The scheduler's weekly-cap check uses the trailing-7-day total against `settings.weekly_token_cap`. When capped, it stops claiming new work until usage rolls off (in-flight tasks are not preempted).

## Webhooks fired on terminal states

If a repo has webhooks registered with matching events, grunt POSTs a Slack-compatible payload when a task hits `done`, `failed`, or `halted`. Delivery is fire-and-forget with a small retry on 5xx; misconfigured URLs do not block the pipeline.

## Cross-repo work

A task can write to a `/context/<name>` mount only if the corresponding repo link has `permission: "write"`. Even so:
- The agent should make the **minimum** set of changes needed in each repo.
- Do **not** run `git commit`, `git push`, or branch operations inside `/context/*`. Commits and merges for linked repos are handled by the task runner outside the container.
- If the task does not call for changes in a writable context repo, treat it as read-only in practice and leave it untouched.
