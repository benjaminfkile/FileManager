# grunt API — Type Shapes

These are the canonical shapes you'll see in request/response bodies. Field names match the database columns 1:1.

## `Repo`

```ts
interface Repo {
  id: number;
  owner: string | null;          // null for local-folder repos
  repo_name: string | null;      // null for local-folder repos
  active: boolean;               // false repos are skipped by the scheduler
  base_branch: string;
  base_branch_parent: string;
  require_pr: boolean;
  github_token: string | null;   // per-repo override; falls back to GH_PAT secret
  is_local_folder: boolean;
  local_path: string | null;     // absolute path when is_local_folder=true
  on_failure: "halt_repo" | "halt_subtree" | "retry" | "continue";
  max_retries: number;
  on_parent_child_fail: "cascade_fail" | "mark_partial" | "ignore";
  ordering_mode: "sequential" | "parallel";
  clone_status: "pending" | "cloning" | "ready" | "error";
  clone_error: string | null;
  created_at: string;            // ISO 8601
}
```

## `Task`

```ts
interface Task {
  id: number;
  repo_id: number;
  parent_id: number | null;
  title: string;
  description: string;
  order_position: number;
  status: "pending" | "active" | "done" | "failed";
  retry_count: number;
  pr_url: string | null;
  worker_id: string | null;      // hostname:pid of the worker holding the lease
  leased_until: string | null;   // ISO 8601; lease expiry
  ordering_mode: "sequential" | "parallel" | null;  // null = inherit from repo
  log_path: string | null;       // host-side absolute path; only set after first byte
  requires_approval: boolean;
  model: string | null;          // null = inherit walking parent_id then settings.default_model
  created_at: string;
}
```

`GET /api/tasks/:id` augments this with:

```ts
interface TaskDetail extends Task {
  acceptanceCriteria: AcceptanceCriterion[];
  children: Array<{
    id: number;
    title: string;
    status: "pending" | "active" | "done" | "failed";
    order_position: number;
  }>;
}
```

`GET /api/tasks?repo_id=N` items add `children_count: number`.

## `AcceptanceCriterion`

```ts
interface AcceptanceCriterion {
  id: number;
  task_id: number;
  description: string;
  order_position: number;
  met: boolean;
  created_at: string;
}
```

## `TaskEvent` (read-only)

```ts
interface TaskEvent {
  id: number;
  task_id: number;
  ts: string;                    // ISO 8601
  event: string;                 // see "known event names" below
  data: Record<string, unknown> | null;
}
```

Known event names emitted by the runner (non-exhaustive — treat unknowns as opaque):

| Event | `data` payload |
| --- | --- |
| `claimed` | `{ worker_id }` |
| `status_change` | `{ from, to }` |
| `branch_created` | `{ branch }` |
| `claude_started` | `{ attempt, model }` |
| `claude_finished` | `{ attempt, success }` |
| `commit_pushed` | `{ branch }` |
| `pr_opened` | `{ url }` |

## `TaskNote`

```ts
type NoteAuthor = "agent" | "user";
type NoteVisibility = "self" | "siblings" | "descendants" | "ancestors" | "all";

interface TaskNote {
  id: number;
  task_id: number;
  author: NoteAuthor;
  visibility: NoteVisibility;
  tags: string[];                // empty array, not null
  content: string;
  created_at: string;
}
```

## `TokenUsage` & `TaskUsage`

```ts
interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

interface TaskUsage extends TokenUsage {
  id: number;
  task_id: number;
  repo_id: number;
  created_at: string;
}
```

`GET /api/tasks/:id/usage` returns:

```ts
{
  totals: TokenUsage;            // sum across runs
  runs: TaskUsage[];             // per-run rows
}
```

`GET /api/repos/:id/usage` returns just `{ totals }`.

## `RepoWebhook`

```ts
type WebhookEvent = "done" | "failed" | "halted";

interface RepoWebhook {
  id: number;
  repo_id: number;
  url: string;                   // http or https
  events: WebhookEvent[];        // non-empty, deduped
  active: boolean;
  created_at: string;
}
```

## `RepoLink`

```ts
type RepoLinkPermission = "read" | "write";

interface RepoLink {
  id: number;
  repo_a_id: number;             // canonicalised so repo_a_id < repo_b_id
  repo_b_id: number;
  role: string | null;
  permission: RepoLinkPermission;
  created_at: string;
}
```

## `TaskTreeProposal` (used by `materialize-tree` and templates)

```ts
interface ProposedTaskNode {
  title: string;
  description?: string;
  acceptance_criteria?: string[];
  children?: ProposedTaskNode[];
  // Only valid on top-level (parents[]). Targets a directly-linked sibling repo
  // (single hop). Validation rejects this on nested nodes.
  repo_id?: number;
}

interface TaskTreeProposal {
  parents: ProposedTaskNode[];   // non-empty
}
```

`POST /api/repos/:id/materialize-tree` returns:

```ts
interface MaterializedTaskTree {
  parents: MaterializedTaskNode[];
}

interface MaterializedTaskNode {
  id: number;
  title: string;
  parent_id: number | null;
  order_position: number;
  repo_id: number;               // actual repo this subtree was written to
  acceptance_criteria_ids: number[];
  children: MaterializedTaskNode[];
}
```

## `TaskTemplate`

```ts
interface TaskTemplate {
  id: number;
  name: string;
  description: string;
  tree: TaskTreeProposal;
  created_at: string;
}
```

## `Settings` (single-row)

```ts
interface Settings {
  default_model: string;
  weekly_token_cap: number | null;   // null = unlimited
  session_token_cap: number | null;  // null = unlimited
}
```

## `TaskPayload` (what the executing agent sees)

This is **not** an API response shape — it's what the in-container Claude Code agent receives at task start. Documented here so callers writing tests / mocks know the surface.

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
      visibility: NoteVisibility;
      tags: string[];
      content: string;
      created_at: string;
    }>;
  };
}
```

See [`agent-runtime.md`](./agent-runtime.md) for what the agent does with this payload.
